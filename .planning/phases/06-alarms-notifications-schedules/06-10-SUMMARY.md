# 06-10 Summary — retention and reconciliation

**Status:** complete. 10 retention tests.

**D8.** The prune compared `k.split(":")[-1][:10]` against a date, but the last
segment was the *minute*, so `"30" >= "2026-08-19"` held forever. The fix is not
a better parser — the prune reads the stored instant and never looks at the key.
A test uses a run key whose own id segments contain colons.

**D9.** Every insertion goes through one `_append_history`, and the test
*exercises* all three writers past the bound rather than reading the source.

**D14.** Reconciliation runs from the same place the index is rebuilt, because
both answer "which alarms exist". What was dropped is written to history: an
operator whose acknowledgement vanished with a rename deserves a record.

The `legacy_prune_drops_nothing()` reproduction stays and is asserted, so if the
defect stops holding the test says it is no longer measuring what it was written
for.
