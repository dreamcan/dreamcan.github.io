#!/usr/bin/env python3
"""Export existing DreamCan experiment evidence and media on lyg2080.

Requires the planning environment (matplotlib, numpy, Pillow, ffmpeg).
--evidence contains the small, verified reports collected from existing runs.
No model training or inference is performed; source files remain read-only.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import zipfile
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

PROJECT = Path('/data/gck/svl_project')
BLUE, ORANGE, GRAY, GREEN = '#4b5fcc', '#bf7636', '#757e89', '#29796a'


def read(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def setup_plot(size=(8.5, 4.6)):
    fig, ax = plt.subplots(figsize=size)
    ax.spines[['top', 'right']].set_visible(False)
    ax.spines[['left', 'bottom']].set_color('#ccd0d7')
    ax.grid(axis='y', color='#e8ebef', linewidth=.7)
    ax.set_axisbelow(True)
    return fig, ax


def save_plot(fig, slug, output):
    fig.tight_layout()
    for extension in ('svg', 'png'):
        fig.savefig(output / 'figures' / f'{slug}.{extension}', dpi=180, bbox_inches='tight')
    plt.close(fig)


def plots(evidence, output):
    plt.rcParams.update({'font.size': 12, 'font.family': 'DejaVu Sans', 'svg.fonttype': 'none'})
    square = read(evidence / 'square_common_policy_recorded_sweep.json')
    fig, ax = setup_plot()
    for key, label, color, marker in [('dp', 'Ours · sparse DP', BLUE, 'o'),
                                     ('evenly', 'Uniform subgoals', ORANGE, '^'),
                                     ('dense', 'Dense video', GRAY, 's')]:
        points = square['methods'][key]
        assert all(p['raw_report']['checkpoint_path'] == square['lower_checkpoint'] for p in points)
        ax.plot([p['N'] for p in points], [100*p['raw_report']['success_rate'] for p in points],
                color=color, marker=marker, linewidth=2, label=label)
    ax.set_xticks(square['N'])
    ax.set_ylim(50, 85)
    ax.set_xlabel('Suboptimal planner demonstrations')
    ax.set_ylabel('Task success rate (%)')
    ax.legend(frameon=False, ncol=3, loc='upper center', fontsize=11)
    save_plot(fig, 'suboptimal-recorded', output)

    search = read(evidence / 'search_recorded_sweep_verified.json')
    fig, ax = setup_plot()
    styles = [('seq', 'Ours · best-of-N', BLUE, 'o'),
              ('subL8', 'Ours · anchored search', GREEN, '^'),
              ('dense', 'Dense · 64 frames', GRAY, 's'),
              ('dense3', 'Dense · 192 frames', ORANGE, 'D')]
    for key, label, color, marker in styles:
        points = search['series'][key]['points']
        assert all(p['sample_count'] == 10 and abs(p['final_pf_mean']-p['recomputed_final_pf_mean'])<1e-10 for p in points)
        x = np.array([p['calls'] for p in points])
        y = np.array([p['recomputed_final_pf_mean'] for p in points])
        error = np.array([p['recomputed_final_pf_sem'] for p in points])
        ax.plot(x, y, marker=marker, linewidth=2, color=color, label=label)
        ax.fill_between(x, y-error, y+error, color=color, alpha=.10, linewidth=0)
    ax.set_xscale('log', base=2)
    ax.set_xticks([1, 2, 4, 8, 16, 32, 48], labels=['1', '2', '4', '8', '16', '32', '48'])
    ax.set_ylim(.48, .92)
    ax.set_xlabel('Generator calls per episode')
    ax.set_ylabel('Final task progress')
    ax.legend(frameon=False, fontsize=11, loc='upper center', bbox_to_anchor=(.5,1.22), ncol=2)
    save_plot(fig, 'search-recorded', output)

    dp = read(evidence / 'subgoal_stage_success_DP.json')
    uniform = read(evidence / 'subgoal_stage_success_evenlyK5.json')
    reach = {'criterion': 'objects_only', 'threshold_cm': 5, 'trials_per_stage': 50, 'tasks': []}
    for key in sorted(dp, key=int):
        item = {'id': int(key)+1, 'instruction': dp[key]['task']}
        for name, source in [('ours', dp), ('uniform', uniform)]:
            stages = list(source[key]['stages'].values())
            assert all(s['trials'] == 50 for s in stages)
            item[name] = float(np.mean([s['objects_only'] for s in stages]))
            item[name+'Stages'] = len(stages)
            item[name+'Trials'] = sum(s['trials'] for s in stages)
        reach['tasks'].append(item)
    reach['oursMean'] = float(np.mean([t['ours'] for t in reach['tasks']]))
    reach['uniformMean'] = float(np.mean([t['uniform'] for t in reach['tasks']]))
    reach['oursTrials'] = sum(t['oursTrials'] for t in reach['tasks'])
    reach['uniformTrials'] = sum(t['uniformTrials'] for t in reach['tasks'])
    (output/'data/reachability-matched.json').write_text(json.dumps(reach, indent=2)+'\n')
    fig, ax = setup_plot((9, 4.5))
    x = np.arange(10)
    ax.bar(x-.18, [100*t['ours'] for t in reach['tasks']], .36, color=BLUE, label='Ours · objects only')
    ax.bar(x+.18, [100*t['uniform'] for t in reach['tasks']], .36, color=ORANGE, label='Uniform · objects only')
    ax.set_xticks(x, [f'T{i+1}' for i in range(10)])
    ax.set_ylim(0, 108)
    ax.set_ylabel('Segment success rate (%)')
    ax.legend(frameon=False, ncol=2, fontsize=11, loc='upper center', bbox_to_anchor=(.5, 1.15))
    save_plot(fig, 'reachability-matched', output)

    summary = read(evidence/'summary.json')
    fig, ax = setup_plot()
    bins = summary['ratio_bins']
    x = np.arange(len(bins))
    for key, label, color, marker in [('dt', 'Elapsed demonstration time', GRAY, 's'),
                                     ('tau_star', 'Shortest-path hitting time', GREEN, 'D'),
                                     ('tau_hat', 'Learned time-to-reach', BLUE, 'o')]:
        vals = np.array([b[key] for b in bins])
        ax.plot(x, vals[:,1], marker=marker, linewidth=2, color=color, label=label)
        ax.fill_between(x, vals[:,0], vals[:,2], alpha=.08, color=color, linewidth=0)
    ax.set_xticks(x, ['≥ .9', '.6–.9', '.4–.6', '.25–.4', '.1–.25', '< .1'])
    ax.set_xlabel('Necessary fraction of elapsed time · more detour →')
    ax.set_ylabel('Steps · median and IQR')
    ax.legend(frameon=False, fontsize=11, loc='upper left')
    save_plot(fig, 'detour-recorded', output)

    counter = read(evidence/'square_reach_skip_ep000103_raw.json')
    fig, ax = setup_plot()
    ax.plot(counter['frames'], counter['reachability'], color=BLUE, linewidth=1.7, label='Learned reachability')
    ax.plot(counter['frames'], counter['time_decay'], color=GRAY, linestyle='--', linewidth=1.7, label='Elapsed-time prior γ^(j−101)')
    for frame, label in [(107, 'Drop'), (208, 'Near-anchor regrasp')]:
        ax.axvline(frame, color='#bdc3cc', linewidth=.9)
        ax.text(frame+2, .05 if frame==107 else .93, label, fontsize=9)
    ax.scatter([208], [counter['at_regrasp']['R']], color=BLUE, s=30, zorder=5)
    ax.set_ylim(0, 1)
    ax.set_xlim(101, 249)
    ax.set_xlabel('Frame j · anchor frame i = 101')
    ax.set_ylabel('Reachability')
    ax.legend(frameon=False, fontsize=11, loc='upper left', bbox_to_anchor=(0, 1.18))
    save_plot(fig, 'regrasp-recorded', output)
    return reach


def media_info(path):
    data = json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0',
        '-show_entries','stream=width,height,nb_frames,r_frame_rate:format=duration','-of','json',str(path)], text=True))
    stream = data['streams'][0]
    n, d = map(int,stream['r_frame_rate'].split('/'))
    return {'width':stream['width'], 'height':stream['height'], 'frameCount':int(stream['nb_frames']),
            'fps':n/d, 'duration':float(data['format']['duration'])}


def export_media(item, output):
    source = Path(item['remote_path'])
    target = output/'videos'/f"{item['id']}.mp4"
    if source.suffix == '.pptx':
        member = item['deck_source'].split(':',1)[1]
        with zipfile.ZipFile(source) as deck: target.write_bytes(deck.read(member))
        source_hash = sha(target)
    else:
        shutil.copyfile(source, target)
        source_hash = sha(source)
    assert sha(target) == source_hash
    poster = output/'images'/f"{item['id']}.webp"
    subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-ss','0.2','-i',str(target),
                    '-frames:v','1','-c:v','libwebp','-quality','85',str(poster)],check=True)
    return {**item, 'video':target.relative_to(output).as_posix(),
            'poster':poster.relative_to(output).as_posix(), 'sha256':source_hash, **media_info(target)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence',type=Path,required=True)
    parser.add_argument('--media-evidence',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    output=args.output.resolve()
    if output==PROJECT or PROJECT in output.parents: parser.error('Export outside the source project, e.g. /tmp/.')
    for directory in ['figures','images','videos','data']: (output/directory).mkdir(parents=True,exist_ok=True)
    for name in ['square_common_policy_recorded_sweep.json','search_recorded_sweep_verified.json',
                 'subgoal_stage_success_DP.json','subgoal_stage_success_evenlyK5.json','summary.json',
                 'square_reach_skip_ep000103_raw.json']:
        shutil.copyfile(args.evidence/name,output/'data'/name)
    reach=plots(args.evidence, output)
    collected=read(args.media_evidence)
    if 'videos' not in collected:
        collected={'videos':list(collected['assets'].values()),
                   'exclude':collected['excluded'],'paper_numbers':collected['paperNumbers']}
    assets={}
    for item in collected['videos']:
        if item['id'] in ('pusht-ours-trial1','square-regrasp'): continue
        assets[item['id']]=export_media(item,output)
    counter_item={'id':'square-regrasp','remote_path':str(PROJECT/'docs/paper/figures/square_reach_skip_ep000103_framenum.mp4'),
                  'type':'simulation demonstration with original frame numbers','notes':['Original Figure 10 example ep_000103; no synthetic frames.']}
    assets[counter_item['id']]=export_media(counter_item,output)
    strips={}
    for episode,length in [('000056',1051),('000064',936),('000226',775)]:
        source=PROJECT/f'ppt_materials/08_square_worse_demos_dp/ep_{episode}_worse_len{length}_dp_subgoals.png'
        target=output/'images'/f'square-dp-{episode}.png'
        shutil.copyfile(source,target)
        strips[episode]={'image':target.relative_to(output).as_posix(),'source':str(source),'sha256':sha(source)}
    manifest={'version':1,'sourceHost':'lyg2080','numericalPolicy':'Standalone figures use unshifted archived reports; paper-only tables are explicitly identified in HTML.',
              'assets':assets,'strips':strips,'excluded':collected['exclude'],
              'reachability':reach, 'paperNumbers':collected['paper_numbers']}
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'Exported {len(assets)} existing videos, {len(strips)} subgoal strips and five unshifted scientific plots to {output}',flush=True)


if __name__=='__main__': main()
