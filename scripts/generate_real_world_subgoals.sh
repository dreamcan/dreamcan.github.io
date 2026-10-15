#!/usr/bin/env bash
# Run after copying the nine byte-verified site videos and input.json to --root.
set -euo pipefail
umask 000
TASK_ROOT="${1:-/mnt2/gck/newwebsite_real_subgoals_20261012}"
PY=/data/gck/miniconda3/envs/planning/bin/python
export PYTHONPATH=/data/gck/svl_project
export HF_HOME=/data/gck/svl_project/robometer_libero90/cache/hf_home
export HUGGINGFACE_HUB_CACHE="$HF_HOME/hub"
export TRANSFORMERS_CACHE="$HF_HOME/transformers"
export TORCH_HOME=/data/gck/svl_project/robometer_libero90/torch_home
export HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
export WANDB_MODE=disabled UNSLOTH_DISABLE_STATISTICS=1
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
cd /data/gck/svl_project
if [ -n "${SUBGOAL_TASK:-}" ]; then
  CUDA_VISIBLE_DEVICES="${SUBGOAL_UTILITY_GPU:-7}" "$PY" "$TASK_ROOT/annotate_real_world_subgoals.py" --root "$TASK_ROOT" --stage utility --task "$SUBGOAL_TASK"
  exit
fi
"$PY" "$TASK_ROOT/annotate_real_world_subgoals.py" --root "$TASK_ROOT" --stage prepare
CUDA_VISIBLE_DEVICES=6 env -u TORCH_HOME "$PY" "$TASK_ROOT/annotate_real_world_subgoals.py" --root "$TASK_ROOT" --stage features > "$TASK_ROOT/features.log" 2>&1 &
FEATURE_PID=$!
CUDA_VISIBLE_DEVICES=7 "$PY" "$TASK_ROOT/annotate_real_world_subgoals.py" --root "$TASK_ROOT" --stage utility > "$TASK_ROOT/utility.log" 2>&1 &
UTILITY_PID=$!
wait "$FEATURE_PID"
wait "$UTILITY_PID"
CUDA_VISIBLE_DEVICES=6 "$PY" "$TASK_ROOT/annotate_real_world_subgoals.py" --root "$TASK_ROOT" --stage select
