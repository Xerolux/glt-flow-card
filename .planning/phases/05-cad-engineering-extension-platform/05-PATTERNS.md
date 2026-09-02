# Phase 05 Patterns

Every pattern here is already load-bearing somewhere in the repository. Phase 5
introduces one genuinely new idea — the command/inverse pair — and reuses the
rest.

## Generated evidence with a `--check` mode

Established by `tools/generate-project-validators.mjs` and, in Phase 3, by
`tools/generate-semantic-parity-corpus.mjs`. A generator writes a canonical
artifact; a `--check` run regenerates and compares; a test fails if the committed
file is not what the current source produces.

The catalog manifest is exactly this shape. That is what makes "the published
count" a fact rather than a claim: the number lives in a generated file that
cannot drift from the code that produced it.

## Prove distinctness by digest, not by inspection

Phase 3 learned this the hard way: two runtimes agreed on a *verdict* while
building different *models*, and only comparing canonical bytes exposed it. The
catalog uses the same instrument — per-base geometry digests and per-style token
digests — because "these symbols look different" is not a test.

## A refusal carries a reason

Established by Phase 2's stable error codes and Phase 3's mapping reasons. Port
compatibility returns `{compatible: false, reason: "medium_mismatch", detail: …}`.
A boolean tells an engineer that the tool disagrees with them; a reason tells
them which of the two is wrong.

Note the deliberate asymmetry with Phase 2: a *policy* denial is opaque, because
the caller must not learn what exists. An *engineering* refusal is explanatory,
because the caller already has the diagram in front of them and hiding the reason
protects nothing.

## Deny-default closed sets

`CAPABILITIES`, `CONTROL_RESULT_STATES`, `STATE_PRECEDENCE`, the Phase-3
vocabularies, the Phase-4 region kinds. Phase 5 adds port kinds, refusal reason
codes, editor command kinds and contribution kinds. Each is a frozen export with
a membership test, and an unknown member is an error rather than a passthrough.

## Command and inverse

The one new pattern. Every editor operation is a value: `{kind, payload}`, with
`apply` and `invert` such that `invert(apply(state, cmd), cmd)` is the original
state. Undo is then a consequence rather than a feature, and the property is
testable over a generated corpus of operation sequences instead of one scripted
click-path.

This is why the operations are modelled at all. An editor that mutates config
directly can be given an undo stack, but nothing proves the stack is right.

## Bounded before interpreted

Established by the Phase-1 pre-validator byte and depth budgets, and by Phase 3's
`max_depth`/`max_nodes`/`max_children`. An extension manifest is bounded for
size, depth and count *before* anything reads it, because a bound applied after
parsing is a bound that already lost.

## Retire, do not delete

Established by `glt_flow_card/control/execute`, `projects/lock`/`unlock`, and
Phase 4's legacy tap path. The eight-line `autoRoute` is replaced, and the old
behavior stays reachable by a test that proves the new router supersedes it.

## Filter before serialization

Phase 2's rule, still binding. A symbol pack installed on a project the caller
cannot see must not appear in any listing, count or conflict message.

## Data, not code

New in force here but old in spirit: Phase 1 already treats bundle assets as
opaque bytes authenticated by SHA-256, with active-content canaries proving zero
execution. Contributions extend that rule from assets to *behavior descriptors*.
The canary technique transfers directly: a pack that ships something
script-shaped must be provably inert.

## Sentinel-per-file controlled RED

Each RED file carries exactly one product-completeness sentinel with a literal
marker and a gap list, so a controlled RED fails exactly once. Guarded lookups go
in a helper module — the classifier scans a failing test's echoed source, and an
exception name in a sentinel body reads as a broken harness.

## Three packaging lists, and commit before build

`tools/stage-hacs-packages.mjs`, `tools/validate-hacs-staging.mjs`,
`test/hacs-staging.test.mjs`. And: commit source, then build, then commit the
manifest, then re-run the gates. A green run from before the commit does not
count — that mistake has now cost two CI rounds.
