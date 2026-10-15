#!/usr/bin/env python3
"""Export existing Language-Table generated plans on lyg2080; never run inference.

Source data is read-only. Write exported videos, posters and provenance to --output.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

PROJECT = Path('/data/gck/svl_project')
LINE_ROOT = Path('/mnt4/gck_line_success/gen100')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def video_info(path):
    result = subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name,width,height,nb_frames,r_frame_rate:format=duration',
        '-of', 'json', str(path),
    ], text=True)
    data = json.loads(result)
    stream = data['streams'][0]
    numerator, denominator = map(int, stream['r_frame_rate'].split('/'))
    return {
        'codec': stream['codec_name'], 'width': stream['width'], 'height': stream['height'],
        'frameCount': int(stream['nb_frames']), 'fps': numerator / denominator,
        'duration': float(data['format']['duration']),
    }


def export_video(source, destination, output):
    if not source.is_file():
        raise FileNotFoundError(source)
    target = output / destination
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    poster = target.with_suffix('.webp')
    subprocess.run([
        'ffmpeg', '-y', '-v', 'error', '-i', str(source), '-frames:v', '1',
        '-c:v', 'libwebp', '-quality', '85', str(poster),
    ], check=True)
    source_hash = digest(source)
    assert digest(target) == source_hash
    return {
        'video': target.relative_to(output).as_posix(),
        'poster': poster.relative_to(output).as_posix(),
        'source': str(source), 'sha256': source_hash, **video_info(source),
    }


def example(episode, label, ours, dense=None, uniform=None):
    return {'episode': episode, 'label': label, 'paths': {
        'ours': ours, 'dense': dense, 'uniform': uniform, 'vlp': None,
    }}


def line_example(episode, label):
    return example(
        episode, label,
        LINE_ROOT / 'ours' / episode / 'chained_subgoals.mp4',
        LINE_ROOT / 'dense' / episode / 'full_rollout.mp4',
        LINE_ROOT / 'evenly' / episode / 'chained_subgoals.mp4',
    )


def region_example(directory, label):
    return example(
        directory.split('_', 1)[1], label,
        PROJECT / 'eval/wan_a2r_value_search_n4/baseline' / directory / 'chained_subgoals.mp4',
        PROJECT / 'eval/wan_a2r_dense_value_search/n1/dense_bon_n1' / directory / 'full_rollout.mp4',
    )


def shape_example(directory, label):
    return example(
        directory.split('_', 1)[1], label,
        PROJECT / 'eval/ppt_item7_canonical_shape_dp_subgoal_gen/task1_original' / directory / 'chained_subgoals.mp4',
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    sources = [PROJECT, LINE_ROOT, Path('/mnt/gck/vlp_videos_by_category_dedup_static_frames')]
    if any(output == p or p in output.parents for p in sources):
        parser.error('Output must be outside source directories, e.g. /tmp/dreamcan-planning-web.')

    tasks = [
        {'id': 'line', 'label': 'Make a line',
         'results': {'dense': 71, 'uniform': 69, 'vlp': 56, 'ours': 86},
         'selection': 'Three orientations; ours passes the archived SAM2 success criterion on all three. Baseline outcomes vary.',
         'examples': [line_example('w100_e43', 'Vertical · right'),
                      line_example('w131_e11', 'Horizontal · bottom'),
                      line_example('w205_e30', 'Diagonal · top left to bottom right')]},
        {'id': 'all_to_region', 'label': 'All to region',
         'results': {'dense': 72, 'uniform': 80, 'vlp': 78, 'ours': 100},
         'selection': 'Three different target corners with matched existing DP and dense generated plans; no test-time search.',
         'examples': [region_example('00_w14_e0', 'Bottom left'),
                      region_example('01_w39_e34', 'Bottom right'),
                      region_example('02_w188_e43', 'Top left')]},
        {'id': 'canonical_shape', 'label': 'Canonical shape',
         'results': {'dense': 23, 'uniform': 17, 'vlp': 15, 'ours': 52},
         'selection': 'Three different shape instructions from the existing DP generation evaluation; no test-time search.',
         'examples': [shape_example('01_w321_e18', 'N shape'),
                      shape_example('02_w158_e15', 'Square'),
                      shape_example('03_w306_e5', 'Diamond')]},
    ]
    report_path = PROJECT / 'outputs/line_plan_success/report_sam2.json'
    arms = json.loads(report_path.read_text())['arms']
    for method, key in [('dense', 'dense'), ('uniform', 'evenly'), ('ours', 'ours')]:
        assert arms[key]['n'] == 100
        assert round(100 * arms[key]['success_rate']) == tasks[0]['results'][method]

    for task in tasks:
        for sample in task['examples']:
            paths = sample.pop('paths')
            raw_instruction = (paths['ours'].parent / 'instruction.txt').read_text().strip()
            sample['sourceInstruction'] = raw_instruction
            sample['instruction'] = raw_instruction.replace('""', '"')
            sample['media'] = {}
            for method, path in paths.items():
                if path:
                    if (path.parent / 'instruction.txt').read_text().strip() != raw_instruction:
                        raise ValueError(f'Mismatched instructions: {path}')
                    destination = f"{task['id']}/{sample['episode']}/{method}.mp4"
                    sample['media'][method] = export_video(path, destination, output)
                else:
                    sample['media'][method] = None
            if task['id'] == 'line':
                sample['archivedPlanningSuccess'] = {
                    method: arms[key]['per_plan'][sample['episode']]
                    for method, key in [('ours', 'ours'), ('dense', 'dense'), ('uniform', 'evenly')]
                }

    manifest = {
        'version': 1, 'sourceHost': 'lyg2080',
        'numericalSource': {'paper': '/home/gck/Desktop/DreamCan_ICRA.pdf',
                            'tables': ['II', 'III'], 'lineReport': str(report_path),
                            'evaluationVideosPerTask': 100,
                            'unreported': 'Dense/uniform success rates for all_to_region and canonical_shape are not reported in the supplied manuscript.',
                            'userProvidedResults': {
                                'source': 'User-provided success rates in this conversation.',
                                'all_to_region': {'dense': 72, 'uniform': 80},
                                'canonical_shape': {'dense': 23, 'uniform': 17},
                            }},
        'mediaDescription': 'Existing model-generated planning videos; original frames, resolution and playback rate preserved. These are not robot executions.',
        'missingMedia': 'All VLP videos, all_to_region uniform, and canonical_shape dense/uniform are intentionally left pending.',
        'tasks': tasks,
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Exported {sum(bool(m) for t in tasks for e in t["examples"] for m in e["media"].values())} videos, 9 examples, 3 tasks to {output}')


if __name__ == '__main__':
    main()
