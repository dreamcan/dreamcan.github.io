#!/usr/bin/env python3
"""Replot the published Figure 5 and export a skill-labelled Square demonstration.

Run on lyg2080 in the planning environment; all source files are read-only.
The plotted series deliberately reproduce the manuscript figure, including its
Uniform centre adjustment and original uncertainty, rather than raw evaluations.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    out = args.output.resolve()
    if out.exists():
        raise FileExistsError(out)
    project = Path('/data/gck/svl_project')
    if out == project or project in out.parents:
        parser.error('Choose a new directory outside the source project.')
    for folder in ['figures', 'data', 'videos', 'images']:
        (out / folder).mkdir(parents=True, exist_ok=True)
    import h5py
    import imageio.v2 as imageio
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import numpy as np

    source_script = project / 'docs/paper/fig_square_scaling.py'
    constants = {}
    for node in ast.parse(source_script.read_text()).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name.startswith('FIXED_') or name == 'N_ALL':
                constants[name] = ast.literal_eval(node.value)
    n_values = constants['N_ALL']
    assert n_values == [5, 10, 20, 40, 80, 120, 160, 200]
    series = []
    for key, label, adjustment, color, marker, line in [
        ('DP', 'DreamCan (Ours)', 0.0, '#8C1515', 'o', '-'),
        ('EVENLY', 'Uniform', -.05, '#737373', '^', '--'),
        ('DENSE', 'Dense', 0.0, '#1565C0', 's', '-.'),
    ]:
        raw = np.array(constants['FIXED_' + key], dtype=float)
        trials = constants['FIXED_' + key + '_N']
        series.append({'method': label, 'figureRatesPercent': (100 * (raw + adjustment)).tolist(),
                       'figureErrorPercent': (100 * np.sqrt(raw * (1 - raw) / trials)).tolist(),
                       'scriptRates': raw.tolist(), 'scriptAdjustment': adjustment,
                       'trialsPerPointInScript': trials, 'color': color, 'marker': marker, 'line': line})
    data = {'source': 'DreamCan_ICRA.pdf, Figure 5 (published curves)',
            'sourceScript': str(source_script), 'sourceScriptSha256': digest(source_script),
            'numSuboptimalVideos': n_values, 'series': series,
            'provenanceNote': (
                'Reproduces Figure 5 as published. The source script subtracts 0.05 from Uniform '
                'centres, retaining its original binomial standard errors. The source script '
                'also records distinct controller training sets for DP and the two baselines. '
                'This figure is not the unadjusted common-controller evaluation previously shown.')}
    (out / 'data/suboptimal-figure5.json').write_text(json.dumps(data, indent=2) + '\n')
    shutil.copyfile(source_script, out / 'data/figure5-source-script.py')
    plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 13,
                         'axes.labelsize': 14, 'xtick.labelsize': 12, 'ytick.labelsize': 12,
                         'text.color': '#202020', 'axes.labelcolor': '#202020',
                         'xtick.color': '#202020', 'ytick.color': '#202020',
                         'axes.linewidth': .85, 'svg.fonttype': 'none',
                         'savefig.facecolor': 'white'})
    fig, ax = plt.subplots(figsize=(6.8, 7.6))
    for item in series:
        ax.errorbar(n_values, item['figureRatesPercent'], yerr=item['figureErrorPercent'],
                    label=item['method'], color=item['color'], marker=item['marker'],
                    linestyle=item['line'], linewidth=2.3 if item['method'].startswith('DreamCan') else 1.8,
                    markersize=6, markeredgewidth=.7, markeredgecolor='white',
                    capsize=3, capthick=.85, elinewidth=.85, zorder=3)
    ax.set_xscale('log', base=2)
    ax.set_xlim(4.2, 240)
    ax.set_ylim(40, 76)
    ax.set_xticks(n_values, [str(n) for n in n_values], rotation=45, ha='right')
    ax.set_yticks(np.arange(40, 76, 5))
    ax.minorticks_off()
    ax.set_xlabel('Number of suboptimal videos $N$', labelpad=12)
    ax.set_ylabel('Task success rate (%)', labelpad=10)
    ax.grid(axis='y', color='#e4e4e4', linewidth=.65)
    ax.set_axisbelow(True)
    ax.tick_params(length=4, width=.8, pad=6)
    for side in ['top', 'right']:
        ax.spines[side].set_visible(False)
    for side in ['bottom', 'left']:
        ax.spines[side].set_color('#202020')
    ax.legend(loc='lower left', bbox_to_anchor=(0, 1.02, 1, .1), mode='expand',
              ncol=3, borderaxespad=0, frameon=False, fontsize=11.5,
              handlelength=2, handletextpad=.55, columnspacing=1)
    fig.subplots_adjust(left=.14, right=.98, bottom=.18, top=.89)
    for extension in ['svg', 'png']:
        fig.savefig(out / ('figures/suboptimal-figure5.' + extension), dpi=180)
    plt.close(fig)

    hdf5 = project / 'robomimic/hdf5/Square.h5'
    with h5py.File(hdf5, 'r') as f:
        episode = f['episodes/ep_000000']
        assert episode.attrs['operator_quality'] == 'better'
        frames = episode['image'][:]
        instruction = str(episode.attrs['language_instruction'])
        source_demo = str(episode.attrs['source_demo'])
    assert frames.shape == (127, 256, 256, 3)
    video = out / 'videos/square-better-0.mp4'
    imageio.mimwrite(video, frames, fps=20, quality=8)
    poster = out / 'images/square-better-0.webp'
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-frames:v', '1',
                    '-c:v', 'libwebp', '-quality', '85', str(poster)], check=True)
    asset = {'id': 'square-better-0', 'remote_host': 'lyg2080',
             'remote_path': str(video),
             'sourceFrames': str(hdf5) + '::episodes/ep_000000/image',
             'type': 'proficient simulation demonstration', 'quality': 'better',
             'instruction': instruction, 'episode': 'ep_000000', 'sourceDemo': source_demo,
             'video': 'videos/square-better-0.mp4', 'poster': 'images/square-better-0.webp',
             'width': 256, 'height': 256, 'fps': 20, 'frameCount': len(frames),
             'duration': len(frames) / 20, 'sha256': digest(video),
             'sourcePixelsSha256': hashlib.sha256(frames.tobytes()).hexdigest(),
             'notes': ['Source operator_quality is better; preserves all frames.',
                       '20 fps matches the existing worse demonstration presentation.']}
    (out / 'data/square-better-0-source.json').write_text(json.dumps(asset, indent=2) + '\n')
    print('Exported published Figure 5 values, academic SVG/PNG, and skill-verified Better demo.')


if __name__ == '__main__':
    main()
