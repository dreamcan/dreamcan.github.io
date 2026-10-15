#!/usr/bin/env python3
"""Export genuine utility annotations for the website's selected trajectories.

Run in lyg2080's planning environment. Read source progress and value caches;
write only to --output. Reuse the existing reachability frame atlases.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
from pathlib import Path

import numpy as np

PROJECT = Path('/data/gck/svl_project')
PROGRESS_FILES = {
    'libero-long': PROJECT / 'data/LIBERO_Long_Robometer_task_progress.json',
    'pusht': PROJECT / 'data/pusht_robometer_progress/PushT_Robometer_task_progress.json',
    'square': Path('/mnt4/gck/gck_square/robometer_progress/Square_Robometer_task_progress.json'),
}
NORMALIZER = PROJECT / 'tools/planning/run_value_progress_keyframe_dp_experiment.py'


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def robometer_normalizer():
    # Execute only these two pure numpy functions from the actual DP annotator.
    tree = ast.parse(NORMALIZER.read_text())
    nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef)
             and node.name in {'_moving_avg', 'normalize_progress'}]
    assert len(nodes) == 2
    namespace = {'np': np}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(NORMALIZER), 'exec'), namespace)
    return namespace['normalize_progress']


def export(input_manifest: Path, output: Path) -> None:
    manifest = json.loads(input_manifest.read_text())
    normalize = robometer_normalizer()
    sources = {key: json.loads(path.read_text()) for key, path in PROGRESS_FILES.items()}
    source_hashes = {key: sha256(path) for key, path in PROGRESS_FILES.items()}
    output.mkdir(parents=True, exist_ok=True)
    result = {'version': 1, 'valueKind': 'task utility annotation', 'tasks': [],
              'source': 'Existing RoboMeter progress predictions and VLM+SAM spatial progress caches',
              'sourceReachabilityManifestSha256': sha256(input_manifest)}
    frame_total = 0
    for task in manifest['tasks']:
        task_id = task['id']
        exported = {key: value for key, value in task.items() if key != 'trajectories'}
        exported['trajectories'] = []
        for row in task['trajectories']:
            count = row['frameCount']
            folder = output / row['id']
            folder.mkdir(exist_ok=True)
            if task_id == 'language-table':
                source = Path(row['provenance']['valueCache'])
                with np.load(source, allow_pickle=False) as cache:
                    raw = cache['progress_raw'].astype(np.float64)
                    utility = cache['progress_search'].astype(np.float64)
                    assert str(cache['episode_id']) == row['episode']
                    assert str(cache['goal']) == row['instruction']
                    # These cached DP annotation scores already include smoothing,
                    # anchored normalization and a running maximum. Keep them exact.
                    assert np.all(np.diff(utility) >= -1e-7)
                    provenance = {'progressSource': str(source), 'sourceSha256': sha256(source),
                                  'rawField': 'progress_raw', 'utilityField': 'progress_search',
                                  'postprocessing': 'Original cached DP utility, unchanged',
                                  'method': 'VLM + SAM', 'smoothWindow': int(cache['smooth_window'])}
            else:
                matches = [item for item in sources[task_id]['trajectories']
                           if item['episode'] == row['episode'] and item['language'] == row['instruction']]
                assert len(matches) == 1, (task_id, row['episode'], len(matches))
                record = matches[0]
                assert record['source_num_frames'] == count and record['progress_length'] == count
                raw = np.asarray(record['progress'], dtype=np.float64)
                # Never substitute a timeline ramp for missing or constant predictions.
                assert np.isfinite(raw).all() and np.ptp(raw) > 1e-8
                utility = normalize(raw, 'mono')
                (folder / 'source-progress.json').write_text(json.dumps(record, separators=(',', ':'), allow_nan=False))
                provenance = {'progressSource': str(PROGRESS_FILES[task_id]),
                              'sourceSha256': source_hashes[task_id], 'sourceRecord': record['trajectory_id'],
                              'rawField': 'progress', 'method': 'RoboMeter',
                              'modelPath': sources[task_id].get('model_path'),
                              'postprocessing': "normalize_progress(progress, 'mono') from the source DP annotator",
                              'normalizerSource': str(NORMALIZER), 'normalizerSha256': sha256(NORMALIZER),
                              'smoothWindow': 7}
            assert raw.shape == utility.shape == (count,)
            assert np.isfinite(raw).all() and np.isfinite(utility).all()
            assert np.ptp(raw) > 1e-8, (row['id'], 'Constant progress predictions')
            assert np.all((utility >= 0) & (utility <= 1)) and np.all(np.diff(utility) >= -1e-7)
            values = {'version': 1, 'id': row['id'], 'frameCount': count,
                      'rawProgress': raw.tolist(), 'utility': utility.tolist(), 'provenance': provenance}
            (folder / 'utility.json').write_text(json.dumps(values, separators=(',', ':'), allow_nan=False))
            entry = {key: value for key, value in row.items()
                     if key not in {'curves', 'video', 'sourceValues', 'provenance'}}
            entry['atlas'] = '../reachability/' + row['atlas']
            entry['values'] = row['id'] + '/utility.json'
            entry['method'] = provenance['method']
            exported['trajectories'].append(entry)
            frame_total += count
            print('Exported', row['id'], count, 'utility values;', provenance['method'], flush=True)
        result['tasks'].append(exported)
    result['totalTrajectories'] = sum(len(task['trajectories']) for task in result['tasks'])
    result['totalFrameValues'] = frame_total
    (output / 'manifest.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    hashes = {str(path.relative_to(output)): sha256(path) for path in output.rglob('*')
              if path.is_file() and path.name != 'validation.json'}
    (output / 'validation.json').write_text(json.dumps({'trajectories': result['totalTrajectories'],
                                                      'frameValues': frame_total, 'sha256': hashes}, indent=2))
    print('Complete:', result['totalTrajectories'], 'trajectories,', frame_total, 'real utility annotations', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    export(args.manifest.resolve(), args.output.resolve())
