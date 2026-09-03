# 07-01 — Gate, query ledger and corpora

**Status:** complete. Three tasks, all verified at head.

## What was built

**`tools/verify-phase7.mjs`.** Derived from Phase 6's, with `PHASE = 7` as the
only place the phase is named. Bindings resolve: 23 threats, 20 plans, 23 owner
commands, 21 unique commands, and the graph proven acyclic with exactly one path
to `test:phase7:release`.

**`tools/phase7-red-gate.mjs`.** Empty registry, filled by 07-04 and 07-05, with
a self-consistency guard against `assert-red.mjs`.

**The query dimension.** `RecorderLedger` and the `recorder_ledger` fixture in
the Python lane, `recorderQueries` in the browser ledger.

**Two corpora.** `period_corpus.json`, generated from the vendored Home
Assistant; `recorder_corpus.json`, authored.

## What the work found

**The gate's own mutation tests caught the generation bug immediately.** Deriving
Phase 7's gate from Phase 6's left three Phase-6 literals behind — the
requirement names, the assumption keys, and a roadmap regex still matching
`/hysteresis/`. `test/phase7-gate.test.mjs` failed on all three before the gate
had run once. This is the third phase in a row where a generated gate shipped
residual literals, and the third where the mutation tests are what caught them.
The docstring's claim that every phase-specific value should be a derivation
rather than a literal is now evidence rather than advice.

**An empty RED registry is a passing gate.** `GATES` is legitimately empty in
wave 0, and an empty list reports "0 controlled RED, 0 implemented, 0 broken" and
exits zero — which is honest now and would be a lie the moment a sentinel is
written but not registered. The gate therefore cross-checks itself against
`assert-red.mjs`: a `phase7-` identity specified there with no command here
fails, and so does the reverse. A sentinel that is specified, never run and
reported by nobody looks exactly like success, and this is the shape of guard the
repository already uses for the three packaging lists and the two policy tables.

**The browser already could not reach the Recorder under test.** `callApi` is
recorded *and refused* by the fake Home Assistant, so `_ensureHistory` has been
inert in the exact-dist suite all along. That is worth knowing before 07-17
retires it: the retirement will change the shipped artifact, and the browser
suite will not notice, because the effect it removes was already impossible
there. The proof that matters for that plan is the outcome assertion in 07-19,
not the ledger.

**A corpus of only failures proves nothing.** The Recorder corpus carries a
`complete` case alongside the five failure classes, because without one it cannot
distinguish a correct implementation from one that refuses everything. The period
corpus carries `ordinary-summer` and `ordinary-winter` for the same reason: a
corpus of only transition dates cannot catch a resolver that is wrong every day
of the year.

**The Recorder-failure case expects `source: "unavailable"`, not an empty
series.** This is the trap `07-VALIDATION.md` criterion 4 names, written into the
corpus so a later plan cannot fall into it: a correct implementation and a broken
one both produce an empty series, and only the stated source tells them apart.

## Evidence at head

- `node --test test/phase7-gate.test.mjs` — 31 passed.
- `node --test test/phase7-corpus.test.mjs` — 10 passed.
- `py -3.13 -m pytest tests/components/glt_flow_card/test_recorder_ledger.py` — 9 passed.
- `npm test` — 418 passed, 0 failed, 0 skipped.
- `npm run test:python` — 472 passed.
- `npm run test:e2e` — 49 passed, `recorderQueries: []`.
- `node tools/phase7-red-gate.mjs` — 0 controlled RED, 0 implemented, 0 broken.
- Period corpus regenerates byte-identically.

## Carried forward

`package.json` is a canonical build source, so registering the Phase-7 scripts
made the staged manifest stale and sixteen packaging and release tests failed
until it was refreshed. The ordering rule held: commit source, build, stage,
commit the manifest. It is worth restating because the failure names
`package.json` rather than the manifest, and reads like a build problem.
