#!/usr/bin/env python3
"""Redraw Table III policy scaling results in the scatter format of Figure 1.

Run with matplotlib/numpy installed. Values are manuscript aggregates, not new evals.
"""
import argparse
import json
from pathlib import Path

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    out=parser.parse_args().output
    for name in ['figures','data']:(out/name).mkdir(parents=True,exist_ok=True)
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.lines import Line2D
    data={'source':'DreamCan_ICRA.pdf, Table III','plotFormat':'Figure 1 top-right: success rate vs trainable policy parameters on a logarithmic axis','parameterScope':'DreamCan uses the reported 0.1B low-level policy size; excludes its pretrained video planner and frozen encoders. Other parameter sizes reproduce Table III.','evaluationSource':'PushT VLA/WAM results were evaluated by the authors; LIBERO-Long VLA/WAM rates are cited from their original papers in Table III.','methods':[
        {'name':'DreamCan (Ours)','paramsB':.1,'PushT':86.0,'LIBERO-Long':91.2,'category':'Ours'},
        {'name':'VLA-OS','paramsB':.9,'PushT':72.0,'LIBERO-Long':76.0,'category':'Hierarchical visual planner'},
        {'name':'SEER','paramsB':.3,'PushT':68.0,'LIBERO-Long':87.7,'category':'World-action model'},
        {'name':'π0','paramsB':3.3,'PushT':76.0,'LIBERO-Long':85.2,'category':'End-to-end VLA'},
        {'name':'π0.5','paramsB':3.3,'PushT':86.0,'LIBERO-Long':92.4,'category':'End-to-end VLA'},
        {'name':'Lingbot-VA','paramsB':5.3,'PushT':89.0,'LIBERO-Long':98.5,'category':'World-action model'}],
        'planningTables':{'PushT':{'E2E':58.0,'Dense':70.0,'Uniform':72.0,'DreamCan (Ours)':86.0},'LIBERO-Long':{'E2E':79.2,'Dense':84.0,'Uniform':82.4,'DreamCan (Ours)':91.2}}}
    (out/'data/low-level-results.json').write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':12,'axes.labelsize':13,'xtick.labelsize':12,'ytick.labelsize':12,'axes.labelcolor':'#202020','text.color':'#202020','svg.fonttype':'none','savefig.facecolor':'white'})
    colors={'Ours':'#8C1515','Hierarchical visual planner':'#737373','End-to-end VLA':'#1565C0','World-action model':'#202020'}
    offsets={'DreamCan (Ours)':(11,0),'VLA-OS':(0,-19),'SEER':(0,12),'π0':(-9,-15),'π0.5':(-9,10),'Lingbot-VA':(-8,10)}
    for task,stem in [('PushT','pusht'),('LIBERO-Long','libero-long')]:
        fig,ax=plt.subplots(figsize=(6.4,4.5))
        for method in data['methods']:
            ours=method['category']=='Ours';c=colors[method['category']]
            ax.scatter(method['paramsB'],method[task],s=220 if ours else 86,marker='*' if ours else 'o',c=c,edgecolors='white',linewidths=.8,zorder=4)
            dx,dy=offsets[method['name']]
            if method['name']=='Lingbot-VA':
                dx,dy=(-12,0) if task=='LIBERO-Long' else (-8,22)
            if method['name']=='SEER' and task=='LIBERO-Long':dy=-16
            if method['name']=='π0.5' and task=='LIBERO-Long':dx,dy=-12,-12
            ax.annotate('DreamCan (Ours)' if ours else method['name'],(method['paramsB'],method[task]),xytext=(dx,dy),textcoords='offset points',ha='left' if ours else ('right' if dx<0 else 'center'),va='center',fontsize=12.5,fontweight='semibold' if ours else 'normal',color=c)
        ax.set_xscale('log');ax.set_xlim(.055,10);ax.set_ylim(30,103)
        ax.set_xticks([.1,1,10],['100M','1B','10B']);ax.minorticks_off();ax.set_yticks([30,40,50,60,70,80,90,100])
        ax.set_xlabel('Trainable policy parameters',labelpad=10);ax.set_ylabel('Task success rate (%)',labelpad=10)
        ax.grid(color='#e4e4e4',linewidth=.7);ax.set_axisbelow(True);ax.tick_params(length=4,width=.8,pad=6)
        for side in ['top','right']:ax.spines[side].set_visible(False)
        for side in ['left','bottom']:ax.spines[side].set_color('#202020');ax.spines[side].set_linewidth(.8)
        handles=[Line2D([],[],color=colors[k],marker='*' if k=='Ours' else 'o',linestyle='None',markersize=11 if k=='Ours' else 7,label=k)for k in colors]
        ax.legend(handles=handles,loc='upper center',bbox_to_anchor=(.5,-.22),ncol=2,frameon=False,fontsize=10.5,columnspacing=1.2,handletextpad=.4)
        fig.subplots_adjust(left=.14,right=.97,bottom=.28,top=.96)
        for ext in ['svg','png']:fig.savefig(out/f'figures/policy-{stem}-scaling.{ext}',dpi=180)
        plt.close(fig)
    print('Exported two policy scaling plots and manuscript source data.')
if __name__=='__main__':main()
