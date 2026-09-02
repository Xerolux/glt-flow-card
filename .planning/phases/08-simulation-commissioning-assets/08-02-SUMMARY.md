# 08-02 — Vocabularies and schema 7

**Status:** complete.

Three closed vocabularies, mirrored between runtimes and compared directly.
Phase 6 shipped **four** independent alarm-severity vocabularies and an alarm
created as `critical` was counted in none of them; this is the test that was
missing then.

`PHYSICAL_KINDS` is **derived** from the behaviour table rather than listed
twice. Written twice, the two drift, and the gate then either misses a path or
blocks one nobody meant to block.

The parity test failed on its first run — over separators and nested key
ordering. That is the byte-parity trap this codebase has now hit four times
(`toISOString` milliseconds, `0` against `0.0`, and twice here). Both sides emit
the project's existing canonical form.

**Work-order transitions:** `completed → open` exists, because reopening
happens. What must not exist is a *silent* one. The reason requirement is keyed
on the `from → to` **pair** rather than the target, because `assigned → open` is
handing a job back and `completed → open` is saying the work was not in fact
done — only the second must justify itself.

**Schema 7 removes rather than adds.** `simulation.enabled` and
`gates.simulation` were safety properties living in operator data; `work_orders`
was a second store that never reconciled with the Companion's. All three are
quarantined into `legacy` so a site can see what it had.

Adding a schema version touched **seven independent lists** — the validator
generator, three packaging lists, the Python contract's ordered tuple, the
bundle-manifest bound and the release manifest's expected artifacts. Each failed
on its own and was fixed on its own, which is the design working.
