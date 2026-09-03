---
phase: 02-authoritative-policy-controls-collaboration
plan: 14
status: complete
completed: 2026-09-02
requirements: [SEC-01, COLLAB-01]
threats_green: [T2-05, T2-15]
---

# Plan 02-14 Summary — Migration and Lifecycle (GREEN)

## What was built

**Task 1 — conservative migration.** The legacy 30–3600 s lock window does not
survive the upgrade: a 30-second lease expires faster than a person can read a
confirmation, and an hour-long one strands a project when a browser tab closes.
`const.py` now owns the 60–900 s window and `project_leases` imports it, because
two copies of a bound are one edit away from drifting apart.

`migrate_options` clamps a stored value to the nearest legal bound rather than
resetting it to the default. An installation that deliberately chose 3600 meant
"as long as possible", and 900 is that; 300 would be a silent third choice
nobody made. Clamping is idempotent, so an upgrade that runs twice lands exactly
where one run does.

A persisted legacy lock is dropped, never minted into a lease. Turning a row in
a file into an exclusive editing capability would hand an absent browser the
only editor on upgrade, with nobody present to release it. Legacy audit rows are
kept and labelled `legacy_untrusted` instead of deleted — throwing away a site's
history would be its own kind of dishonesty — so they can never be read as a
claim about who did what, and never be confused with server-authored evidence,
which lives in a different store entirely. Both steps are idempotent.

The ACL bootstrap behaviour from 02-06 is unchanged and still covered: active
head only, fixed roles only, never `admin`, never from an imported candidate,
and nothing at all from a malformed permissions block.

**Task 2 — lifecycle.** Added the cases the sentinel did not reach:

- unload while a lease is genuinely held, because an unload only ever tested
  from an idle runtime proves nothing;
- ghost commands after unload. Home Assistant registers WebSocket commands once
  per process, so an unloaded entry cannot unregister them; the boundary refuses
  by itself with `not_loaded` and zero service attempts;
- a failed reload restoring the previous *options* without restoring the
  previous *authority* — otherwise a rejected configuration change becomes a way
  to resurrect a capability.

## Note on the updated test

`test_lease_ttl_window_tightens_the_legacy_lock_range` previously asserted the
legacy range was *still* wider, with a comment saying it was only meaningful
until this plan landed. It now asserts the tightened window directly, which is
what it was always a placeholder for.

## Verification

| Command | Result |
|---|---|
| `pytest test_phase2_migration.py test_phase2_lifecycle.py test_options.py test_init.py -q` | all pass |
| `pytest tests/components/glt_flow_card -q` | 175 passed |
| `node tools/run-unit-tests.mjs` | 125 passed, 0 failed, 0 skipped |
| `node tools/run-exact-dist-playwright.mjs` | 29 passed |
| `npm run validate:hacs-staging` | 4 PASS |
| `node tools/phase2-red-gate.mjs` | 12 implemented, 0 controlled RED, 0 broken |

## Constraints honoured

No live Home Assistant write, no service call, no remote or physical-bus write,
no credential handling. No release is authorized.
