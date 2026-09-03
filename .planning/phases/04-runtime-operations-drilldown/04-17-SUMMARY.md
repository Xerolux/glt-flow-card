# 04-17 — One command, and an honest close

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

`tools/verify-phase4.mjs` binds every requirement, roadmap truth, plan, threat
and assumption to current evidence, with 22 gate mutation tests proving the
gate itself fails when it should. The command graph is acyclic with exactly one
path to the release leaf.

**A threat row is marked verified only after its owner command has actually run
and passed.** T4-01 through T4-13 were run at head and marked `verified`. T4-14
stays `planned`: its owner needs a Docker engine this container does not have,
and recording it as verified would have been the one failure this whole gate
exists to prevent.

The phase also produced `tests/components/glt_flow_card/test_lane_portability.py`
after the same lane-portability bug appeared twice — a test reaching for `node`
and `src/`, then another reaching for a top-level `test/` directory, both
passing locally and failing only in `ha-artifacts`. A guard, rather than a
third one-off fix.
