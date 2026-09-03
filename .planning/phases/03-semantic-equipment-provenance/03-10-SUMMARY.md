# 03-10 — Profiles: versioned, parametric, and deny-default

> **Reconstructed at close-out**, from this plan, `03-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete. Closes T3-07 and T3-08.

**Two instantiations of one profile version are byte-identical.** Anything less
means the profile is not the thing being versioned.

**An upgrade carries every still-addressable override and reports what it
cannot.** Silently dropping an override that no longer addresses anything is how
a commissioning decision disappears; reporting it makes the loss a decision.

**A profile names no domain, service or target.** It is deny-default, so a
profile cannot become a way to author a control that the server would otherwise
refuse — the Phase-2 rule holding one layer further in.
