#!/usr/bin/env python3
"""Verify a paired-media export and build the two simulation rows in the website."""
import argparse
import hashlib
from html import escape
import json
import re
from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parents[1]
def attr(value):return escape(str(value),quote=True)
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);args=p.parse_args();source=args.source
    m=json.loads((source/'manifest.json').read_text());assert len(m['groups']['pusht'])==3 and len(m['groups']['libero'])==10
    assert [x['taskId']for x in m['groups']['libero']]==list(range(10))
    for entries in m['groups'].values():
        for e in entries:
            a,b=e['execution'],e['planner']
            assert a['frameCount']==b['frameCount'] and abs(a['duration']-b['duration'])<.001 and a['fps']==b['fps']
            assert b['width']==e['numSubgoals']*b['height']
            for asset in [a,b]:
                assert hashlib.sha256((source/asset['video']).read_bytes()).hexdigest()==asset['sha256']
                assert (source/asset['poster']).is_file()
    destination=ROOT/'assets/experiments/suite/simulation';shutil.copytree(source,destination,dirs_exist_ok=True)
    base='assets/experiments/suite/simulation/'
    html=['      <div class="exp-policy-simulation" data-policy-simulation>','        <h3>Planning and execution in simulation</h3>']
    for group,title in [('pusht','PushT'),('libero','LIBERO-Long')]:
        entries=m['groups'][group];first=entries[0];count=first['numSubgoals']
        html+=['        <section class="sim-task-row sim-'+group+'" data-sim-group="'+group+'" aria-label="'+title+' planning and execution">','          <div class="sim-task-head"><h4>'+title+'</h4><div class="exp-choices sim-choices" role="group" aria-label="'+title+' trajectories">']
        for i,e in enumerate(entries):
            attrs={'data-sim-choice':i,'aria-pressed':'true'if i==0 else 'false','data-execution-src':base+e['execution']['video'],'data-planner-src':base+e['planner']['video'],'data-execution-poster':base+e['execution']['poster'],'data-planner-poster':base+e['planner']['poster'],'data-instruction':e['instruction'],'data-result':'success'if e['success']else'failure','title':e['instruction']}
            html+=['            <button type="button" '+' '.join(k+'="'+attr(v)+'"'for k,v in attrs.items())+'>'+attr(e['label'])+'</button>']
        result='success'if first['success']else'failure'
        html+=['          </div></div>','          <div class="sim-instruction"><p data-sim-instruction>'+attr(first['instruction'])+'</p><span class="sim-outcome" data-sim-outcome data-result="'+result+'">'+('Completed'if first['success']else'Not completed')+'</span></div>','          <div class="sim-media-pair">']
        for view,title_ in [('execution','Execution'),('planner','Planner output')]:
            a=first[view];html+=['            <figure class="exp-figure sim-'+view+'"><h5>'+title_+'</h5>']
            if view=='planner':html+=['              <div class="sim-planner-scroll" tabindex="0" role="region" aria-label="'+title+' generated subgoal sequence"><div class="sim-planner-strip">']
            html+=['              <video class="exp-video" data-exp-video data-sim-'+view+' data-exp-src="'+base+a['video']+'" poster="'+base+a['poster']+'" style="aspect-ratio:'+str(a['width'])+' / '+str(a['height'])+'" muted autoplay loop playsinline '+('controls 'if view=='execution'else'')+'preload="none" aria-label="'+title+' '+title_.lower()+'"></video>']
            if view=='planner':html+=['                <div class="sim-subgoal-labels" style="--subgoal-count:'+str(count)+'" aria-hidden="true">'+''.join('<span>'+str(i+1)+'</span>'for i in range(count))+'</div>','              </div></div>']
            html+=['            </figure>']
        html+=['          </div>','        </section>']
    html+=['      </div>']
    p=ROOT/'index.html';s=p.read_text();start=s.index('      <div class="exp-gallery" data-exp-gallery="policy"');end=s.index('\n    </div>\n  </div>',start);s=s[:start]+'\n'.join(html)+s[end:]
    if 'src="policy-simulation.js'not in s:s=s.replace('<script src="experiments.js', '<script src="policy-simulation.js?v=20261012-paired-rollouts"></script>\n<script src="experiments.js')
    # Select handlers run first; the shared observer manages visibility and source changes.
    s=re.sub(r'experiments\.css\?v=[^"]+', 'experiments.css?v=20261012-paired-rollouts', s)
    s=re.sub(r'experiments\.js\?v=[^"]+', 'experiments.js?v=20261012-paired-rollouts', s)
    p.write_text(s)
    print('Imported and verified 13 paired rollouts; built two independent task rows.')
if __name__=='__main__':main()
