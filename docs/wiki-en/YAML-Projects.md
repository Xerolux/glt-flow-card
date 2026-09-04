# YAML import, projects and versions

## YAML round-trip

The designer accepts existing `custom:glt-flow-card` YAML, preserves unknown
options and emits the whole configuration again. Switching between YAML and
visual editing is therefore unlimited.

Raw JSON/YAML project data is checked against bounded schema, byte, depth,
string and collection budgets before normalisation. Errors report stable,
understandable paths. A migration from historical versions runs sequentially
as a dry run; only after reviewing the receipt and the semantic diff may the
Companion apply it authoritatively.

## Project library

Projects can be saved, loaded, duplicated and deleted. A manual save creates a
version; autosave updates the current state without flooding the version list.

Without the Companion backend the library lives in `localStorage`. With the
backend it is stored in Home Assistant's `.storage` and is available across
devices.

Standalone projects stay explicitly browser-local. For shared projects the
Companion recomputes migration, diff, dependency closure and candidate.
Conflicts from stale revisions or foreign previews abort; there is no local
fallback. Selective apply uses stable change ids. Rollback restores a
server-owned, hash-checked snapshot as a new forward revision and does not
rewrite history.

## Project content grants no access

A `permissions` block, a role statement or a user list inside project JSON or
an imported `.gltproject` bundle grants nobody anything. Assignments live
exclusively in the Companion's access list and change through membership
administration. On upgrade, a legacy `permissions` block on the *active*
project state may pre-seed membership once and conservatively — never as
administrator; an imported draft may never do so.

Collaborative editing requires an exclusive, connection-bound edit lease.
Content and access revisions are separate streams. A conflict preserves the
draft in memory and offers refresh, merge preview, retry with a fresh lease or
explicit discard — never overwrite.

## Project diff and bundles

The semantic diff distinguishes additions, removals, moves, binding and
configuration changes. Only explicitly declared identity lists ignore
orderings. Missing or cyclic dependencies and selections that cannot close are
refused.

`.gltproject` bundles are fully checked for path traversal, aliases,
collisions, overlap, encryption, compression bombs and version bounds before
being read. Bundle identity is a hash; a mismatched hash is a different bundle.

## Versions

Every project carries a monotonically growing revision. Saves name the
revision they build on; a save against an older revision is a conflict, not an
overwrite.
