# 10-11 — The registry, and the two claims it refuses to merge

**Status:** complete. Closes T10-10, T10-11 and T10-12. **This is the phase.**

Three rules, each closing a row:

**A claim with no evidence fails the build.** Not a warning. The failure mode
was already here: `README.md` said "`test/` – lightweight validation tests"
while the suite was 521 Node and 92 browser tests. Harmless in that direction;
the same staleness the other way is an operator trusting something that stopped
being true.

**A failed claim is published as failed.** Omitting it lets its absence read as
"not applicable" — Phase 9's counting-oracle shape, one level up.

**Automated and manual accessibility evidence stay separate.** Automated rules
decide a minority of WCAG criteria by construction, so "automated checks pass"
merged with "manual pass recorded" into "WCAG 2.2 AA" is a statement neither
piece of evidence supports. The registry has **no schema** in which they
combine: the merge is not a policy someone can override, it is a structure with
nowhere to put the result. Conformance wording in an automated claim is refused
outright.

T10-10 and T10-13 are this phase auditing itself. Both describe a claim this
work was in a position to make and would have been believed about — which is why
the registry is a build step rather than a document.
