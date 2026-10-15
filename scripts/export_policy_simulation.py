#!/usr/bin/env python3
"""Export paired execution/planner videos, keeping rollout frames and timing aligned.

PushT uses three archived sparse-planner rollouts. LIBERO uses a newly recorded,
complete ten-task evaluation with a one-row layout of all actual generated subgoals.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import subprocess
import shutil
import time

PROJECT=Path('/data/gck/svl_project')
PUSHT_RUN=PROJECT/'eval/flow_goal_radio_wan_pusht/goal_step_200000_resume_20260907_075324_20260907_131354'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()
def probe(path):
    d=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,avg_frame_rate,nb_read_frames,duration','-of','json',str(path)]))['streams'][0]
    top,bot=map(int,d['avg_frame_rate'].split('/'))
    return {'width':d['width'],'height':d['height'],'fps':top/bot,'frameCount':int(d['nb_read_frames']),'duration':float(d['duration'])}
def render(source,target,filter_=None):
    if target.exists():raise FileExistsError(target)
    cmd=['ffmpeg','-v','error','-i',str(source),'-an']
    if filter_:cmd+=['-vf',filter_,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p']
    else:cmd+=['-c:v','copy']
    subprocess.run(cmd+['-movflags','+faststart',str(target)],check=True)
def asset(out,stem,source,filter_=None):
    v=out/'videos'/f'{stem}.mp4';render(source,v,filter_)
    info=probe(v);poster=out/'images'/f'{stem}.webp'
    # LIBERO starts with five simulator settling frames, before the first planner call.
    offset=min(.6,max(0,info['duration']-.1))
    subprocess.run(['ffmpeg','-v','error','-ss',str(offset),'-i',str(v),'-frames:v','1','-c:v','libwebp','-quality','85',str(poster)],check=True)
    return dict(info,video=f'videos/{stem}.mp4',poster=f'images/{stem}.webp',sha256=sha(v),remoteSource=str(source),sourceSha256=sha(source),transform=filter_ or 'stream-copy with faststart')
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);p.add_argument('--rollouts',type=Path);p.add_argument('--kind',choices=['pusht','libero','all'],default='all');args=p.parse_args();out=args.output.resolve()
    if out==PROJECT or PROJECT in out.parents:raise ValueError('Use a directory outside the source project')
    for folder in ['videos','images','data']:(out/folder).mkdir(parents=True,exist_ok=True)
    manifest_path=out/'manifest.json'
    data=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'sourceHost':'lyg2080','groups':{},'notes':['Paired views come from the same recorded rollout frames and retain original playback timing.','These representative videos do not replace Table III aggregate success rates.']}
    if args.kind in ['pusht','all']:
        entries=[]
        for i in range(3):
            source=next(PUSHT_RUN.glob(f'trial{i:03d}_success_*.mp4'));meta=probe(source);assert meta['width']==912 and meta['height']==224
            execution=asset(out,f'sim-pusht-{i+1}-execution',source,'crop=226:224:0:0,scale=224:224')
            planner=asset(out,f'sim-pusht-{i+1}-planner',source,'crop=684:224:228:0,scale=672:224')
            assert execution['frameCount']==planner['frameCount']==meta['frameCount']
            entries.append({'id':f'pusht-{i+1}','label':f'Trajectory {i+1}','trial':i,'instruction':'Push the T-shaped block into the target region.','success':True,'numSubgoals':3,'execution':execution,'planner':planner,'provenance':{'source':str(source),'evaluationRun':str(PUSHT_RUN),'policyConfig':str(PROJECT/'configs/flow_goal_resnet_radio_pusht_wan_dp3_k4_v2a.yaml'),'notes':['Three actual generated subgoals consumed by the policy.','Source encoding resizes the composite width to a multiple of 16; crop widths account for this rescale.','Archived run aggregate is 84%; webpage table reports manuscript 86%.']}})
        data['groups']['pusht']=entries
    if args.kind in ['libero','all']:
        if args.rollouts is None:raise ValueError('--rollouts is required for LIBERO')
        records=[]
        for gpu in ['gpu6','gpu7']:
            path=args.rollouts/gpu/'results.json';report=json.loads(path.read_text());records+=report['videos']
            (out/'data'/f'libero-{gpu}-evaluation.json').write_text(json.dumps(report,indent=2)+'\n')
        # A requested representative may be rerecorded from another evaluation state.
        # Preserve the first attempt, then prefer a completed paired rollout for display.
        for retry in sorted(args.rollouts.glob('retry-task*')):
            report_path=retry/'results.json'
            while not report_path.exists():
                if 'Traceback' in (retry/'run.log').read_text(errors='replace'):
                    raise RuntimeError('Retry evaluation failed: '+str(retry))
                time.sleep(5)
            report=json.loads(report_path.read_text());records+=report['videos']
            (out/'data'/(retry.name+'-evaluation.json')).write_text(json.dumps(report,indent=2)+'\n')
        records.sort(key=lambda r:(not r['success'],r['trial']))
        entries=[]
        for task in range(10):
            r=next(x for x in records if x['task_id']==task and x['camera']=='agentview+wan_subgoals');e=next(x for x in records if x['task_id']==task and x['trial']==r['trial'] and x['camera']=='agentview')
            composite=Path(r['path']);raw=Path(e['path']);meta=probe(composite);assert meta['width']==2816 and meta['height']==256
            execution=asset(out,f'sim-libero-{task+1}-execution',raw)
            planner=asset(out,f'sim-libero-{task+1}-planner',composite,'crop=2560:256:256:0')
            assert execution['frameCount']==planner['frameCount']==meta['frameCount']
            # Source benchmark names prefix the human-readable instruction with the scene ID.
            instruction=re.sub(r'^.*?_SCENE\d+_', '', r['task']).replace('_',' ').capitalize()+'.'
            entries.append({'id':f'libero-{task+1}','label':f'Task {task+1}','taskId':task,'trial':r['trial'],'instruction':instruction,'success':r['success'],'numSubgoals':10,'execution':execution,'planner':planner,'provenance':{'source':str(composite),'checkpoint':'/mnt2/gck/svl_ckpt/expA_robust/goal_step_250000.pt','policyConfig':str(PROJECT/'configs/flow_goal_resnet_radio_libero_long_wan_full10_dit_final.yaml'),'plannerCheckpoint':'/mnt2/gck/checkpoints/wan_libero_long_subgoal_lora/lora_step_0220500.safetensors','settings':{'seed':0,'wanInferenceSteps':30,'flowSteps':20,'maxSteps':600,'executeChunkSteps':8,'numSubgoals':10,'recording':'10 columns × 1 row, each tile 256 × 256'}}})
        data['groups']['libero']=entries
        runtime=args.rollouts/'runtime-provenance.json'
        if runtime.exists():
            data['liberoRuntime']=json.loads(runtime.read_text())
            shutil.copyfile(args.rollouts/'runtime-config.yaml',out/'data/libero-runtime-config.yaml')
            shutil.copyfile(args.rollouts/'runtime_stats/LIBERO_Long_stats.json',out/'data/LIBERO_Long_stats.json')
    manifest_path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
    print('Exported paired simulation videos:',{k:len(v)for k,v in data['groups'].items()})
if __name__=='__main__':main()
