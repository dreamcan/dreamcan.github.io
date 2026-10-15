#!/usr/bin/env python3
"""Index the aligned value galleries for the browser DP explorer; copy no assets."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMES = {'libero-long': 'LIBERO-Long', 'pusht': 'PushT',
         'language-table': 'Language Table', 'square': 'Square'}


def build():
    reach_path = ROOT / 'assets/reachability/manifest.json'
    utility_path = ROOT / 'assets/utility/manifest.json'
    reach = json.loads(reach_path.read_text())
    utility = json.loads(utility_path.read_text())
    utilities = {row['id']: row for task in utility['tasks'] for row in task['trajectories']}
    manifest = {
        'version': 1,
        'defaultTrajectory': 'libero-long-ep_000027',
        'defaults': {'k': 4, 'wr': 0.5, 'wg': 2, 'ws': 1, 'epsilon': 0.02,
                     'gapFraction': 0.06, 'minimumGap': 8},
        'tasks': [],
        'sources': {
            'paper': 'DreamCan_ICRA.pdf, §IV-C, Eqs. (4)–(5), Fig. 3',
            'methodFigure': '/data/gck/svl_project/docs/paper/fig_method_dp.py',
            'candidateCurves': '/data/gck/svl_project/docs/paper/fig_frame0_selection_curves.py',
            'materials': '/data/gck/svl_project/ppt_materials/README.md',
            'valuePrecision': 'Reachability retains the existing five-decimal cache export; '
                              'utility retains its source annotations.',
            'reachabilityManifestSha256': hashlib.sha256(reach_path.read_bytes()).hexdigest(),
            'utilityManifestSha256': hashlib.sha256(utility_path.read_bytes()).hexdigest(),
        },
    }
    for task in reach['tasks']:
        rows = []
        for row in task['trajectories']:
            progress = utilities[row['id']]
            if row['frameCount'] != progress['frameCount'] or row['instruction'] != progress['instruction']:
                raise ValueError(f"Video/value alignment mismatch: {row['id']}")
            record = {key: row[key] for key in ['id', 'label', 'instruction', 'frameCount',
                                               'width', 'height', 'atlasColumns', 'atlasRows']}
            record.update({
                'atlas': '../reachability/' + row['atlas'],
                'reachability': '../reachability/' + row['curves'],
                'utility': '../utility/' + progress['values'],
                'sampledFrames': [round(i * (row['frameCount'] - 1) / 14) for i in range(15)],
            })
            for key in ['category', 'categoryLabel']:
                if key in row:
                    record[key] = row[key]
            for key in ['atlas', 'reachability', 'utility']:
                if not (ROOT / 'assets/dp' / record[key]).is_file():
                    raise FileNotFoundError(record[key])
            rows.append(record)
        manifest['tasks'].append({'id': task['id'], 'label': NAMES[task['id']], 'trajectories': rows})
    if manifest['defaultTrajectory'] not in utilities:
        raise ValueError('The paper method example is missing.')
    output = ROOT / 'assets/dp/manifest.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f"Indexed {sum(len(task['trajectories']) for task in manifest['tasks'])} aligned trajectories.")


if __name__ == '__main__':
    build()
