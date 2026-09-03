# 06-08 Summary — restart safety

**Status:** complete. 9 restart tests, one of which actually restarts.

Two halves that belong together. The **grace** exists because the boot scan is
not trustworthy; the **re-arming** exists because the pending tasks are gone.
Doing one without the other leaves either a mute installation or delays that
silently restarted from zero.

An absent start time counts as *inside* the grace. The obvious implementation —
`if started_at and now < started_at + grace` — reads a missing start as "grace
over", which is the exact moment the guard was needed.

A four-minute-old five-minute delay fires in one minute. A delay that elapsed
while the process was down fires at once rather than being skipped: the
condition was true for longer than the delay asked for.

**Found while doing it.** `homeassistant_started` fires once per process, so an
entry reloaded inside a running instance never sees it again. Asking
`hass.is_running` is the difference between a startup guard and an installation
with no alarms at all; there is a test for that case specifically.
