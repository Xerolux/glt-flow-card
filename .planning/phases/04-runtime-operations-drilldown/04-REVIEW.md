---
phase: 04-runtime-operations-drilldown
reviewed: 2026-09-03
head: 08bfb92
depth: standard
reviewer: close-out review pass
method: read at head, plus a live probe of navigation indistinguishability
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: no_defects_found
---

# Phase 04: Code Review Report

**Scope.** `panels.py`, `view_stream.py`, `navigation.py`, `ws_panels_get`,
`ws_navigation_resolve`, `ws_capabilities_get`, `src/v100/panel-model.mjs`,
`navigation.mjs`, `view-resync.mjs`, `command-outcome.mjs`, and the operations
corpus.

## Summary

No defect found. Three of this phase's guarantees are structural:

**The snapshot and its sequence really are one critical section.** `snapshot()`
in `view_stream.py` is a **synchronous** `def`, not an `async def`. There is no
`await` in it, so the event loop cannot interleave and the registry cannot emit
between `read()` and `sequence_of()`. The guarantee is enforced by the shape of
the method rather than by a reviewer checking that no await crept in — an
`async def` with the same body would be one careless edit away from a sequence
that never matched its data.

**A forbidden control is absent, not disabled.** `ws_panels_get` filters the
control list against `decision.capabilities` — the *current* ones, resolved this
request — because the browser's capability snapshot can be minutes stale and
would not see a revocation. `test_panels.py` asserts both halves: that a viewer
is offered no control, **and** that the word "disabled" does not appear in the
region, because a disabled control still announces that the control exists.

**The panel carries nothing dispatchable.** `FORBIDDEN_KEYS` —
`domain`, `service`, `target`, `entity_id`, `service_data` — is asserted against
the serialized response body, so there is nothing in a panel for a browser to
replay even if it wanted to.

## Probed at head

Address resolution answers **identically** for every distinguishable failure. A
live probe against a running Companion, three principals × four address shapes:

| Address | admin | viewer | unassigned |
|---|---|---|---|
| unknown (`nope/does/not/exist`) | `not_found_or_denied` | `not_found_or_denied` | `not_found_or_denied` |
| malformed (`../../etc`) | `not_found_or_denied` | `not_found_or_denied` | `not_found_or_denied` |
| in a project that does not exist | `not_found_or_denied` | `not_found_or_denied` | `not_found_or_denied` |

The empty address succeeds for a member and is denied for the unassigned caller,
which is right: the unassigned caller is refused at the boundary before the
handler runs, so they do not learn that the project exists at all.

**No retry affordance survives in the shipped artifact.** The only occurrences of
"retry" in `dist/glt-flow-card.js` are a *lease* conflict choice — an editing
lease, not a plant command — and the sentence
`safety.control_no_retry`: "This card never repeats a control by itself. Decide
again if the plant must move."

## Class-level sweeps

Both sweeps from the Phase-2 pass were re-run over this phase's routes.
`panels/get`, `navigation/resolve` and `views/subscribe` are `opaque` and
project-scoped, so the boundary denies before the handler runs and the filtered-
route class does not apply. `navigation/portfolio` is component-scoped and
`filter`: probed empty for an unassigned caller in the Phase-2 sweep, and its
counts are summed from the already-filtered project set, which is the ordering
T4-04 requires.

## Info

### IN-01: The phase closed without per-plan summaries

Seventeen plans, one phase summary, no per-plan record. Written in this pass as
`04-01-SUMMARY.md` … `04-17-SUMMARY.md`, each carrying the same reconstruction
disclaimer Phase 3's do.

## Evidence

| Command | Result |
|---|---|
| `pytest test_panels.py test_panel_enumeration.py test_view_stream.py test_navigation.py test_navigation_counts.py test_phase4_lifecycle.py -q` | 15 passed |
| `node --test test/phase4-gate.test.mjs` | 22 passed |
| live navigation probe, 3 principals × 4 address shapes | identical refusals, table above |

## Verdict

**No defects found.** T4-14 stays `planned` for the reason the phase recorded:
its owner command needs a Docker engine this container does not have.
