#!/usr/bin/env python3
"""Redraw published DreamCan Figure 7 from documented plotted values.

Requires matplotlib. Input JSON retains recorded means, source-script offsets,
and published series labels; see reproduction_note for evaluation provenance.
"""
import argparse
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=root/'assets/experiments/suite/data/search-figure7.json')
    parser.add_argument('--output', type=Path, default=root/'assets/experiments/suite/figures')
    args = parser.parse_args()
    data = json.loads(args.data.read_text())
    args.output.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':12,'svg.fonttype':'none',
                         'axes.linewidth':.8,'axes.labelcolor':'#202020','text.color':'#202020',
                         'xtick.color':'#202020','ytick.color':'#202020','pdf.fonttype':42})
    fig, ax = plt.subplots(figsize=(7.6,6.8))
    fig.patch.set_facecolor('white'); ax.set_facecolor('white')
    ax.spines[['top','right']].set_visible(False)
    ax.spines[['left','bottom']].set_color('#202020')
    ax.grid(axis='y',color='#202020',alpha=.12,linewidth=.6)
    ax.set_axisbelow(True)
    for series in data['series'].values():
        pts = series['points']
        ax.errorbar([p['calls'] for p in pts],[p['mean'] for p in pts],
                    yerr=[p['sem'] for p in pts],label=series['label'],
                    color=series['color'],marker=series['marker'],linestyle=series['linestyle'],
                    markersize=5,linewidth=1.65,elinewidth=.8,capsize=2.5,capthick=.8,
                    markeredgewidth=.8,zorder=3)
    ax.set_xscale('log',base=2)
    ticks=[1,2,4,8,16,32,48]
    ax.set_xticks(ticks,labels=[str(t) for t in ticks])
    ax.set_xlim(.87,55);ax.set_ylim(.59,.90)
    ax.set_yticks([.60,.65,.70,.75,.80,.85,.90])
    ax.tick_params(direction='out',width=.8,length=4,labelsize=11)
    ax.set_xlabel('Generator calls per episode',labelpad=9)
    ax.set_ylabel('Final task progress',labelpad=9)
    ax.legend(frameon=False,loc='upper center',bbox_to_anchor=(.5,1.22),ncol=2,
              fontsize=10,handlelength=2.4,columnspacing=1.6,handletextpad=.7)
    fig.subplots_adjust(left=.13,right=.98,bottom=.14,top=.79)
    for extension in ['svg','png','pdf']:
        fig.savefig(args.output/f'search-figure7.{extension}',dpi=220,facecolor='white')
    plt.close(fig)

if __name__=='__main__':
    main()
