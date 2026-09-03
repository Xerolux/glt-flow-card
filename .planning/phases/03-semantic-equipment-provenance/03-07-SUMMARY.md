# 03-07 — Semantic diff and schema-3 bundles

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

The diff categorises hierarchy and profile changes **with dependency closure**:
moving a parent is not one change, it is that change plus everything whose
derived path it alters, and a diff that shows only the edited node understates
what is about to happen.

Bundles carry schema-3 projects without weakening any archive bound — the bounds
are the thing an attacker-supplied bundle attacks, so a new payload shape is not
a reason to relax one.
