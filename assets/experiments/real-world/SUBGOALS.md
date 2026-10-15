# Real-world subgoal annotations

The nine original PPT recordings are unchanged. Each displayed sequence is an
**offline annotation of that exact execution**, recomputed with the task's trained
IQL reachability and fine-tuned RoboMeter utility models. It is not a saved sequence
of predictions made by the online robot planner.

`subgoals/manifest.json` records each source video SHA-256, frame count, native
presentation FPS, instruction, checkpoint, selected frame indices/timestamps,
DP variant, objective terms and metrics. Each trajectory folder contains the
selected-frame thumbnails, pairwise values/utility (`values.npz`), all DP variants
and the diagnostic DP curves. The three task progress JSON files retain the
original 64-frame model outputs and their interpolation to the video timeline.

Feature encoding follows the trained value model: c-radio_v3-h at 224 × 384,
two-frame observation history and the exact cached Qwen language embedding for
the instruction. Local patches are averaged before the learned projection, as
in the original IQL evaluation implementation. No other episode's values or
selected frames are mapped to these recordings.

Selection uses the original generic value/progress DP driver, gamma 0.95,
epsilon 0.02, five-frame smoothing and its original candidate objectives/selection
criterion. The relative 5–6% gap is disabled for these short accelerated clips;
the minimum gap is four native frames for folding and three for packing/line.
This avoids forcing almost uniform sampling at K=18. Folding uses K=15; line uses K=18; packing uses K=3 × object count
(9, 12, 12). These recordings do not include robot state logs, so the separate
state-anchored refinement from the training data pipeline is not applied. Only
native video frames are selected; timestamps refer to the displayed recording,
not an inferred original robot clock.

Reproduction scripts:

- `scripts/annotate_real_world_subgoals.py`: byte verification, derived analysis
  views, RADIO features, exact-checkpoint value inference, utility and DP.
- `scripts/read_safe_robometer_progress.py`: regular-read safetensors loader to
  avoid the shared filesystem's memory-mapping stall. All checkpoint tensors,
  names and dtypes are retained. Tested against the reference safetensors loader.
- `scripts/generate_real_world_subgoals.sh`: GPU stages in the planning environment.
- `scripts/import_real_world_subgoals.py`: verifies video/value hashes and imports
  selected original frames plus the clickable website sequences.

The source project, training caches and checkpoints remain read-only. Generation
outputs reside at `/mnt2/gck/newwebsite_real_subgoals_20261012`; the remaining
inference uses the shared files via lyg2072 after lyg2080's checkpoint read stalled.
