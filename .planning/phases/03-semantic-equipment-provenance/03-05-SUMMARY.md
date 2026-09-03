# 03-05 — Schema 3, and a migration that is receipted

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

Schema 2 could not express the model: `semantic_model` was an unvalidated open
object and `sites` carried only an id. Schema 3 is generated from schema 2 in
both runtimes from **one** source, and schema 2 is frozen — a schema edited in
place is a schema whose old documents no longer validate against what they were
written for.

The 2→3 migration is sequential, receipted, lossless over the whole corpus and
idempotent, on the machinery Phase 1 built rather than a second path.
