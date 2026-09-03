# 04-14 — A reload leaves nothing behind

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

Unload leaves no ghost subscription, no panel cache and no in-flight resync
task. Runtime becomes unavailable *before* teardown begins, so nothing new can
be started while the existing work is being torn down, and the resource ledger
reaches zero.

This is what keeps a long-running installation from accumulating the state this
phase adds across a hundred config reloads.

Every new Companion module was added to **all three packaging lists** —
`tools/stage-hacs-packages.mjs`, `tools/validate-hacs-staging.mjs` and
`test/hacs-staging.test.mjs`. They are independent by design, and a module in
two of them ships broken.
