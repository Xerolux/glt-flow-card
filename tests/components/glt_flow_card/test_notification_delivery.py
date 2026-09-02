"""Every notification attempt is recorded, allowlisted and failure-visible
(T6-07, T6-08, T6-09).

Three defects in twelve lines of `_notify_alarm`:

**D6 -- the outcome is discarded twice.** `blocking=False` makes the result
unobtainable, and a bare `except Exception: return` makes the exception
unobtainable too. A delivery nobody received is indistinguishable from one they
did.

**D11 -- there is no allowlist.** Schedules check `domain not in allowed` and
controls check `SAFE_SERVICE_DOMAINS`; `_notify_alarm` checks nothing and calls
whatever domain and service the project document names. A project document is
operator input, and a service string in it is not authorization.

**T6-09 -- a delivery failure must never hide the alarm.** The obvious
implementation treats a failed notify as handled, which gets it exactly
backwards: an alarm nobody could be told about is more urgent than one they
were told about, not less.

No test here reaches a real recipient. The `notification_ledger` fixture proves
it in teardown, so a test that escaped fails even when its own assertions pass.
"""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card.alarm_vocabulary import NOTIFICATION_OUTCOMES

from .alarm_factory import notification_policies
from .conftest import LifecycleEffects
from .phase6_red import emit_effects, report
from .user_factory import FAKE_NOTIFY_DOMAIN, FAKE_NOTIFY_SERVICE

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
    pytest.mark.expected_red,
]

RED_MARKER = (
    "EXPECTED_RED[phase6-notifications]: "
    "recorded, allowlisted notification delivery is unavailable"
)
EFFECT_PREFIX = "PHASE6_NOTIFY_LEDGER "

#: The conservative default, decided with the user on 2026-09-02: an
#: unconfigured installation reaches nobody outside the Home Assistant frontend.
DEFAULT_ALLOWLIST = ("persistent_notification.create",)


def delivery_gaps() -> list[str]:
    """Return every delivery behaviour the Companion does not yet have."""
    gaps: list[str] = []

    try:
        from custom_components.glt_flow_card import notifications
    except ImportError:
        return [
            "there is no notifications module; delivery is twelve lines inside "
            "the manager with no outcome, no allowlist and no record"
        ]

    allowed = getattr(notifications, "is_allowed", None)
    if allowed is None:
        gaps.append(
            "notifications has no is_allowed(); a service string in a project "
            "document is operator input, not authorization"
        )
    else:
        if allowed("notify", "mobile_app_phone", allowlist=()):
            gaps.append("an empty allowlist must permit no external notifier")
        if not allowed("persistent_notification", "create", allowlist=DEFAULT_ALLOWLIST):
            gaps.append("the default allowlist must permit the frontend-only notifier")
        if allowed(FAKE_NOTIFY_DOMAIN, FAKE_NOTIFY_SERVICE, allowlist=DEFAULT_ALLOWLIST):
            gaps.append("the default allowlist must not permit an unlisted service")

    default = getattr(notifications, "DEFAULT_ALLOWLIST", None)
    if default is None:
        gaps.append("notifications declares no DEFAULT_ALLOWLIST")
    elif tuple(default) != DEFAULT_ALLOWLIST:
        gaps.append(
            f"the shipped default allowlist is {tuple(default)!r}; an unconfigured "
            "installation must reach no external recipient"
        )

    deliver = getattr(notifications, "deliver", None)
    if deliver is None:
        gaps.append("notifications has no deliver(); there is nothing that returns an outcome")
        return gaps

    import inspect

    source = inspect.getsource(notifications)
    if "blocking=False" in source:
        gaps.append(
            "a notification path still calls with blocking=False, which makes the "
            "outcome unobtainable and ALM-02 requires recording it"
        )
    if "except Exception:\n" in source and "raise" not in source:
        gaps.append("a bare except still discards a notification exception")
    if "TIMEOUT" not in source and "timeout" not in source:
        gaps.append("no explicit timeout: a blocking call without one is a hang, not a record")

    for policy in notification_policies():
        record = getattr(notifications, "describe", None)
        if record is None:
            gaps.append("notifications has no describe() to report an attempt's outcome")
            break
        outcome = record(policy, allowlist=DEFAULT_ALLOWLIST)
        expected = policy["expected_outcome"]
        if outcome != expected:
            gaps.append(f"{policy['id']}: expected outcome {expected!r}, got {outcome!r}")
        elif outcome not in NOTIFICATION_OUTCOMES:
            gaps.append(f"{policy['id']}: outcome {outcome!r} is outside the declared set")

    survives = getattr(notifications, "alarm_survives_delivery_failure", None)
    if survives is None:
        gaps.append(
            "nothing asserts that a failed delivery leaves the alarm active, "
            "unshelved and listed; the obvious implementation treats a failed "
            "notify as handled, which is exactly backwards"
        )
    elif survives({"active": True}, outcome="failed") is not True:
        gaps.append("a delivery failure must not remove, downgrade or hide the alarm")

    return gaps


async def test_expected_red_phase6_notifications(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    notification_ledger: Any,
) -> None:
    """Every attempt records service, target, outcome and error."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(EFFECT_PREFIX, lifecycle_effects, **notification_ledger.evidence())

    report(RED_MARKER, delivery_gaps(),
           "recorded, allowlisted notification delivery is unavailable")
