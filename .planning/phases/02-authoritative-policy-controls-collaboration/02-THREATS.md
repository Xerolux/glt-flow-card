---
phase: 02-authoritative-policy-controls-collaboration
status: planned
asvs_level: 1
asvs_version: 5.0.0
requirements: [SEC-01, COLLAB-01]
---

# Phase 02 Threat Register

All Phase-2 threats are release blockers until their owner command passes against behavioral tests and, where applicable, the exact generated artifacts. Home Assistant authenticates the transport; this phase still re-authorizes every message and event. No test may contact a live Home Assistant, remote site, fieldbus, or plant target.

## ASVS L1 Mapping

| ASVS area | Phase-2 control |
|---|---|
| V2 Authentication | Actor identity comes only from the active Home Assistant WebSocket connection. |
| V3 Session Management | Opaque leases/cursors are connection/session-bound, expiring, rotated, memory-only capabilities. |
| V4 Access Control | Fixed roles, server ACLs, HA ceilings, deny-default command inventory, object filtering, and per-event reauthorization. |
| V5 Validation | Strict route schemas plus byte/depth/node/key/rate/resource bounds; exact configured-control resolution. |
| V6 Cryptography | Python `secrets`, SHA-256 identities, and constant-time comparison only; no custom cryptography. |

## Canonical Threats

| ID | STRIDE | Abuse case / invariant | Owner plan | Blocking evidence |
|---|---|---|---|---|
| T2-01 | Spoofing | Client actor, role, capability, timestamp, ACL, or audit-owner claims influence authority. They must be ignored in favor of `connection.user` and server time. | 02-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_policy.py -q -x` |
| T2-02 | Elevation | Project Admin or HA Admin exceeds the fixed role matrix or Home Assistant ceiling. Effective authority is the intersection; HA admin alone grants no content/control/audit access. | 02-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_policy.py tests/components/glt_flow_card/test_project_access.py -q -x` |
| T2-03 | Elevation | A legacy or newly registered WebSocket route bypasses policy. Registered routes must exactly equal `COMMAND_POLICIES`; undeclared/unimplemented paths fail closed with zero effects. | 02-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_policy.py -q -x` |
| T2-04 | Information disclosure | Lists, direct reads, counts, search, subscriptions, cursors, audit, controls, or remote paths enumerate hidden projects. Filter before serialization and use one `project_unavailable` shape. | 02-07 | `py -3.13 -m pytest tests/components/glt_flow_card/test_policy_enumeration.py tests/components/glt_flow_card/test_policy_subscriptions.py tests/components/glt_flow_card/test_evidence_pagination.py -q -x` |
| T2-05 | Tampering / Elevation | Imported/project JSON self-grants membership, ACL revision is overwritten, arbitrary users/capabilities are assigned, or last-admin/above-ceiling changes succeed. ACLs are a separate server store and every change is guarded. | 02-07 | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_access.py -q -x` |
| T2-06 | Tampering / Elevation | Caller selects or overrides domain, service, target, immutable data, context, or a stale control definition. The server resolves one control ID from the verified current head. | 02-11 | `py -3.13 -m pytest tests/components/glt_flow_card/test_configured_controls.py -q -x` |
| T2-07 | Denial / Elevation | Unknown keys, templates, nested calls, unsafe services, oversized/deep inputs, or rate abuse reach Home Assistant. All reject before a service attempt. | 02-11 | `py -3.13 -m pytest tests/components/glt_flow_card/test_configured_controls.py -q -x` |
| T2-08 | Repudiation / Safety | Dispatch is falsely labeled confirmed, or post-dispatch failure causes an automatic repeat. Evidence must distinguish accepted/dispatched/readback-confirmed/timed-out/denied/failed/result-unknown and repair forward only. | 02-11 | `py -3.13 -m pytest tests/components/glt_flow_card/test_control_evidence.py -q -x` |
| T2-09 | Repudiation / Tampering | Browser telemetry forges trusted actor/time/result, grows without bound, or shares trusted export/filter semantics. Stores, factories, labels, cursors, bounds, and authorization stay separate. | 02-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_trusted_evidence.py tests/components/glt_flow_card/test_evidence_pagination.py -q -x` |
| T2-10 | Spoofing / Tampering | A lease is replayed across user, connection, refresh session, project, purpose, reconnect, renewal, expiry, unload, or restart. Tokens are opaque, rotated, connection-bound, memory-only, and invalidated without grace. | 02-08 | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_leases.py -q -x` |
| T2-11 | Tampering / Elevation | Role, ACL, lease, revision, digest, or policy changes between authorization and commit. Recheck all immediately inside the existing project transaction critical section. | 02-09 | `py -3.13 -m pytest tests/components/glt_flow_card/test_collaboration.py -q -x` |
| T2-12 | Tampering | Last-writer-wins, stale merge replay, dependency-invalid selection, or a second conflict loses an engineer's update. Preserve candidate and apply only bounded server-recomputed non-destructive merge selections. | 02-09 | `py -3.13 -m pytest tests/components/glt_flow_card/test_merge.py -q -x && node --test test/phase2-collaboration.test.mjs` |
| T2-13 | Elevation / Information disclosure | Stale/missing/rejected/incompatible authority leaves shared actions active or falls back to `callService`, local/shared storage, Lovelace mutation, direct targets, or network. Shared mode becomes read-only in the same render cycle. | 02-12 | `node --test test/phase2-authority.test.mjs && node tools/run-exact-dist-playwright.mjs --grep=authority` |
| T2-14 | Information disclosure / Tampering | Two-session UI leaks tokens/other-user data, loses candidates, hides denial/recovery, or is inaccessible. Exact-dist DE/EN keyboard, focus, live region, 320px/200%, forced-colors, and effect-ledger scenarios are mandatory. | 02-13 | `node tools/run-exact-dist-playwright.mjs --grep=phase-2-ui` |
| T2-15 | Denial / Elevation | Migration, setup, reload, unload, or late callbacks leave partial ACLs, ghost subscriptions/tasks/cursors/leases/rate buckets/control waits, or reusable old tokens. Runtime becomes unavailable first and resource ledger reaches zero. | 02-14 | `py -3.13 -m pytest tests/components/glt_flow_card/test_phase2_migration.py tests/components/glt_flow_card/test_phase2_lifecycle.py -q -x` |
| T2-16 | Tampering / Supply chain | Authored/source, generated card, Companion copy, HACS stage/ZIP, HA lanes, docs/wiki, or release evidence diverge; or tests cause a service effect. Build once, compare exact bytes, install exact stage, and fail on any unintended effect. | 02-17 | `npm run test:phase2:release` |

## Blocking Rule

Every row begins `planned`. Phase closure may change a row to `verified` only when the listed owner command passes, emits non-skipped behavioral evidence, and the final Phase-2 evidence manifest binds the command output to the exact generated artifacts. Any HIGH finding, missing owner, skipped test, zero-test run, unbounded path, live target, or non-zero unintended service effect blocks release.

T2-16 has one canonical non-recursive owner: `npm run test:phase2:release`. That leaf script runs exact HACS validation, both immutable HA artifact lanes, release verification, no-rebuild release acceptance, and their zero-effect ledger checks. The outer `npm run test:phase2` / `tools/verify-phase2.mjs` chain may invoke this leaf exactly once. Neither the leaf nor any command reachable from it may invoke `test:phase2`, `tools/verify-phase2.mjs`, or `test:phase2:release`; release acceptance consumes the already-created manifest-hashed stage and preceding evidence and never launches either Phase-2 command.
