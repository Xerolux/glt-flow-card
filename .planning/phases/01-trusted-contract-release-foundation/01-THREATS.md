---
phase: 01
status: verified
security_standard: OWASP ASVS L1
high_findings_block_execution: true
---

# Phase 01 Canonical Threat Ledger

This ledger preserves the stable T-01..T-08 identities from `01-RESEARCH.md`. Plan threat tables reference these IDs verbatim. Every threat is HIGH for execution readiness: the owning task and command below must pass before Phase-1 sign-off.

| ID | Stable threat description | STRIDE | Asset / boundary | Owning plan/task | Exact mitigation | Automated command | Status |
|---|---|---|---|---|---|---|---|
| T-01 | Client alters candidate/selection after preview | Tampering / Elevation | Candidate, selected change IDs, dependency closure / browser→Companion WebSocket | 01-07-T2 | Bind preview to HA user, project, base revision/digest and candidate digest; accept stable IDs only; server rereads, revalidates, remigrates, recomputes diff/closure/candidate before commit | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_transactions.py tests/components/glt_flow_card/test_websocket.py -q -k "preview or selection or stale or closure"` | verified 2026-09-01 |
| T-02 | User invokes rollback with browser-forged receipt | Spoofing / Repudiation | Snapshot identity and audit receipt / browser→Companion rollback command | 01-07-T2 | Resolve server-owned immutable snapshot ID/hash under authenticated HA identity; require typed confirmation and expected revision; create a new forward revision and server receipt | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_transactions.py tests/components/glt_flow_card/test_websocket.py -q -k "rollback or receipt or identity"` | verified 2026-09-01 |
| T-03 | Oversized/deep/regex-hostile JSON | Denial of service | Raw JSON bytes/tree/strings/collections / file, Lovelace or store→contract engine | 01-04-T2 | Enforce byte/depth/node/string/collection/error budgets before Draft 2020-12 validation in JS and Python; safe repository schemas/patterns; shared boundary corpus | `npm run test:contract:parity && node --test --test-name-pattern="rejects raw oversized and deeply nested documents" test/v100-contract.test.mjs && py -3.13 -m pytest tests/components/glt_flow_card/test_project_contract.py -q -k "oversized or deep"` | verified 2026-09-01 |
| T-04 | ZIP traversal, alias, collision, overlap, bomb | Tampering / Denial of service | Archive members and filesystem / untrusted `.gltproject`→bundle reader | 01-06-T1 | Complete central-directory preflight; normalize separators and NFC; reject absolute/drive/UNC/NUL/control/dot/backslash/symlink/duplicates/case collisions/overlap/encryption/unsupported methods/CRC/hash/size/count/ratio violations before extraction | `npm run test:bundle && py -3.13 -m pytest tests/components/glt_flow_card/test_project_bundle.py -q -k "reject or limit or collision or traversal"` | verified 2026-09-01 |
| T-05 | SVG/HTML/script asset executes during inspection | Elevation / Information disclosure | Custom asset bytes / bundle→Project safety DOM | 01-11-T3 | Preserve assets as opaque bytes through preflight; show metadata only; forbid active preview/HTML injection, unexpected network, and service calls | `npm run build && npm run test:e2e -- --grep="opaque asset|xss|network|no service" && npm run test:e2e` | verified 2026-09-01 |
| T-06 | Interrupted apply corrupts head/history | Tampering / Denial of service | Active revision, snapshots and journal / transaction→split stores | 01-07-T2 | PREPARED journal, immutable content-addressed snapshot, read-back digest checks, active save verification, COMMITTED marker, deterministic startup recovery, failure injection | `py -3.13 -m pytest tests/components/glt_flow_card/test_project_transactions.py -q -k "interruption or recovery or journal or immutable"` | verified 2026-09-01 |
| T-07 | Diagnostics or bundle leaks remote tokens/state | Information disclosure | Tokens, remote config, entity state, project bodies / backend→diagnostics/evidence/export | 01-08-T3 | Construct diagnostics/evidence from explicit metadata allowlists; never serialize resolved secrets, tokens, URLs, states, project/asset bodies or raw audit bodies; assert seeded canaries absent | `py -3.13 -m pytest tests/components/glt_flow_card/test_diagnostics.py -q -k "redact or canary or allowlist"` | verified 2026-09-01 |
| T-08 | Generated/release artifact differs from reviewed source | Tampering / Supply chain | Card, schemas, Companion ZIP and manifest / source+registries+CI→local staging/release | 01-13-T1 | Automated package provenance allowlist, lockfiles, full-SHA actions, build once, clean double-build, dist/www equality, canonical hashes/versions, exact-artifact HA/UI/category tests, checksums and attestation; no unapproved mirror publication | `npm run test:release-acceptance` | verified 2026-09-01 |

## Enforcement Rules

- The description text above is canonical; plan tables may abbreviate neither the identity nor the abuse case.
- Each owner is unique. Supporting plans may add controls, but cannot mark a threat closed.
- A command must execute behavior against exact artifacts or isolated runtime fixtures. Syntax checks, token searches, screenshots alone, and workflow-file presence do not close a threat.
- Any failed, skipped, missing, or non-reproducible owner command keeps the threat HIGH/open and blocks execution readiness and Phase-1 sign-off.
- Tests use isolated files, fake Home Assistant, or verified disposable official HA lanes. They perform no remote-site, physical bus, or plant write.
