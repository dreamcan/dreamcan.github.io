#!/usr/bin/env python3
"""Paper-style Figure 8: per-task distributions of segment success rates.

Preserves the original published selection of success channels; the input JSON
records source SHA-256, stages, trial counts and the two different criteria.
"""
import argparse,json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

def main():
    root=Path(__file__).resolve().parents[1]
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--data',type=Path,default=root/'assets/experiments/suite/data/reachability-figure8.json')
    p.add_argument('--output',type=Path,default=root/'assets/experiments/suite/figures')
    args=p.parse_args();data=json.loads(args.data.read_text());args.output.mkdir(parents=True,exist_ok=True)
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'svg.fonttype':'none','pdf.fonttype':42,'text.color':'#202020','axes.labelcolor':'#202020','axes.linewidth':.8})
    fig,axes=plt.subplots(2,1,figsize=(8.8,7.6),sharex=True)
    for ax,panel in zip(axes,data['panels']):
        color=panel['color'];vals=[np.array([s['rate'] for s in t['stages']]) for t in panel['tasks']];xs=np.arange(1,11);means=[v.mean() for v in vals]
        nonconstant=[i for i,v in enumerate(vals) if v.std()>1e-9]
        parts=ax.violinplot([vals[i] for i in nonconstant],positions=xs[nonconstant],widths=.78,showmeans=False,showextrema=False,bw_method=.55)
        for b in parts['bodies']:b.set_facecolor(color);b.set_edgecolor(color);b.set_alpha(.20);b.set_linewidth(.8)
        ax.boxplot(vals,positions=xs,widths=.16,showfliers=False,patch_artist=True,medianprops={'color':'white','linewidth':1.1},whiskerprops={'color':color,'linewidth':.8},capprops={'color':color,'linewidth':.8},boxprops={'facecolor':color,'edgecolor':color,'linewidth':.8,'alpha':.85})
        rng=np.random.default_rng(0)
        for x,v in zip(xs,vals):ax.scatter(x+rng.uniform(-.13,.13,len(v)),v,s=10,color='#202020',alpha=.45,linewidths=0,zorder=4)
        ax.scatter(xs,means,marker='D',s=28,color=color,edgecolor='white',linewidth=.8,zorder=5)
        for x,mean,v in zip(xs,means,vals):ax.text(x,v.min()-.045,f'{mean:.2f}',ha='center',va='top',fontsize=9,color='#202020')
        ax.axhline(panel['mean'],color='#737373',linestyle=(0,(4,3)),linewidth=.9,zorder=1)
        ax.set_title(panel['label'],loc='left',color=color,fontsize=12,fontweight='medium',pad=9)
        ax.set_title(f"Mean {panel['mean']:.2f}",loc='right',color='#202020',fontsize=11,pad=9)
        ax.set_yticks(np.arange(.4,1.001,.1));ax.set_ylim(.4,1.04);ax.set_xlim(.4,10.6)
        ax.set_ylabel('Segment success rate');ax.grid(axis='y',color='#202020',alpha=.12,linewidth=.6);ax.set_axisbelow(True)
        ax.spines[['top','right']].set_visible(False);ax.spines['left'].set_bounds(.4,1)
        ax.tick_params(direction='out',length=3,width=.8,labelsize=10)
    axes[-1].set_xticks(np.arange(1,11),labels=[f'T{i}' for i in range(1,11)])
    axes[-1].set_xlabel('LIBERO-Long task',labelpad=8)
    fig.subplots_adjust(left=.10,right=.98,bottom=.10,top=.93,hspace=.30)
    for ext in ['svg','png','pdf']:fig.savefig(args.output/f'reachability-figure8.{ext}',dpi=220,facecolor='white')
    plt.close(fig)
if __name__=='__main__':main()
