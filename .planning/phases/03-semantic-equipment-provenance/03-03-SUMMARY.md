# 03-03 — Provenance stated as a refusal to infer

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

The sentinel asserts that provenance comes from registries and config entries
and **never from an entity id or a friendly name**. That is the whole point:
an integration guessed from `sensor.modbus_vorlauf` looks like knowledge and is
a string match.

Communication health is asserted against unavailable, disabled, failed-entry and
stale cases, so "healthy" means all four were checked rather than none.

**An unauthorized entity answers exactly as a missing one.** Anything else makes
the route an existence oracle for entities the caller may not see.
