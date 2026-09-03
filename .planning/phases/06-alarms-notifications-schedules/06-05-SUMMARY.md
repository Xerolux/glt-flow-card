# 06-05 Summary — the notification, schedule and shipped-truth RED contracts

**Status:** complete. `node tools/phase6-red-gate.mjs` reports **13 controlled
RED, 1 implemented, 0 broken** — every Phase-6 sentinel exists.

## The contracts that needed the most care

**The fall-back test disables the dedupe cache.** The research established that
today's single execution at 02:30 on 2027-10-31 comes from a fold-blind
`run_key`, not from the schedule logic. A test that leaves the cache on proves
nothing. The sentinel additionally requires the two fall-back instants to
produce *different* run keys — that is what moves correctness out of the cache
and into the resolution, so D8's prune fix cannot reintroduce a double fire.

**The DST predicates are checked against Home Assistant's own.**
`_datetime_exists` and `_datetime_ambiguous` are the right semantics but
underscore-prefixed and free to vanish in a minor release, so we implement our
own and assert agreement for all three dates. An ordinary day is asserted
alongside both transitions, so a resolver that answers `nonexistent` to
everything cannot pass.

**The notification sentinel reads the module source** for `blocking=False`, a
bare `except`, and the absence of a timeout. ALM-02's requirement to record
every result and that call are incompatible, so the incompatibility is asserted
directly.

**The allowlist needs two checks, not one.** The shipped default must reach no
external recipient, *and* an unlisted service must be refused through it. A
default that permitted everything would satisfy the first alone.

**The shipped-truth sentinel reads `dist/glt-flow-card.js`** and requires
`activeAlarm` to stay reachable and inert. Deleting it would leave nothing to
test, and "the string is absent" is a weaker claim than "the function is present
and does nothing".

The parity corpus requires a southern-hemisphere zone, so an implementation that
assumes spring-forward happens in March is caught rather than merely
unexercised.

## Two Node sentinels, one existing mechanism

`tools/run-unit-tests.mjs` already documents `PHASE_GATE_SUITES` for precisely
this case, and it had been emptied at plan 02-13. It now carries the two Phase-6
Node sentinels, each annotated with the plan that releases it (06-12 and 06-15).

## Environment limitation found

This container has Chromium **1194** while the pinned Playwright **1.62.1** looks
for **1234**, so every exact-dist run needs

```
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
```

`playwright.config.mjs` already supports the variable. The mismatch is
pre-existing and affects the Phase-5 greps identically — verified by running
`--grep=phase-5-catalog`, which fails the same way without the variable and
passes with it. Nothing was changed to work around it; the variable is recorded
here and in `.continue-here.md` so a later run does not read the failure as a
Phase-6 defect.
