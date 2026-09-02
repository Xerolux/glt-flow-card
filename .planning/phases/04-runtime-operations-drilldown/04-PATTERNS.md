# Phase 04 Patterns

Patterns this phase must follow, each one already load-bearing somewhere in the
repository. Phase 4 introduces no new architectural pattern; it applies existing
ones to a new surface.

## Filter before serialization

Established by Phase 2's collection routes (`projects/list`, `evidence/list`,
`alarms/list`). A handler builds the authorized set first and serializes only that.
It never builds a full result and redacts, because a redaction that misses a field is
invisible until someone finds it.

Phase 4 applies this to the panel model, the navigation ancestry, the child lists and
the aggregate counts. In particular, a control the caller may not execute is **absent
from the response**, not present with `enabled: false`.

## One opaque denial

Established by `not_found_or_denied`. A hidden project, a missing project, a deferred
route and an unauthorized target all answer identically, byte for byte. Phase 4 adds
deep-link addresses to the set of things that must answer this way.

The test shape is the one Phase 2 used: assert the two responses are equal, not merely
that both are errors.

## Server composes, browser renders

Established by Phase 2's `capabilities/get` and the decision that the browser never
derives a role-to-capability matrix. Phase 4 extends it: the browser never derives a
control list, a permitted-navigation list or a count.

Corollary, from Phase 2's `RoleMatrixDisclosure`: when the server cannot yet supply a
region's content, the region renders a **declared unavailable state**. It does not
render an empty region, and it does not invent content. Phase 4's trend region uses
this until Phase 7.

## Fail closed in the same render cycle

Established by `project-authority.mjs`, where all ten authority-loss events produce
read-only in one transition. Phase 4's view state machine must do the same for its own
loss events: sequence gap, reconnect, revocation, incompatible snapshot. There is no
intermediate render where the old data is still interactive.

## Preserve the candidate through every recoverable failure

Established by `project-collaboration.mjs`. Applied here to operator input: a command
form, a selected time window and a selected alarm survive a resync. A user who typed a
setpoint and hit a reconnect must not lose it.

## Deny-default closed sets

Established by `CAPABILITIES`, `CONTROL_RESULT_STATES`, `STATE_PRECEDENCE` and the
Phase-3 vocabularies. Phase 4's own closed sets — the panel region kinds, the
navigation level kinds, the view staleness reasons — are frozen exports with a
membership test, and an unknown member is an error rather than a passthrough.

## The address is the state

New application of an old rule. Everything needed to reconstruct a view lives in the
URL: node address, time window, selected alarm. State kept only in a component cannot
be deep linked; state kept in both drifts. The serializer and parser are pure and
round-trip tested against a corpus including hostile inputs.

## Sentinel-per-file controlled RED

Established in Phase 1 and enforced by `tools/assert-red.mjs`. Each Phase-4 RED test
file carries exactly one product-completeness sentinel with a literal
`EXPECTED_RED[...]` marker and reports every unmet guarantee as a gap list, so a
controlled RED fails exactly once.

## Retire, do not delete

Established by `glt_flow_card/control/execute` and `projects/lock`/`unlock`, which
stay declared with `state="retired"` so the registration oracle can prove they fail
closed. Phase 4 retires the legacy browser tap path the same way: the code path stays
reachable by a test that proves it produces zero effects, rather than being deleted
into a place where nothing checks it again.

## Three packaging lists

Learned the hard way in Phase 3. A Companion module imported at module scope must be
added to `tools/stage-hacs-packages.mjs`, `tools/validate-hacs-staging.mjs` and
`test/hacs-staging.test.mjs`. Two out of three passes every local gate and fails
`ha-artifacts` with a `FileNotFoundError` at import.

## Commit source, then build, then commit the manifest

`build-manifest.json` records the last commit touching a canonical source. Building
before committing the source always leaves `verify:release` red.
