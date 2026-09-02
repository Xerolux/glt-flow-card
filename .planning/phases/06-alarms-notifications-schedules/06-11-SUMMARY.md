# 06-11 Summary — notification and escalation

**Status:** complete. 13 delivery tests, 9 escalation tests.

**D6.** Blocking, with an explicit timeout; every exception recorded. A slow
notifier is recorded as `timeout` rather than waited on, because a hang in the
alarm path stops every later alarm behind it.

**D11.** Deny-default allowlist, site configuration, shipping
`persistent_notification.create` alone. An unlisted target is **recorded as
refused, not silently skipped**: an operator who configured a target the site
does not permit must see that, or they will believe the page went out.

**T6-09.** `alarm_survives_delivery_failure` is a named function rather than an
absent branch, precisely so a test can assert the rule.

Escalation stages are ordered by when they fire and filtered by the priorities
each names — omitting the field means "all", naming an empty set means "none",
and those are different statements.

**Two corrections, mine.** The corpus expected `service_not_allowed`, which is
not a declared outcome; `refused` is, and the reason travels in `error`. And the
sentinel searched the module text for `blocking=False`, matching the docstring
that explains why it was wrong — the same trap the alarm engine hit. It parses
the AST now, so the explanation can stay.
