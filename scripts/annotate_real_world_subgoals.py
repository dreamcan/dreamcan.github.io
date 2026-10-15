#!/usr/bin/env python3
"""Compute retrospective DP subgoals on the site's exact real-robot recordings.

Run on lyg2080 with the planning environment. Task checkpoints and training
caches are read-only. Inputs, learned values and outputs live under --root.
These are offline annotations of executions, not saved online planner predictions.
"""
import argparse
import hashlib
import io
import json
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

PROJECT = Path('/data/gck/svl_project')
sys.path.insert(0, str(PROJECT))
TASKS = {
    'folding': ('box_folding', 'goal_value_iql_box_folding_105',
                'box_folding_robometer4b_lora_progress_success_1gpu_105', 'box_folding_rfm'),
    'packing': ('human_box_packing', 'goal_value_iql_human_box_packing',
                'human_box_packing_robometer4b_lora_progress_success_1gpu_79', 'human_box_packing_rfm'),
    'line': ('yam_line', 'goal_value_iql_yam_line',
             'yam_line_robometer4b_lora_progress_success_1gpu_100', 'yam_line_rfm'),
}


def sha(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def prepare(root, rows):
    for folder in ['analysis-input', 'features', 'values', 'annotations', 'export']:
        (root / folder).mkdir(exist_ok=True)
    for row in rows:
        original = root / 'input' / f"{row['episode_id']}.mp4"
        row['video'] = str(original)
        assert sha(original) == row['source']['sha256'], original
        view = root / 'analysis-input' / original.name
        if not view.exists():
            subprocess.run(['/data/gck/miniconda3/envs/planning/bin/ffmpeg', '-v', 'error',
                            '-i', str(original), '-vf', 'scale=640:360', '-an', '-c:v', 'libx264',
                            '-crf', '16', '-threads', '2', '-movflags', '+faststart', str(view)], check=True)
        row['analysis_video'] = str(view)
    for task in TASKS:
        ann = [{**r, 'video': r['analysis_video']} for r in rows if r['task'] == task]
        (root / 'annotations' / f'{task}.json').write_text(json.dumps(ann, indent=2))


def features(root, rows):
    import h5py
    import numpy as np
    import torch
    from planning.model.radio_loading import load_radio_model
    from planning.model.radio_encode_utils import radio_encode_unit_nchw_local_global
    from scripts.precompute_vlp_goal_value_features import decode_video_rgb
    dest = root / 'features' / 'features.h5'
    if dest.exists():
        return
    device = torch.device('cuda:0')
    radio = load_radio_model('c-radio_v3-h', device=device)
    goals = list(dict.fromkeys(r['goal'] for r in rows))
    language = {}
    for task, (folder, *_rest) in TASKS.items():
        src = Path('/mnt4/gck_planning') / folder / 'iql_features/qwen3_4b_radio_hdf5/features.h5'
        with h5py.File(src, 'r') as f:
            goal_idx = json.loads(f['language'].attrs['goal_to_index_json'])
            for row in rows:
                if row['task'] == task:
                    language[row['goal']] = np.asarray(f['language/embeddings'][goal_idx[row['goal']]])
    manifest = {'radio_version': 'c-radio_v3-h', 'resize': [224, 384], 'frame_stride': 1,
                'local_storage': 'exact patch mean; value model averages patches before projection', 'episodes': []}
    with h5py.File(dest.with_suffix('.partial.h5'), 'w') as f, torch.inference_mode():
        lang = f.create_group('language')
        lang.create_dataset('embeddings', data=np.stack([language[g] for g in goals]))
        lang.attrs['goals_json'] = json.dumps(goals)
        lang.attrs['goal_to_index_json'] = json.dumps({g: i for i, g in enumerate(goals)})
        eps = f.create_group('episodes')
        for i, row in enumerate(rows):
            frames = decode_video_rgb(Path(row['analysis_video']), frame_stride=1,
                                      resize=(224, 384), max_frames=None)
            locals_, globals_ = [], []
            for start in range(0, len(frames), 16):
                x = torch.from_numpy(frames[start:start+16]).to(device=device, dtype=torch.float32).permute(0, 3, 1, 2) / 255
                local, glob = radio_encode_unit_nchw_local_global(radio, x, microbatch=16)
                # Average in float32, matching _encode_episode_fast's HDF5 read.
                locals_.append(local.float().mean(dim=1, keepdim=True).cpu().numpy())
                globals_.append(glob.float().cpu().numpy())
            key = f'ep_{i:06d}'
            g = eps.create_group(key)
            g.attrs['num_frames'] = len(frames)
            g.create_dataset('radio_local', data=np.concatenate(locals_), compression='gzip')
            g.create_dataset('radio_global', data=np.concatenate(globals_), compression='gzip')
            manifest['episodes'].append({**row, 'num_frames': len(frames), 'language_index': goals.index(row['goal']),
                                         'feature_hdf5': {'file': 'features.h5', 'key': key}})
            print('RADIO', row['episode_id'], len(frames), flush=True)
    dest.with_suffix('.partial.h5').rename(dest)
    (root / 'features' / 'manifest.json').write_text(json.dumps(manifest, indent=2))


def utility(root, only_task=None):
    for task, (folder, _iql, meter, data_source) in TASKS.items():
        if only_task and task != only_task:
            continue
        out = root / f'{task}-progress.json'
        if out.exists():
            continue
        runner = root / 'read_safe_robometer_progress.py'
        if not runner.exists():
            runner = PROJECT / 'scripts/extract_galaxea_robometer_progress.py'
        subprocess.run([sys.executable, str(runner),
                        '--checkpoint', f'/mnt4/gck_planning/{folder}/robometer_logs/{meter}',
                        '--annotations', str(root / 'annotations' / f'{task}.json'), '--out', str(out),
                        '--max-frames', '64', '--device', 'cuda:0', '--data-source', data_source], check=True)


def select(root, rows, values_only=False):
    import numpy as np
    import torch
    from planning.dataset.vlp_goal_value_hdf5_dataset import VlpGoalValueHdf5Dataset
    from planning.train.vlp_goal_value_iql_train import _build_model
    from tools.planning.run_language_table_line_iql_value_progress_dp import (
        _latest_checkpoint, _compute_value_pair, _reachability_cost_from_value,
        _smooth_finite_matrix, _normalize_progress_for_dp, _run_one_k, VARIANTS, save_curve_plot)
    torch.set_num_threads(4)
    ds = VlpGoalValueHdf5Dataset(root / 'features', history_len=2)
    device = torch.device('cuda:0')
    records = []
    for task, (folder, iql, meter, _source) in TASKS.items():
        ckpt_dir = Path('/mnt4/gck_planning') / folder / 'checkpoints' / iql
        ckpt = _latest_checkpoint(ckpt_dir)
        cfg = json.loads((ckpt_dir / 'resolved_config.json').read_text())
        model = _build_model(cfg, ds, device)
        # Regular read avoids the filesystem's memory-mapping stall.
        model.load_state_dict(torch.load(io.BytesIO(ckpt.read_bytes()), map_location='cpu', weights_only=False)['model'], strict=True)
        model.eval()
        progress = {} if values_only else {r['episode_id']: r for r in json.loads((root / f'{task}-progress.json').read_text())['trajectories']}
        for i, row in enumerate(rows):
            if row['task'] != task:
                continue
            eid = row['episode_id']
            value_path = root / 'values' / f'{eid}.npz'
            if value_path.exists():
                v = np.load(value_path)['v_pair']
            else:
                v = _compute_value_pair(model, ds, i, device=device, read_batch=64, encode_batch=64, pair_block=64)
            if values_only:
                np.savez_compressed(value_path, v_pair=v)
                print('VALUE', eid, v.shape, flush=True)
                continue
            n = v.shape[0]
            raw = np.asarray(progress[eid]['progress'])
            assert len(raw) == n and np.isfinite(raw).all()
            assert float(np.ptp(raw)) > 1e-6, 'Refuse a constant utility curve / synthetic progress fallback'
            norm, search = _normalize_progress_for_dp(raw, smooth_window=5, monotonic=True)
            reach, cost = _reachability_cost_from_value(v, gamma=.95, eps=.02)
            smooth = _smooth_finite_matrix(cost, 5)
            selected, variants = _run_one_k(k_total=row['k'], n=n, progress=search,
                                          cost_smooth=smooth, variants=[replace(v, gap_frac=0) for v in VARIANTS],
                                          min_gap_base=3 if task != 'folding' else 4)
            assert 'fallback_reason' not in selected['metrics'], selected
            assert len(selected['subgoal_timesteps']) == row['k']
            assert len(set(selected['subgoal_timesteps'])) == row['k']
            np.savez_compressed(value_path, v_pair=v, reachability=reach, reachability_cost=cost,
                                progress_raw=raw, progress_normalized=norm, progress_search=search)
            import cv2
            cap = cv2.VideoCapture(row['video'])
            fps = cap.get(cv2.CAP_PROP_FPS)
            assert int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) == n
            cap.release()
            record = {**row, **selected, 'frame_count': n, 'fps': fps,
                      'subgoal_seconds': [t / fps for t in selected['subgoal_timesteps']],
                      'reachability_checkpoint': str(ckpt), 'reachability_checkpoint_sha256': sha(ckpt),
                      'utility_checkpoint': f'/mnt4/gck_planning/{folder}/robometer_logs/{meter}',
                      'utility_sampled_frames': progress[eid]['sampled_original_timesteps'],
                      'values': f'values/{eid}.npz', 'values_sha256': sha(value_path),
                      'annotation_type': 'retrospective value/progress DP on the exact displayed execution',
                      'state_anchors': False,
                      'compute_host': __import__('socket').gethostname()}
            records.append(record)
            save_curve_plot(root / 'export' / f'{eid}-dp-curves.png', title=f'{eid} | K={row["k"]} | {row["goal"]}',
                            progress=search, raw_progress=norm, timesteps=selected['subgoal_timesteps'], c_r=smooth)
            (root / 'export' / f'{eid}-variants.json').write_text(json.dumps(variants, indent=2))
            print('DP', eid, record['subgoal_timesteps'], flush=True)
        del model
        torch.cuda.empty_cache()
    if values_only:
        return
    (root / 'export' / 'manifest.json').write_text(json.dumps({
        'version': 1, 'source': str(root), 'gamma': .95, 'epsilon': .02, 'smooth_window': 5,
        'utility_inference': 'task-finetuned RoboMeter; 64 sampled frames interpolated to exact video frame timeline',
        'timeline': 'native presentation frames/FPS, not an inferred original robot clock',
        'minimum_gap': '4 native frames for folding; 3 for packing/line. Relative 5–6% gap disabled for short accelerated recordings.',
        'method': 'same generic value/progress DP as task pipelines; no robot state available for anchored refinement',
        'records': records}, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--stage', choices=['prepare', 'features', 'utility', 'values', 'select'], required=True)
    parser.add_argument('--task', choices=list(TASKS))
    args = parser.parse_args()
    rows = json.loads((args.root / 'input.json').read_text())
    prepare(args.root, rows)
    if args.stage == 'features': features(args.root, rows)
    elif args.stage == 'utility': utility(args.root, args.task)
    elif args.stage == 'values': select(args.root, rows, values_only=True)
    elif args.stage == 'select': select(args.root, rows)
