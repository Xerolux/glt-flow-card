---
phase: 02-authoritative-policy-controls-collaboration
status: covered
requirements: [SEC-01, COLLAB-01]
plans: 17
---

# Phase 02 Source Coverage Audit

## GOAL

| Source item | Coverage | Plans |
|---|---|---|
| Every shared read, mutation, subscription, control, remote operation, and audit decision is server-authorized. | COVERED | 02-06, 02-07, 02-10, 02-11, 02-12, 02-14, 02-15, 02-16, 02-17 |
| Concurrent engineers cannot overwrite one another. | COVERED | 02-08, 02-09, 02-13, 02-16, 02-17 |

## REQ

| Requirement | Coverage | Plans |
|---|---|---|
| SEC-01: fixed Companion-enforced roles, all project-scoped surfaces, server ACLs, HA ceiling, default deny, multi-user denial. | COVERED | 02-01, 02-02, 02-04, 02-06, 02-07, 02-10, 02-11, 02-12, 02-14, 02-15, 02-16, 02-17 |
| COLLAB-01: expected revision plus server lease atomically, lifecycle/reconnect, denial, conflicts, merge/retry/recovery, no lost updates. | COVERED | 02-01, 02-03, 02-05, 02-08, 02-09, 02-13, 02-14, 02-15, 02-16, 02-17 |

## CONTEXT

| Locked decision group | Coverage | Plans |
|---|---|---|
| HA connection identity; fixed Viewer/Operator/Engineer/Admin matrix; default-deny all routes; HA ceilings; non-enumeration. | COVERED | 02-02, 02-06, 02-07 |
| Control ID plus bounded declared input; current-head exact service/target/data; strict schemas/gates; zero calls on rejection. | COVERED | 02-04, 02-11 |
| Accepted/dispatched/readback-confirmed/timed-out/denied/failed evidence; trusted audit separated from bounded untrusted telemetry. | COVERED | 02-04, 02-10, 02-11, 02-12 |
| Exact revision plus connection/session/purpose-bound opaque lease for every shared mutation; renewal/expiry/release/disconnect/no grace. | COVERED | 02-03, 02-08, 02-09 |
| Atomic in-lock role/lease/revision/digest/policy checks; reconnect never resurrects; bounded conflict evidence and non-destructive merge. | COVERED | 02-03, 02-08, 02-09, 02-13 |
| Capability snapshot is UX only; missing/stale/rejected authority is immediately read-only; no fallback; standalone local remains explicit/separate. | COVERED | 02-05, 02-12, 02-13 |
| Exact generated artifact, two-session German/English tests. | COVERED | 02-05, 02-13, 02-15, 02-16, 02-17 |
| Deferred semantic profiles, rich Phase-4 control UI, SDK namespaces, and Phase-9 remote transport stay out. | EXCLUDED AS DEFERRED | No implementation plan; legacy remote paths are policy-declared fail-closed only. |

## RESEARCH / VALIDATION

| Feature or constraint | Coverage | Plans |
|---|---|---|
| `COMMAND_POLICIES` equality, centralized policy, thin handlers, all legacy/new routes declared. | COVERED | 02-02, 02-06 |
| Separate versioned access store, one-time conservative legacy bootstrap, eligible HA users, access revision. | COVERED | 02-02, 02-07, 02-14, 02-16, 02-17 |
| Reauthorized subscriptions and scoped opaque cursors (50/page; TTL/count bounds). | COVERED | 02-02, 02-07, 02-10 |
| Opaque CSPRNG leases, TTL 60–900/default 300, rotation and runtime cleanup. | COVERED | 02-03, 02-08, 02-14, 02-16, 02-17 |
| In-lock mutation guard and Phase-1 journal/snapshot/forward-recovery reuse. | COVERED | 02-03, 02-09 |
| Bounded three-way semantic merge, candidate preservation, no patch replay/LWW. | COVERED | 02-03, 02-09, 02-13 |
| Control bounds (4 KiB, depth 4, nodes 64, keys 16, strings 512, arrays 32), preview/execute rates, HA permissions, no auto-repeat. | COVERED | 02-04, 02-11 |
| Trusted event 8 KiB/32 MiB and telemetry 4 KiB/30 per min/1,000 rows/4 MiB, separate stores. | COVERED | 02-04, 02-10 |
| Stable public errors, i18n, accessibility, secret/effect ledgers. | COVERED | 02-05, 02-12, 02-13 |
| Legacy migration, old-card/new-Companion incompatible read-only, reload/unload resource-zero. | COVERED | 02-04, 02-14 |
| Exact generated copies, clean build, local HACS stages, HA 2024.8.0 and 2026.8.3. | COVERED | 02-15 |
| Bilingual docs/wiki workflow. | COVERED | 02-16 |
| Threat/evidence closure and no-rebuild release acceptance through one cycle-free T2-16 leaf owner; the outer Phase-2 orchestrator aggregates that leaf exactly once. | COVERED | 02-17 |
| ASVS L1 and T2-01 through T2-16 release blockers. | COVERED | 02-01 and each plan's threat model |
| Resolved A1 exact operational/resource defaults are normative and boundary-tested. | COVERED | 02-04, 02-10, 02-11, 02-14, 02-16, 02-17 |
| Resolved A2 permits minimal unassigned-HA-admin membership administration but no implicit content/control/audit authority. | COVERED | 02-02, 02-06, 02-07, 02-08, 02-14, 02-16, 02-17 |
| Resolved A3 keeps exact access/content revisions separate while validating one purpose-bound engineering lease. | COVERED | 02-03, 02-07, 02-09, 02-16, 02-17 |
| Resolved A4 treats configured plant controls as capability/preview/permission operations without an engineering lease. | COVERED | 02-04, 02-11, 02-16, 02-17 |
| Resolved A5 uses short-lived server-state cursors invalidated by restart. | COVERED | 02-02, 02-07, 02-16, 02-17 |
| Resolved A6 declares remote routes fail-closed unavailable until Phase 9. | COVERED | 02-02, 02-06, 02-11, 02-16, 02-17 |

No source item is missing. No deferred item is planned. No package install is introduced.

Command ownership is also complete and non-recursive: `test:phase2` is the outer orchestrator, `test:phase2:release` is T2-16's sole leaf owner, and release/HACS/HA helpers reachable from that leaf cannot call either Phase-2 command.
