---
phase: 02-authoritative-policy-controls-collaboration
plan: 16
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: []
---

# Plan 02-16 Summary — Bilingual Documentation and Docs Delivery

## What was built

**Task 1 — truthful bilingual documentation.** `README.md` and `README.de.md`
gain a "Shared authority and collaboration" section covering, in both languages
with the same semantics: fixed roles held only in the Companion's access list
(A2's ceiling included — a Home Assistant administrator gets membership repair
and nothing else), identical answers for a hidden and a missing project, the
60–900 s connection-bound lease window with a 300 s default (A1), separate
content and access revisions (A3), conflicts that preserve the candidate and
offer refresh / merge preview / retry / discard but never overwrite, controls
whose whole effect the server resolves from the verified head with an operator
path that needs no engineering lease (A4), trusted evidence and untrusted
telemetry in separate stores, short-lived server-state cursors with no exposed
total (A5), local-only as an explicitly labelled separate mode, remote routes
failing closed until Phase 9 (A6), and the upgrade behaviour for legacy locks,
audit rows and permissions blocks.

Three stale claims were corrected rather than extended: `Companion-Backend.md`
still advertised "Viewer / Operator / Designer" roles and TTL locks, and
`Installation.md` still listed locks among Companion-enforced operations.
`YAML-Projects.md` gained an explicit statement that project content grants no
access at all.

No availability, capacity, remote-security or live-plant claim is made beyond
the evidence, and nothing about credentials beyond the existing `!secret`
reference.

**Task 2 — exact, least-privilege docs delivery.** `docs.yml` gains a `validate`
job that both delivery jobs depend on: every documentation source must be
present and non-empty — the wiki job copies them verbatim, so an empty source
would silently delete a published page rather than fail — and the site build
must be byte-identical across two runs. `checkout` and `setup-node` are pinned
to the same digests the other workflows use. The wiki job drops its full-history
checkout, since it reads only `docs/wiki`, and its push is documented as never
forced.

## Known gap

`actions/configure-pages`, `actions/upload-pages-artifact` and
`actions/deploy-pages` remain on release tags rather than digests. This session's
GitHub access is scoped to this repository, so their release digests cannot be
verified here, and pinning to an unverified SHA would be worse than a tag. The
workflow says so at the point of use.

## Verification

| Command | Result |
|---|---|
| `node tools/build-site.mjs` twice, `diff -r` | byte-identical |
| `node --test test/phase1-gate.test.mjs` | 7 passed |
| YAML parse of `.github/workflows/docs.yml` | valid |

## Constraints honoured

No publication, no live system contacted, no credential instruction beyond the
existing secret reference. No release is authorized.
