# 04-13 — The surfaces ship, the legacy path retires

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

Five operations elements ship in the generated artifact, verified in
`dist/glt-flow-card.js` as published rather than in a test build.

**No Phase-4 surface can reach `hass.callService` or `hass.callApi`** — enforced
by the effect ledger from 04-01, so the claim is measured on every run.

The legacy browser permission check and its direct service fallback are retired
the way Phase 2 retired `control/execute`: **declared, reachable and proven
inert**. A retired path left merely unreferenced is a path a future edit can
call again; one that is reachable and provably does nothing cannot be revived
by accident.

Every new string exists in German and English.
