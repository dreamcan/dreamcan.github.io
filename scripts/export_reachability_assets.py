#!/usr/bin/env python3
"""Export instruction-complete DreamCan examples and cached values on lyg2080.

Run with the project's planning Python on the remote host. The source project,
datasets, and model checkpoints are read-only; all outputs go to --output.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess

import cv2
import h5py
import numpy as np
from PIL import Image

PROJECT = Path('/data/gck/svl_project')
DATASETS = ['libero-long', 'pusht', 'language-table', 'square']
LANGUAGE_ROOT = Path('/mnt/gck/vlp_videos_by_category_dedup_static_frames')
LANGUAGE_CATEGORIES = [
    ('line', 'Make a line', Path('/mnt/gck/language_table_line_full_iql_value_progress_dp_tau1_k16')),
    ('all_to_region', 'All to region', PROJECT / 'outputs/language_table_all_to_region_full_iql_value_progress_dp_k16'),
    ('canonical_shape', 'Canonical shape', PROJECT / 'outputs/language_table_canonical_shape_full_iql_value_progress_dp_k16'),
]
LIBERO_LABELS = {
    'put the white mug on the left plate and put the yellow and white mug on the right plate': 'Two mugs on plates',
    'put the white mug on the plate and put the chocolate pudding to the right of the plate': 'Mug on plate & pudding beside it',
    'put the yellow and white mug in the microwave and close it': 'Mug in microwave & close it',
    'turn on the stove and put the moka pot on it': 'Turn on stove & place moka pot',
    'put both the alphabet soup and the cream cheese box in the basket': 'Soup & cream cheese in basket',
    'put both the alphabet soup and the tomato sauce in the basket': 'Soup & tomato sauce in basket',
    'put both moka pots on the stove': 'Both moka pots on stove',
    'put both the cream cheese box and the butter in the basket': 'Cream cheese & butter in basket',
    'put the black bowl in the bottom drawer of the cabinet and close it': 'Bowl in bottom drawer & close it',
    'pick up the book and place it in the back compartment of the caddy': 'Book in back compartment of caddy',
}


def language_label(category: str, instruction: str) -> str:
    if category == 'all_to_region':
        return instruction.removeprefix('put all the blocks in the ').capitalize()
    if category == 'canonical_shape':
        match = re.search(r'make a "([^"]+)"', instruction)
        if match:
            shape = match.group(1)
            return (shape if len(shape) == 1 else shape.capitalize()) + ' shape'
        if 'rainbow' in instruction:
            return 'Rainbow'
        if 'smiley face' in instruction:
            return 'Smiley face'
    if category == 'line':
        if 'diagonal' in instruction:
            direction = instruction.split('from ', 1)[1].replace(' to ', ' → ')
            return 'Diagonal · ' + direction
        for orientation in ['horizontal', 'vertical']:
            if orientation in instruction:
                region = re.search(r'on the (\w+) of the board', instruction)
                return orientation.capitalize() + ((' · ' + region.group(1)) if region else '')
        return 'Line · any orientation'
    return instruction


def selections(task_id: str) -> dict:
    """Select one available trajectory for every exact source instruction."""
    task = {'id': task_id, 'trajectories': [], 'selection': []}
    if task_id == 'libero-long':
        pair_dir = PROJECT / 'data/libero_long_v_pair'
        chosen = {}
        for path in sorted(pair_dir.glob('rid_*_dsidx_*.npz')):
            match = re.fullmatch(r'rid_(\d+)_dsidx_(\d+)_(.+)', path.stem)
            if not match:
                raise ValueError(f'Unrecognized pair cache filename: {path}')
            chosen.setdefault(match.group(3), (path, int(match.group(2))))
        if len(chosen) != 10:
            raise ValueError(f'Expected 10 distinct LIBERO-Long tasks, found {len(chosen)}')
        task.update(label='LIBERO-Long', selectionPolicy='one trajectory per distinct task instruction', instructionCount=10)
        for path, episode in chosen.values():
            task['selection'].append({'pair': path, 'episode': episode,
                                      'h5': Path('/mnt/gck/libero_data/libero_hdf5/LIBERO_Long.h5')})
    elif task_id == 'language-table':
        task.update(label='Language Table', selectionPolicy='one trajectory per exact instruction in each category', coverage=[])
        for category, label, cache_root in LANGUAGE_CATEGORIES:
            metadata_path = LANGUAGE_ROOT / category / 'metadata.json'
            metadata = json.loads(metadata_path.read_text())
            instructions = dict.fromkeys(row['goal'] for row in metadata)
            chosen = {}
            for row in metadata:
                path = cache_root / 'value_pairs' / category / (row['episode_id'] + '_value_pairs.npz')
                if row['goal'] not in chosen and path.is_file() and Path(row['video_path']).is_file():
                    chosen[row['goal']] = {'pair': path, 'episode': row['episode_id'], 'h5': None,
                                         'category': category, 'categoryLabel': label, 'instruction': row['goal']}
            missing = set(instructions) - set(chosen)
            if missing:
                raise ValueError(f'Missing video or learned cache for {category}: {sorted(missing)}')
            task['coverage'].append({'category': category, 'label': label, 'instructionCount': len(instructions),
                                     'metadataSource': str(metadata_path), 'cacheDirectory': str(cache_root / 'value_pairs' / category)})
            task['selection'].extend(chosen.values())
        task['instructionCount'] = len(task['selection'])
    else:
        if task_id == 'pusht':
            task['label'] = 'PushT'
            pair_dir, h5_path, episodes = Path('/mnt2/gck/pusht/v_pair'), Path('/mnt2/gck/pusht/hdf5/PushT.h5'), [0, 1, 2]
        elif task_id == 'square':
            task['label'] = 'Square'
            pair_dir, h5_path, episodes = Path('/mnt4/gck/gck_square/v_pair'), PROJECT / 'robomimic/hdf5/Square.h5', [0, 100, 50]
        else:
            raise ValueError(task_id)
        for episode in episodes:
            matches = sorted(pair_dir.glob(f'rid_{episode:06d}_*.npz'))
            if len(matches) != 1:
                raise ValueError(f'Expected one cache for {task_id} episode {episode}')
            task['selection'].append({'pair': matches[0], 'episode': episode, 'h5': h5_path})
    return task


def encode_video(frames: np.ndarray, path: Path, fps: float) -> None:
    height, width = frames.shape[1:3]
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
               '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{width}x{height}',
               '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264',
               '-threads', '2', '-preset', 'fast', '-crf', '18',
               '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(path)]
    subprocess.run(command, input=np.ascontiguousarray(frames).tobytes(), check=True)


def read_video(path: Path) -> tuple[np.ndarray, float]:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise ValueError(f'Cannot read {path}')
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    cap.release()
    return np.stack(frames), fps


def export(output: Path, datasets: list[str]) -> None:
    output.mkdir(parents=True, exist_ok=True)
    manifest = {'version': 1, 'gamma': 0.95, 'tasks': [],
                'source': 'DreamCan trained value-pair caches; no synthetic curves',
                'valueTransform': 'clip(1 + (1 - gamma) * V_R, 0, 1)',
                'pairDomain': 'initialFrame < goalFrame',
                'diagonal': 'R(s, s) = 1 is the theoretical terminal boundary, not a cached prediction'}
    for task_id in datasets:
        task = selections(task_id)
        candidates = task.pop('selection')
        seen_instructions = set()
        for number, selection in enumerate(candidates, 1):
            pair_path, episode, h5_path = selection['pair'], selection['episode'], selection['h5']
            with np.load(pair_path, allow_pickle=False) as cache:
                value = cache['v_pair'].astype(np.float64)
                count = len(value)
                gamma = float(cache['gamma']) if 'gamma' in cache.files else 0.95
                if h5_path:
                    episode_key = f'ep_{episode:06d}'
                    with h5py.File(h5_path, 'r') as h:
                        group = h['episodes'][episode_key]
                        frames = group['image'][:]
                        instruction = str(group.attrs['language_instruction'])
                        quality = str(group.attrs.get('operator_quality', ''))
                    # HDF5 caches retain frame indices, not capture timestamps.
                    # 10 fps is an explicit presentation rate, not a physical-time claim.
                    fps = 10.0
                    video_source = str(h5_path) + '::episodes/' + episode_key + '/image'
                    checkpoint = None  # These original caches do not record checkpoint provenance.
                    expected_instruction = str(cache['task_name'])
                    assert expected_instruction == instruction, (pair_path, instruction)
                    assert int(cache['trajectory_idx']) == episode
                else:
                    video_path = Path(str(cache['video_path']))
                    frames, fps = read_video(video_path)
                    instruction = str(cache['goal'])
                    quality = ''
                    video_source = str(video_path)
                    checkpoint = str(cache['checkpoint'])
                    episode_key = str(cache['episode_id'])
                    assert episode_key == episode and instruction == selection['instruction']
                    assert video_path == LANGUAGE_ROOT / selection['category'] / (episode_key + '.mp4')
                assert value.shape == (count, count)
                assert count > 1 and 0 < gamma < 1
                assert len(frames) == count, (pair_path, len(frames), count)
                assert frames.ndim == 4 and frames.shape[-1] == 3
                assert np.isfinite(value[np.triu_indices(count, 1)]).all(), pair_path
                reachability = np.clip(1.0 + (1.0 - gamma) * value, 0.0, 1.0)
                trajectory_id = f'{task_id}-{episode_key}'
                folder = output / trajectory_id
                folder.mkdir(exist_ok=True)
                shutil.copy2(pair_path, folder / 'source-values.npz')
                # Keep every cached forward pair. JSON roundoff is <= 5e-6.
                packed = [np.round(reachability[i, i + 1:], 5).tolist() for i in range(count)]
                curve_data = {'version': 1, 'id': trajectory_id, 'frameCount': count,
                              'gamma': gamma, 'forwardReachability': packed}
                (folder / 'curves.json').write_text(json.dumps(curve_data, separators=(',', ':'), allow_nan=False))
                if h5_path:
                    encode_video(frames, folder / 'video.mp4', fps)
                else:
                    shutil.copy2(video_path, folder / 'video.mp4')
                # All frames in the atlas allow exact slider selections; 24 are
                # displayed at once, evenly sampled and including both endpoints.
                height, width = frames.shape[1:3]
                tile_width = 192 if width > height else 128
                tile_height = round(tile_width * height / width)
                columns, rows = 8, math.ceil(count / 8)
                atlas = Image.new('RGB', (columns * tile_width, rows * tile_height), (255, 255, 255))
                for index, frame in enumerate(frames):
                    thumb = Image.fromarray(frame).resize((tile_width, tile_height), Image.Resampling.LANCZOS)
                    atlas.paste(thumb, ((index % columns) * tile_width, (index // columns) * tile_height))
                atlas.save(folder / 'frames.webp', quality=84, method=4)
                sampled = np.unique(np.rint(np.linspace(0, count - 1, min(24, count))).astype(int)).tolist()
                title = f'Trajectory {number:02d}' + (f' · {quality.capitalize()} demo' if quality else '')
                if task_id == 'libero-long':
                    title = f'Task {number:02d} · ' + LIBERO_LABELS.get(instruction, instruction)
                elif task_id == 'language-table':
                    title = language_label(selection['category'], instruction)
                row = {'id': trajectory_id, 'label': title, 'episode': episode_key,
                       'instruction': instruction, 'frameCount': count, 'fps': fps,
                       'fpsKind': 'presentation' if h5_path else 'source',
                       'width': width, 'height': height, 'quality': quality,
                       'video': f'{trajectory_id}/video.mp4', 'atlas': f'{trajectory_id}/frames.webp',
                       'curves': f'{trajectory_id}/curves.json', 'sourceValues': f'{trajectory_id}/source-values.npz',
                       'atlasColumns': columns, 'atlasRows': rows, 'sampledFrames': sampled,
                       'provenance': {'valueCache': str(pair_path), 'videoSource': video_source,
                                      'valueCacheSha256': hashlib.sha256(pair_path.read_bytes()).hexdigest(),
                                      'checkpoint': checkpoint}}
                if 'category' in selection:
                    row.update(category=selection['category'], categoryLabel=selection['categoryLabel'])
                if task_id in ['libero-long', 'language-table']:
                    assert instruction not in seen_instructions, instruction
                    seen_instructions.add(instruction)
                task['trajectories'].append(row)
                print(f'Exported {trajectory_id}: {count} frames, {count * (count - 1) // 2} learned pairs', flush=True)
        manifest['tasks'].append(task)
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f'Complete: {output}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--datasets', nargs='+', choices=DATASETS, default=DATASETS,
                        help='Export only selected datasets; default exports all four')
    args = parser.parse_args()
    export(args.output.resolve(), args.datasets)
