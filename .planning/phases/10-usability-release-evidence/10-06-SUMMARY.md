# 10-06 — The two runtimes say the same thing, not merely mean it

**Status:** complete. Closes T10-06.

Every existing parity gate compares **codes**. None covers wording, so the
Companion and the browser could drift in what they *say* while agreeing on what
they *mean* — and a German operator reading a Companion refusal and the
browser's rendering of the same condition would see two different sentences and
reasonably conclude they were two different conditions.

Compared as canonical bytes, for the reason recorded four times: two earlier
parity efforts agreed on every value and disagreed on every byte.

Three guards, because a parity check that cannot fail is the least informative
kind of green: the shared namespace must be non-empty (two empty objects are
byte-identical), a changed sentence must break the comparison (verified by
mutation), and a wording group added on one side only is **refused** rather than
dropped from the comparison and reported as agreement.
