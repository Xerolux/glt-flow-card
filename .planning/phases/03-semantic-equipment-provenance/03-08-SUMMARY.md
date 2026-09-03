# 03-08 — Provenance from the registry, never from a name

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete. Closes T3-05 and T3-06.

Integration, config entry, device, area and communication health come from Home
Assistant's registries and state machine. **Nothing is inferred from a name.**

Health resolves in a fixed order — disabled, then unavailable, then stale —
because a disabled entity that is also stale is disabled, and reporting the
staleness sends someone to look at a sensor that was switched off on purpose.

The route is **project-scoped and describes only entities the project
references**, so it cannot become a registry search. A hidden project answers
byte-identically to a missing one.
