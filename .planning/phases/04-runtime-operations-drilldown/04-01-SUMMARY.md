# 04-01 — The evidence machinery, before any feature

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

`tools/phase4-red-gate.mjs` classifies the ten Phase-4 sentinels the way
Phases 2 and 3 classify theirs: a run counts as controlled RED only when
exactly one named sentinel fails carrying its literal `EXPECTED_RED[...]`
marker *and* the effect-ledger prefix for that task. A missing browser, an
import error, a zero-test run or a skip is rejected rather than counted — the
distinction that keeps a gate from congratulating itself on a harness that
never ran.

The operations corpus (`test/fixtures/operations/site.project.json`,
`tests/components/glt_flow_card/panel_factory.py`) was seeded so that at least
one object is visible differently to each principal; without that, every
authorization assertion in the phase would pass vacuously.

The Phase-4 entry in `tools/exact-dist-effect-ledger.mjs` answers the one
question this phase can get wrong while passing: it fails on any
`hass.callService` or `hass.callApi` reached from a Phase-4 surface, so
"the browser has no direct service path" is measured rather than asserted.
