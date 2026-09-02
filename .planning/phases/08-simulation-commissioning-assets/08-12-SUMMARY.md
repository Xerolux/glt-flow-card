# 08-12 — Work orders become records

**Status:** complete. Closes T8-18 and T8-19.

`save_work_order` did `{**old, **work_order}`. Completing an order erased who
opened it and when, and a completed record was indistinguishable from a rewritten
one. A maintenance history that can be silently edited is not evidence of
anything.

Entries are append-only. A **correction is a new entry naming what it corrects**;
the wrong entry stays, marked. That is the difference between a history and a
draft.

**Status is derived from the entries** rather than stored beside them. A stored
status can drift from the entries that were supposed to produce it, and then the
record and the display disagree while both look authoritative.

Transitions are checked **before** the append, so a refused transition leaves no
trace of having nearly happened, and the refusal names both the current and the
attempted status.

The two stores are reconciled: the Companion's is authoritative, and schema 7
removes `work_orders` from the project document. Two stores that never reconcile
meant the table an engineer saw and the one the Companion held were different
lists both claiming to be the work orders.

The responsible person is a Home Assistant **user id**, not free text, so "who is
responsible" is resolvable, notifiable and permission-checkable.
