# 06-15 Summary — retiring the other three evaluators

**Status:** complete. D4 closed.

The shipped `activeAlarm` is retired **reachable and inert**: it reads what the
Companion published and derives nothing, and absent state answers "not active",
because a card that has not been told is a card that does not know. The direct
acknowledgement that called a Home Assistant service straight from the browser —
never reaching the Companion — is retired the same way.

The v100 panel now issues `alarms/list`. It previously posted `ack` and `shelve`
but never read the authoritative state.

`prompt()` is gone from the acknowledgement path. It blocks the page, cannot be
styled or localized, and is unreachable in a kiosk.

The badges read the engine's rows through one `alarm_runtime_for`, so the panel
and the roll-up cannot disagree. A suppressed alarm is not counted: an operator
who shelved it asked for it to be quiet.

**The Phase-4 corpus needed fixing.** It seeded alarms only into the project
config field, so it described an installation whose alarms the engine had never
seen. It seeds engine rows now — which is what a real installation has.
