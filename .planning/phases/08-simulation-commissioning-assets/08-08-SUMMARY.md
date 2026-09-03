# 08-08 — Notifications are marked, not silenced

**Status:** complete. Closes T8-05.

The obvious reading of "block everything during simulation" suppresses alarms,
turning a commissioning rehearsal into a window in which nobody is told about a
real fault. That is a safety defect in the other direction and a **worse** one,
because a person who hears nothing assumes nothing happened.

So the message goes out and states on its face that the plant was simulated. The
sentence is written out in both languages rather than assembled from fragments —
Phase 6 established that for the schedule preview, because a sentence built from
pieces reads as machine output in exactly the situation where a human must trust
it.

`simulated` also travels as a **field** on the delivery record, so the audit can
separate rehearsal traffic afterwards without parsing German prose.

Report delivery is marked for the same reason: a report produced from simulated
inputs must say so on its face rather than fail to arrive, since a missing report
is noticed late and a wrong one is not noticed at all.
