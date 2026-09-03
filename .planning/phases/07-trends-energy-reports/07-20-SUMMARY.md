# 07-20 — Document the contract and close the phase

**Status:** complete. Phase 7 closed with 22 of 23 threats verified.

## Task 1 — the documentation

`docs/wiki/Trends-Energy.md` and `docs/wiki/Reports.md`, in German, with full
sections added to both READMEs in their own languages.

The first sentence is the one that matters: **this product reads Home
Assistant's Recorder; it is not a historian.** No time-series database of its
own, no retention policy, no compaction. The earlier interface implied the
opposite — periods up to a year, energy integrated in the browser — so an
installation keeping ten days of Recorder history got a "monthly report" with no
month in it and was told nowhere.

**The old page was itself the drift.** `Trends-Reports.md` advertised four
things the artifact deliberately no longer does: browser-side power-to-energy
integration, direct CSV download and print/PDF via a self-written window. All
three wrote the value being rendered at that moment, with no period and no
coverage. It is now a two-line pointer to the split pages, so existing links
still land somewhere true rather than on claims the code retired.

Both READMEs also still said "Trends are not available yet" / "Trends gibt es
noch nicht", which stopped being true in this phase.

## Task 2 — closing the register

Every one of T7-01…T7-22 was marked from **its own** owner command, run at head.
Seven rows share a command with a sibling; each got its own run rather than
being inferred. T7-19, T7-20 and T7-22 each got a separate exact-dist run.

**T7-22 justified existing.** It was written to make "prove the retirement is
*reached*" a blocking requirement rather than a habit. Running it is what found
Phase 7 repeating Phase 6's defect — a confident zero on every surface, and
`_seriesFor` still calling the retired `aggregateSeries`. That is the whole
argument for the rule, demonstrated on the phase that wrote it.

## Four environment limits, and the requirement that caught two

The plan demanded exact failures rather than likely causes, because Phase 6
closed having found two independent limits and recorded one. That requirement
paid twice here:

- **The Phase-6 record turned out to be wrong.** It said `api.github.com`
  answered 403 through the egress proxy. It does not — `/rate_limit` returns
  **200**. Only third-party repository endpoints 403, with "GitHub access to
  this repository is not enabled for this session". Same blocked command,
  different reason, and it would have been carried forward unexamined.
- **T7-23's leaf fails differently in two environments.** Here, no Docker
  engine. In CI, HA 2026.9.0 published against a harness still pinning
  `2026.9.0b6`. "Likely cause" would have been wrong in both directions.

The third limit is new and shapes how the browser rows may be read: the
container ships Chromium revision **1194** while `@playwright/test` 1.62.1
expects **1234**. The rows pass under the override
`playwright.config.mjs` documents for exactly this case, and **the register says
so** rather than letting a ✅ imply the bare command worked. The phase gate's
F7-04 does not set it and fails.

T7-23 stays `planned`, marked from its own run rather than from its parts
passing individually — the error Phase 5's closure made and Phase 6's corrected.

## Carried out of the phase as open work

`history/coverage` and `history/export` are still shells returning a stated
`unavailable`. Coverage needs the period's expected instants, whose bucket step
is a decision wanting a corpus behind it; inferring it from returned rows is the
defect `expected_instants` exists to prevent. Left open deliberately, and
recorded in `07-SUMMARY.md`, `STATE.md` and `.continue-here.md` rather than
quietly half-built.
