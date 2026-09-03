# 06-20 Summary — the Phase-6 gate, and closing honestly

> **Reconstructed at close-out**, from this plan, `06-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

`tools/verify-phase6.mjs` binds every requirement, roadmap truth, plan, threat
and assumption to current evidence, and recurses into the Phase-5 gate.

Three obligations, each of which is a way a gate can lie:

**The keyword-presence assertions were deleted, not left passing beside the
behavioural ones.** A test that greps the source for a symbol keeps passing
after the behaviour it stood in for has been replaced by something broken, and a
suite carrying both reports a comfortable total. Removing them lowered the count
and raised what the count means.

**Every threat row is marked from its own owner command passing at head** —
not from the phase feeling finished, and not from a related command passing.
T6-01 through T6-20 were run individually.

**A row whose owner could not run stays `planned`, with the reason named
exactly.** T6-21 stays planned: its owner is the composed `test:phase6:release`
leaf, whose Home Assistant artifact lanes need a Docker engine this container
does not have. "Blocked" without the specific reason is how a row that could
have run gets excused along with one that could not.

The phase closed with all 14 audited defects fixed, including the live
`alarms/list` authorization hole — an authenticated user with no membership
anywhere could read any project's complete alarm state and history — which was
found while auditing for this phase and fixed separately in `9f53bcb`.
