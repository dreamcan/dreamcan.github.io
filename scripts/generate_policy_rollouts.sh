#!/usr/bin/env bash
# Record all ten LIBERO-Long tasks with paired generated subgoals on two free GPUs.
# Run on lyg2080. Uses existing checkpoints; writes only to a new directory.
set -euo pipefail
policy_output=${1:-/mnt2/gck/newwebsite_policy_rollouts_20261012_v2}
if [[ -e "$policy_output" ]]; then echo "Output already exists: $policy_output" >&2; exit 1; fi
mkdir -p "$policy_output/gpu6" "$policy_output/gpu7"
cd /data/gck/svl_project
policy_python=/data/gck/miniconda3/envs/planning/bin/python
policy_checkpoint=/mnt2/gck/svl_ckpt/expA_robust/goal_step_250000.pt
policy_config="$policy_output/runtime-config.yaml"
"$policy_python" - "$policy_output" <<'PYCFG'
import sys,hashlib,json,shutil,yaml
from pathlib import Path
out=Path(sys.argv[1])
source=Path('/data/gck/svl_project/configs/flow_goal_resnet_radio_libero_long_wan_full10_dit_final.yaml')
cfg=yaml.safe_load(source.read_text())
original_stats=Path('/mnt2/gck/newwebsite_policy_rollouts_20261012/runtime_stats/LIBERO_Long_stats.json')
if not original_stats.is_file():
    original_stats=Path('/mnt/gck/libero_data/libero_hdf5/norm_stats/LIBERO_Long_stats.json')
(out/'runtime_stats').mkdir()
shutil.copyfile(original_stats,out/'runtime_stats/LIBERO_Long_stats.json')
cfg['data']['stats_dir']=str(out/'runtime_stats')
(out/'runtime-config.yaml').write_text(yaml.safe_dump(cfg,sort_keys=False))
(out/'runtime-provenance.json').write_text(json.dumps({'originalConfig':str(source),'originalConfigSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'originalStats':'/mnt/gck/libero_data/libero_hdf5/norm_stats/LIBERO_Long_stats.json','statsSha256':hashlib.sha256(original_stats.read_bytes()).hexdigest(),'onlyConfigChange':'data.stats_dir points to the verified byte-identical local copy to avoid a stalled shared mount'},indent=2)+'\n')
PYCFG
for policy_gpu in 6 7; do
  if [[ "$policy_gpu" == 6 ]]; then policy_tasks=0,1,2,3,4; else policy_tasks=5,6,7,8,9; fi
  nohup env CUDA_VISIBLE_DEVICES="$policy_gpu" MUJOCO_EGL_DEVICE_ID="$policy_gpu" MUJOCO_GL=egl PYOPENGL_PLATFORM=egl OMP_NUM_THREADS=4 PYTHONUNBUFFERED=1 \
    "$policy_python" scripts/eval_flow_goal_radio_wan_long_benchmark.py \
      --checkpoint "$policy_checkpoint" --config "$policy_config" --device cuda:0 \
      --libero_benchmark libero_10 --eval_task_ids "$policy_tasks" --num_trials 1 \
      --wan_inference_steps 30 --wan_num_subgoals_gen 10 --flow_steps 20 \
      --num_steps_wait 5 --max_steps 600 --execute_chunk_steps 8 --seed 0 \
      --save_videos --save_subgoal_video --video_trials_per_task 1 \
      --subgoal_tile_px 256 --subgoal_grid_cols 10 --subgoal_grid_rows 1 \
      --eval_video_dir "$policy_output/gpu$policy_gpu/videos" \
      --output_json "$policy_output/gpu$policy_gpu/results.json" --no-wandb \
      > "$policy_output/gpu$policy_gpu/run.log" 2>&1 < /dev/null &
  echo $! > "$policy_output/gpu$policy_gpu/pid"
  echo "Started GPU $policy_gpu, tasks $policy_tasks, PID $!"
done
