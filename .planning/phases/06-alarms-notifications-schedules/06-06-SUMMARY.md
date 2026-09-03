# 06-06 Summary — the lifecycle engine

**Status:** complete. 15 lifecycle tests; the engine imports nothing from Home
Assistant, asserted by parsing its imports.

**D2 closed.** The scheduled coroutine bound four values as default arguments
and left `delay` free, so it read the loop's final value: a five-second and a
five-minute alarm on one entity both waited five minutes. Every value is a
parameter now, and the delay comes from the alarm the call is about — which
removes the *class* of bug, since no loop variable is left to capture wrongly.

**D10 closed.** `annunciates_at` returns `first_activation + delay`. The
implementation it replaces cancelled and recreated the pending task on every
intermediate active state, so a sensor whose value kept changing above threshold
trailed its own annunciation behind the last change — and in a plant the changes
do not stop.

**`classify_state` returns three answers.** `_state_active` returned a boolean,
so `unavailable` and `off` were the same answer — which is how a restart looked
like every alarm clearing at once. This is the foundation 06-08 builds on.

A test asserts the engine agrees with the `_state_active` it replaces on every
corpus fixture in both directions of `previous_active`: this is a move, not a
rewrite.

**Test-scope correction.** The lifecycle sentinel required `suppression_for`,
which belongs to 06-07. A sentinel requiring another plan's work cannot go green
when its own owner lands, which makes the gate's owner column a fiction.
