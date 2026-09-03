# 04-11 — Sent is not the same as happened

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

Phase 2 produces nine control states; this plan renders them as four visibly
distinct operator outcomes. **Only `readback_confirmed` is success** — the
state where the plant was read back and agreed. Everything else, including
"the command was accepted", renders as not-yet-confirmed, because an operator
who walks away from an accepted-but-unconfirmed command has walked away from a
command that may not have landed.

**No outcome state offers a retry affordance.** A retry button on an
indeterminate outcome invites a second write when the first may already have
taken effect.

The displayed target and result match the authoritative audit record for the
same command id, so what the operator saw and what the log records cannot
diverge.
