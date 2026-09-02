# 05-08 — An endpoint that survives being worked on

**Status:** complete
**Requirements:** ENG-01 · **Threat:** T5-05 GREEN

## What was actually missing

`from_port` and `to_port` already existed on `path`, and `smartRoute` already
read them. The reference was there. What was missing was anything that
*preserved* it: paste regenerated object ids from `Date.now()` and rewrote no
reference at all, so a pasted connection still pointed at the objects it had
been copied from — and did so differently on every machine that ran it.

## What shipped

`resolveEndpoint`, `brokenEndpoints`, `portAnchor` and `remapIdentifiers` in
`src/v100/ports.mjs`, mirrored as `resolve_endpoint`, `broken_endpoints`,
`port_anchor` and `remap_identifiers` in
`custom_components/glt_flow_card/ports.py`.

## The decisions

**Geometry is derived, never stored.** An anchor is computed from the resolved
port's declared side and its equipment's box. Moving equipment therefore moves
the endpoint and cannot change which port is meant — the two are not the same
fact, and storing the second would let them disagree.

**A broken endpoint is reported, never reattached.** The tempting alternative is
snapping to the nearest port, or to the first one. That turns a diagram somebody
has to fix into a diagram that is quietly wrong, and a quietly wrong diagram is
the one that gets built. A refusal names the path, the end, the equipment, the
port it was looking for, and which of the three ways it broke:
`equipment_missing`, `port_unspecified`, `port_missing`.

**A new id is its prefix and its old id, never a clock reading.** The previous
paste read `Date.now()`, so the same paste produced different documents on two
machines and put two collaborators into a merge over a difference neither of
them made. Determinism here is a collaboration property, not a testing
convenience.

**Port ids are not remapped, and profiles are not copied.** A port id is scoped
to its profile; the profile is not being copied, so rewriting `out` to
`copy-out` would break the very endpoint the function exists to preserve.
Duplicating profiles would turn one equipment type into two that drift apart.

**The mirror is not optional.** A project arriving through the websocket API, a
merge, or a bundle import has not been through the editor, and an endpoint that
silently detached there would be persisted as authoritative.

**Also honoured: an equipment may override its profile's ports.** A one-off
machine carries its own, and the endpoint still resolves — to the equipment's
port, not the profile's.

## Evidence

- `node --test test/port-identity.test.mjs` — 9 tests, all passing. All four
  survival paths are *exercised*, not merely named: an edit, a paste, a real
  bundle round trip through `createProjectBundle`/`readProjectBundleArchive`,
  and the schema-4 shape carrying both halves of every pair. The test asserts
  the set of paths it covered equals `SURVIVAL_PATHS`, so a path cannot fall out
  of coverage while the constant still lists it.
- `pytest tests/components/glt_flow_card/test_port_identity.py` — 10 tests, all
  passing, against the CAD corpus rather than a two-object fixture: a corpus
  with shared profiles is the one where a port id alone stops being an identity.
  The Companion test also derives every anchor independently, through
  `cad_factory.port_anchor`, and requires the two computations to agree.
- The migration half is checked end to end where the migrator lives: the corpus
  is taken down to schema 3, migrated back to 4, and every endpoint required to
  be the one it started as.
- `ports.py` was added to the stager, the independent validator and the staging
  test — three separate statements of the package contents, as before.
