# 04-04 — RED: the four browser sentinels

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

The browser contract written as failing tests before the surfaces existed:
only `readback_confirmed` may render as success; a sequence gap marks the view
stale in the *same* transition, not on the next tick; and the sentinel loads
**the exact generated artifact**, not a re-bundled test build.

That last one is the standing lesson of this repository. A UI test that builds
its own bundle tests a bundle nobody ships. `tools/run-exact-dist-playwright.mjs`
loads `dist/glt-flow-card.js` as published, and drifts loudly if a spec is
added without being registered.
