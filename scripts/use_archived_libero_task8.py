#!/usr/bin/env python3
"""Use an existing successful two-moka-pots rollout, retile its actual goals to one row."""
import argparse,json
from pathlib import Path
from export_policy_simulation import asset,probe,PROJECT

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);args=p.parse_args();out=args.output
    folder=PROJECT/'eval/hiprec/t8_videos_v3'
    stem='task08_KITCHEN_SCENE8_put_both_moka_pots_on_the_stove_trial0_success'
    source=folder/(stem+'_obs_plus_wan_subgoals.mp4');raw=folder/(stem+'_agentview.mp4')
    meta=probe(source);assert (meta['width'],meta['height'])==(896,256)
    execution=asset(out,'sim-libero-9-archived-execution',raw)
    transform='split=2[top][bottom];[top]crop=640:128:256:0[a];[bottom]crop=640:128:256:128[b];[a][b]hstack=inputs=2'
    planner=asset(out,'sim-libero-9-archived-planner',source,transform)
    assert execution['frameCount']==planner['frameCount']==meta['frameCount']
    path=out/'manifest.json';m=json.loads(path.read_text());e=m['groups']['libero'][8]
    m['liberoInitialTask8Representative']=json.loads(json.dumps(e))
    e.update({'trial':0,'success':True,'execution':execution,'planner':planner,'provenance':{'source':str(source),'checkpoint':None,'policyFamily':'Archived v3 goal-conditioned policy','recording':'Original 2 × 5 grid of actual generated subgoals retiled to a 1 × 10 strip.','notes':['Uses the matching original agentview recording; retains all 453 frames at 10 fps.','Nine other tasks use the newly recorded EXP-A policy. This archived success replaces the two uncompleted new task-8 attempts for the representative gallery.','Exact archive checkpoint has not been verified from the video directory; do not infer it from the table aggregate.']}})
    m['notes'].append('LIBERO representatives: nine newly recorded EXP-A successes and one existing task-8 v3 success; original attempt reports retained.')
    path.write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
    print('Retiled archived task 8 success, preserving paired frames and timing.')
if __name__=='__main__':main()
