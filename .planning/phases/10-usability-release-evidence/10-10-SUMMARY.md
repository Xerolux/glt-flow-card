# 10-10 — A harness that measures, and says where

**Status:** complete. Groundwork for T10-13 and T10-14.

The roadmap names the defect: *a 2,000-object diagnostics micro-test presented
as platform capacity.* The correction is not a bigger micro-test.

Six scenarios at 100, 500 and 2,000 objects covering the dimensions TEST-01
lists — render, live updates, routing, editing, persistence, remote partial
failure — committed before anything measures them, so a scenario cannot quietly
become whatever happened to be fast.

**A scenario that did not build what it declared fails**, in both directions: 0
objects and 1,999. The first is this phase's vacuous pass and the most
believable of the four, because it looks like good news.

**Nothing in the harness can mark an environment representative.** The flag
means a person ran this on named hardware; an inferred flag turns true by
accident on the machine where it matters least.
