# 03-01 — Registry fixtures and the Phase-3 gate

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

The fixtures cover the cases a registry actually produces rather than the happy
one: core and custom integrations, disabled entities, unavailable entities, and
entities that are simply absent. A provenance answer is only as honest as the
states it was tested against, and "absent" is the case a naive implementation
turns into an invented protocol.

The RED classifier knows every Phase-3 sentinel key **and still rejects a
harness failure, a zero-test run and an unrelated failure** — a controlled-RED
gate that accepts any red is a gate that accepts a broken harness.

The command scripts are non-recursive from the outset, which is the property
Phase 5's gate later had to be repaired to hold.
