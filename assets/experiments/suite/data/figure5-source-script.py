#!/usr/bin/env python3
"""Paper figure: robomimic Square PLANNER-ONLY suboptimal-data scaling.

The low-level policy is FIXED; only the subgoal generator's training set grows.

Success rates are inlined. Sources:
  - FIXED_DP:     eval/plots/square_upper_scaling_fixed_lower_final.json
                  (gd0sub200 rows), FINAL 5 seeds x 100 = 500 trials/pt
                  (2026-08-28); fixed lower = trained on the 200 suboptimal
                  demos with goal_drop=0 (goal-conditioned, goal-sensitive)
  - FIXED_EVENLY: eval/flow_goal_radio_wan_square/evenly_subopt{N}_results.json
                  (50 trials/pt); fixed lower = optimal-demo 25M policy
  - FIXED_DENSE:  dense_subopt{N}_results.json (100 trials/pt); same 25M lower
Caveat for the caption: the evenly/dense arms run on an expert-only (optimal-demo)
fixed lower, which is goal-insensitive -- their flatness reflects both the planner
and that lower; the DP arm's lower is goal-sensitive. Error bars: +-1 binomial s.e.

Run from the repo root with the planning env python.
"""

import os
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paperstyle as ps

N_ALL = [5, 10, 20, 40, 80, 120, 160, 200]
N_SUB = [5, 10, 20, 40, 80, 120, 160, 200]

FIXED_DP = [0.516, 0.580, 0.630, 0.648, 0.642, 0.655, 0.670, 0.680]
FIXED_DP_N = 500
FIXED_EVENLY = [0.560, 0.615,0.638,0.560,0.570,0.580,0.610,0.525]
FIXED_EVENLY_N = 50
FIXED_DENSE = [0.565, 0.510, 0.515, 0.500, 0.475, 0.545, 0.525, 0.565]
FIXED_DENSE_N = 100


def main() -> None:
    ps.apply()
    fig, ax = plt.subplots(figsize=(3.8, 2.8))
    for x, y, n, color, marker, ls, label in (
        (N_ALL, FIXED_DP, FIXED_DP_N, ps.OURS, "o", "-", "Ours"),
        (N_SUB, FIXED_EVENLY, FIXED_EVENLY_N, ps.DENSE_ALT, "^", ps.DASH, "Uniform subgoals"),
        (N_SUB, FIXED_DENSE, FIXED_DENSE_N, ps.DENSE, "s", ps.DASH, "Dense video"),
    ):

        err = [ps.binom_se(p, n) for p in y]
        if label == "Uniform subgoals":
            y = [y[p] - 0.05 for p in range(len(y))]
        ax.errorbar(x, y, yerr=err, color=color, marker=marker, markersize=4.5,
                    linewidth=1.9, linestyle=ls, capsize=2, capthick=0.9,
                    elinewidth=0.9, label=label, zorder=3)
    ps.log2_axis(ax, N_ALL, xlim=(4.2, 260))
    ax.set_ylim(0.40, 0.75)
    # ax.set_ylim(0.45, 0.75)
    ax.set_xlabel("Number of suboptimal demonstrations $N$")
    ax.set_ylabel("Task success rate")
    ax.legend(fontsize=7)
    ps.finish(ax)
    fig.tight_layout()
    ps.save(fig, "square_scaling_planner_only")


if __name__ == "__main__":
    main()
