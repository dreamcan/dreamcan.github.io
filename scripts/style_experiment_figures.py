#!/usr/bin/env python3
"""Unify published experiment figures without changing numerical inputs."""
import argparse,json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

RED,BLUE,INK,GRAY='#8c1515','#1565c0','#202020','#737373'

def style(ax):
    ax.set_facecolor('white');ax.spines[['top','right']].set_visible(False)
    for side in ['left','bottom']:ax.spines[side].set_color(INK);ax.spines[side].set_linewidth(.8)
    ax.grid(axis='y',color=INK,alpha=.12,linewidth=.6);ax.set_axisbelow(True)
    ax.tick_params(direction='out',length=4,width=.8,labelsize=11)

def save(fig,out,stem):
    for ext in ['svg','png','pdf']:fig.savefig(out/f'{stem}.{ext}',dpi=220,facecolor='white')
    plt.close(fig)

def main():
    root=Path(__file__).resolve().parents[1]
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--data',type=Path,default=root/'assets/experiments/suite/data');p.add_argument('--output',type=Path,default=root/'assets/experiments/suite/figures');args=p.parse_args();out=args.output;out.mkdir(parents=True,exist_ok=True)
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':12,'axes.labelsize':12,'svg.fonttype':'none','pdf.fonttype':42,'text.color':INK,'axes.labelcolor':INK,'xtick.color':INK,'ytick.color':INK,'axes.linewidth':.8})
    read=lambda name:json.loads((args.data/name).read_text())
    data=read('suboptimal-figure5.json');fig,ax=plt.subplots(figsize=(6.8,7.6));style(ax)
    for item in data['series']:
        color=RED if item['method'].startswith('DreamCan') else BLUE if item['method']=='Dense' else GRAY
        ax.errorbar(data['numSuboptimalVideos'],item['figureRatesPercent'],yerr=item['figureErrorPercent'],label=item['method'],color=color,marker=item['marker'],linestyle=item['line'],linewidth=1.65,markersize=5,markeredgecolor='white',markeredgewidth=.7,capsize=2.5,capthick=.8,elinewidth=.8)
    ax.set_xscale('log',base=2);ax.set_xlim(4.2,240);ax.set_ylim(40,76);ax.set_xticks(data['numSuboptimalVideos'],labels=[str(n) for n in data['numSuboptimalVideos']],rotation=45,ha='right');ax.set_yticks(range(40,76,5));ax.minorticks_off();ax.set_xlabel('Number of suboptimal videos $N$',labelpad=10);ax.set_ylabel('Task success rate (%)',labelpad=9)
    ax.legend(loc='lower left',bbox_to_anchor=(0,1.02,1,.1),mode='expand',ncol=3,frameon=False,fontsize=11,handlelength=2,handletextpad=.55,columnspacing=1,borderaxespad=0)
    fig.subplots_adjust(left=.14,right=.98,bottom=.18,top=.89);save(fig,out,'suboptimal-figure5')
    data=read('low-level-results.json');colors={'Ours':RED,'Hierarchical visual planner':INK,'End-to-end VLA':BLUE,'World-action model':GRAY};markers={'Ours':'*','Hierarchical visual planner':'D','End-to-end VLA':'o','World-action model':'s'}
    offsets={'DreamCan (Ours)':(11,0),'VLA-OS':(0,-19),'SEER':(0,12),'π0':(-9,-15),'π0.5':(-9,10),'Lingbot-VA':(-8,10)}
    for task,stem in [('PushT','pusht'),('LIBERO-Long','libero-long')]:
        fig,ax=plt.subplots(figsize=(6.4,4.5));style(ax)
        for method in data['methods']:
            ours=method['category']=='Ours';color=colors[method['category']];dx,dy=offsets[method['name']]
            if method['name']=='Lingbot-VA':dx,dy=(-12,0) if task=='LIBERO-Long' else (-8,22)
            if method['name']=='SEER' and task=='LIBERO-Long':dy=-16
            if method['name']=='π0.5' and task=='LIBERO-Long':dx,dy=-12,-12
            ax.scatter(method['paramsB'],method[task],s=220 if ours else 86,marker=markers[method['category']],c=color,edgecolors='white',linewidths=.8,zorder=4)
            ax.annotate(method['name'],(method['paramsB'],method[task]),xytext=(dx,dy),textcoords='offset points',ha='left' if ours else ('right' if dx<0 else 'center'),va='center',fontsize=12,fontweight='semibold' if ours else 'normal',color=color)
        ax.set_xscale('log');ax.set_xlim(.055,10);ax.set_ylim(30,103);ax.set_xticks([.1,1,10],labels=['100M','1B','10B']);ax.minorticks_off();ax.set_yticks(range(30,101,10));ax.set_xlabel('Trainable policy parameters',labelpad=9);ax.set_ylabel('Task success rate (%)',labelpad=9)
        handles=[Line2D([],[],color=colors[k],marker=markers[k],linestyle='None',markersize=11 if k=='Ours' else 7,label=k) for k in colors]
        ax.legend(handles=handles,loc='upper center',bbox_to_anchor=(.5,-.22),ncol=2,frameon=False,fontsize=10.5,columnspacing=1.2,handletextpad=.4);fig.subplots_adjust(left=.14,right=.97,bottom=.28,top=.96);save(fig,out,f'policy-{stem}-scaling')
    data=read('square_reach_skip_ep000103_raw.json');fig,ax=plt.subplots(figsize=(6.4,6.7));style(ax)
    ax.plot(data['frames'],data['reachability'],color=RED,linewidth=1.65,label='Learned reachability')
    ax.plot(data['frames'],data['time_decay'],color=BLUE,linewidth=1.65,linestyle='--',label='Elapsed-time prior')
    for frame,label in [(107,'Drop'),(208,'Regrasp')]:
        ax.axvline(frame,color=GRAY,alpha=.55,linewidth=.8,linestyle=':');ax.text(frame+2,.05 if frame==107 else .93,label,fontsize=10,color=INK)
    ax.scatter([208],[data['at_regrasp']['R']],color=RED,s=28,zorder=5)
    ax.set_ylim(0,1.02);ax.set_xlabel('Source trajectory frame',labelpad=9);ax.set_ylabel('Reachability $R$',labelpad=9)
    ax.legend(frameon=False,loc='upper center',bbox_to_anchor=(.5,1.13),ncol=2,fontsize=11);fig.subplots_adjust(left=.14,right=.98,bottom=.12,top=.87);save(fig,out,'regrasp-recorded')
if __name__=='__main__':main()
