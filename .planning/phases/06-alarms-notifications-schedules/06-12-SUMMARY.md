# 06-12 Summary — schedule resolution and DST parity

**Status:** complete. 9 parity tests over 1080 corpus cases, 13 DST tests.

Both runtimes resolve to UTC instants using the site timezone and the fold, and
the dedupe key carries the resolved instant. Correctness stops resting on a
cache — which matters because D8's prune fix would otherwise have reintroduced a
double fire.

The two predicates are implemented rather than imported, and both runtimes
assert agreement with Home Assistant's private `_datetime_exists` and
`_datetime_ambiguous` for every corpus date. A change there is reported rather
than inherited.

The zone list is deliberate: `Pacific/Auckland` so an implementation assuming the
clocks go forward in March is caught; `Australia/Lord_Howe` because its
transition is **thirty minutes**, so a lost hour assumed anywhere is wrong there;
`Asia/Kolkata` for a half-hour offset that never transitions.

**Two things found by writing it.** The nonexistent-time walk shifted the UTC
instant and landed an hour past the answer (04:31 instead of 03:00) — it walks
the wall clock now. And the runtimes agreed on every *value* and disagreed on
every *byte*, because `toISOString()` always writes milliseconds and Python's
`isoformat()` omits them at zero.

**And one self-inflicted cycle.** The generator's `generated_by` string started
with `npm run`, which the gate's graph builder reads as a real edge — the same
trap Phase 5 hit. The convention is to name the script mid-string, and the
comment now says so.
