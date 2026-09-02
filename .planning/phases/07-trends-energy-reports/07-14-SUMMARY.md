# 07-14 — Report runs record what they were computed from

**Status:** complete. Closes T7-14 (D19, D23).

A run resolves its period and records window, timezone, aggregate, deadband,
sources, coverage and version. The shipped report was a snapshot of the current
screen with a period label nothing read, so a "Monatsbericht" contained one
instant and said so nowhere.

**Ids are content-derived.** Phase 5 found and fixed the same `Date.now()` defect
in paste, for the same two reasons: a clock-derived id is not reproducible and
collides within a millisecond. Reports are the one artefact in this product
explicitly required to be reproducible.

Both halves of reproducibility, and the second matters as much as the first: **a
report that silently produces a different number the second time is worse than
one that refuses**, because the first version has already been sent to someone
and the difference is the thing nobody can see. `changed_inputs` names the fields
that differ rather than reporting a boolean — "this number changed" without "and
here is what changed" leaves the reader to guess, and the plausible guess is that
the plant changed.

`spec_for` refuses an unmapped period rather than defaulting. A report whose
period silently became "today" is the class of defect this plan closes.

**A second under-specified contract of mine, corrected.** The sentinel asked for
`changed_inputs` without giving anything to compare against. A caller with stored
runs passes the previous run, so the assertion now does that, and additionally
checks that the changed field is *named* and that an identical re-run reports
itself as reproducing rather than merely matching by value.

---

*Written retrospectively during 07-20 from the plan's commits (d2e5018); the summary was missed when the plan landed. Nothing here is recalled — every claim is taken from the committed message and the code at head.*
