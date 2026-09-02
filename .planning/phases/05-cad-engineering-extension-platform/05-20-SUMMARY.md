# 05-20 — The Phase-5 gate, and an honest close

**Status:** complete
**Requirements:** CAT-01, ENG-01, ENG-02, CAD-01, SDK-01

## Task 1 — the orchestrator

`tools/verify-phase5.mjs`, binding five requirements, five roadmap truths,
twenty plans, sixteen threats and six resolved assumptions to evidence, and
proving the command graph acyclic with exactly one path to the
`test:phase5:release` leaf owned by T5-16.

**Both predicted bugs happened.** Generating this from the Phase-4 orchestrator
collapsed the roadmap slice's bounds onto the same heading — which yields an
empty block, no roadmap truths, no plans, and a gate that binds nothing and
reports success — and left the plan regex matching `04-`. Both are now checked
rather than trusted: the gate throws on an empty slice, and
`test/phase5-gate.test.mjs` asserts that a named roadmap truth and a named plan
both carry real text.

A third the plan did not predict: the threat-count guard still expected
fourteen rows where Phase 5 has sixteen, and the leaf-owner check still named
T4-14.

## Task 2 — mutation tests

`test/phase5-gate.test.mjs` — 22 tests, all passing. Each mutation fails the
gate: an unbound requirement, an unowned threat, a missing plan, a duplicated
command, an introduced cycle, a second path to the leaf, and a threat marked
verified with no passing owner.

## Task 3 — closing the phase

**Fifteen of sixteen threat rows are `verified`.** Every owner command was run
at head and passed. No row was marked from its parts passing separately.

One correction was needed to get there rather than to declare it: T5-03's owner
is `--grep=phase-5-catalog`, and no test carried that group — the state and
contrast assertions had been folded into the omnibus UI test. The gate would
have run zero tests and rejected the run. The assertions now live in their own
test, and they got stronger for the move: contrast is measured as a WCAG
relative-luminance ratio against a 4.5:1 floor, and the five state symbols are
required to be five *different* symbols, because one cue in five colours is
colour alone wearing a disguise.

**T5-16 stays `planned`, and that is an environment limit, not a defect.** Its
owner is the composed `test:phase5:release` leaf, which installs the exact HACS
stage on digest-pinned Home Assistant images; this container has no Docker
engine, so the command has never been run as one command anywhere. All four of
its parts pass individually — and that is exactly why the row is not marked: a
composed leaf verified from its parts is a leaf nobody composed. T2-16, T3-14
and T4-14 stand unmarked for the same reason.

**The catalog floor was not adjusted.** The requirement asks for at least 300
distinct variants; the evidence reports 456. Where it fell short — three
symbols that drew nothing, nine that shared a drawing — symbols were fixed and
added, and the test was left alone.

## Gate result at head

```
PASS acyclic command graph reaching test:phase5:release exactly once
PASS F5-01 Canonical build from authored modules
PASS F5-02 Node regression suites
PASS F5-03 Companion suite
PASS F5-04 Exact-dist browser suites
PASS F5-05 Complete sources and deterministic documentation site
RUN  F5-06 Phase-4 gate  → chains to Phase 3, Phase 2 and Phase 1
```

F5-06 keeps the previous phase gate mandatory. The whole chain was run rather
than assumed: Phase 4's gate passes F4-01 to F4-05 and stops at F4-06, which
chains to Phase 3, Phase 2 and Phase 1, and Phase 1 stops at its first command.

That command is `verify:provenance --online`, and running it directly names the
cause exactly: **`api.github.com` returns HTTP 403 through this container's
egress proxy.** The npm registry itself answers 200 — it is on the proxy's
no-proxy list — so this is the source-repository half of the provenance check,
not the registry half.

The tool was left alone. Routing a supply-chain check through a different
transport to suit an environment weakens the check, and the gate failing closed
on an unreachable source of truth is the behaviour that check exists to have.
It is also why a local gate run cannot be the release evidence.
