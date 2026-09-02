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

    # Read the *code*, not the prose. A substring search over the source
    # matches the docstring that explains why `blocking=False` was wrong, which
    # would make the honest response deleting the explanation.
    import ast
    import inspect

    tree = ast.parse(inspect.getsource(notifications))
    non_blocking = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        for keyword in node.keywords
        if keyword.arg == "blocking" and getattr(keyword.value, "value", None) is False
    ]
    if non_blocking:
        gaps.append(
            "a notification path still calls with blocking=False, which makes the "
            "outcome unobtainable and ALM-02 requires recording it"
        )
    swallowing = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.ExceptHandler)
        and not any(
            isinstance(statement, (ast.Raise, ast.Return)) for statement in node.body
        )
    ]
    if swallowing:
        gaps.append("an except handler still discards a notification exception")
    if not any(
        isinstance(node, ast.Call)
        and getattr(getattr(node.func, "attr", None), "__str__", str)() == "wait_for"
        for node in ast.walk(tree)
    ) and "DEFAULT_TIMEOUT_SECONDS" not in {
        target.id
        for node in ast.walk(tree) if isinstance(node, ast.Assign)
        for target in node.targets if isinstance(target, ast.Name)
    }:
        gaps.append("no explicit timeout: a blocking call without one is a hang, not a record")

    # The allowlist a *configured* site would have: the default, plus the one
    # fixture notifier the corpus's permitted policies name. Testing every
    # policy against the bare default would only ever exercise the refusal.
    configured = (*DEFAULT_ALLOWLIST, f"{FAKE_NOTIFY_DOMAIN}.{FAKE_NOTIFY_SERVICE}")
    for policy in notification_policies():
        record = getattr(notifications, "describe", None)
        if record is None:
            gaps.append("notifications has no describe() to report an attempt's outcome")
            break
        outcome = record(policy, allowlist=configured)
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


# ---------------------------------------------------------------------------
# The behaviour, now that it exists
# ---------------------------------------------------------------------------

FIXTURE_SERVICE = f"{FAKE_NOTIFY_DOMAIN}.{FAKE_NOTIFY_SERVICE}"
CONFIGURED = (*DEFAULT_ALLOWLIST, FIXTURE_SERVICE)


def test_an_empty_allowlist_permits_no_external_notifier() -> None:
    from custom_components.glt_flow_card import notifications

    assert notifications.is_allowed("notify", "mobile_app_phone", allowlist=()) is False
    assert notifications.is_allowed("notify", "notify", allowlist=()) is False


def test_the_shipped_default_reaches_nobody_outside_the_frontend() -> None:
    """`persistent_notification.create` is visible in Home Assistant and pages
    no one. That is what "conservative default" has to mean here."""
    from custom_components.glt_flow_card import notifications

    assert tuple(notifications.DEFAULT_ALLOWLIST) == ("persistent_notification.create",)
    assert notifications.is_allowed("persistent_notification", "create") is True
    assert notifications.is_allowed("notify", "mobile_app_phone") is False


def test_a_malformed_service_string_is_not_a_target() -> None:
    from custom_components.glt_flow_card import notifications

    for spec in (None, "", "notify", ".create", "notify.", "   "):
        assert notifications.split_service(spec) is None, spec


def test_every_corpus_policy_reaches_its_declared_outcome() -> None:
    from custom_components.glt_flow_card import notifications

    for policy in notification_policies():
        outcome = notifications.describe(policy, allowlist=CONFIGURED)
        assert outcome == policy["expected_outcome"], policy["id"]
        assert outcome in NOTIFICATION_OUTCOMES, policy["id"]


def test_a_delivery_failure_never_hides_the_alarm() -> None:
    """The obvious implementation treats a failed notify as handled."""
    from custom_components.glt_flow_card import notifications

    for outcome in NOTIFICATION_OUTCOMES:
        assert notifications.alarm_survives_delivery_failure(
            {"active": True}, outcome=outcome,
        ) is True, outcome
    with pytest.raises(ValueError, match="unknown notification outcome"):
        notifications.alarm_survives_delivery_failure({}, outcome="handled")


async def test_a_delivery_records_service_target_and_outcome(
    hass: HomeAssistant, config_entry: MockConfigEntry, notification_ledger: Any,
) -> None:
    from custom_components.glt_flow_card import notifications

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    record = await notifications.deliver(
        hass,
        {"service": FIXTURE_SERVICE, "target": ["glt-test-recipient"], "message": "hi"},
        allowlist=CONFIGURED,
    )
    assert record["outcome"] == "delivered"
    assert record["service"] == FIXTURE_SERVICE
    assert record["target"] == ["glt-test-recipient"]
    assert record["error"] is None
    assert record["at"]


async def test_a_notifier_that_raises_is_recorded_not_swallowed(
    hass: HomeAssistant, config_entry: MockConfigEntry, notification_ledger: Any,
) -> None:
    """D6, closed. `blocking=False` made this outcome unobtainable."""
    from custom_components.glt_flow_card import notifications

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    notification_ledger.fail_next("notifier unavailable")
    record = await notifications.deliver(
        hass,
        {"service": FIXTURE_SERVICE, "target": ["glt-test-recipient"], "message": "hi"},
        allowlist=CONFIGURED,
    )
    assert record["outcome"] == "failed"
    assert "notifier unavailable" in record["error"]


async def test_an_unlisted_target_is_refused_and_never_called(
    hass: HomeAssistant, config_entry: MockConfigEntry, notification_ledger: Any,
) -> None:
    """D11, closed. Recorded, not silently skipped.

    An operator who configured a target the site does not permit must be able to
    see that, or they will believe the page went out.
    """
    from custom_components.glt_flow_card import notifications

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    record = await notifications.deliver(
        hass, {"service": "notify.mobile_app_phone", "message": "hi"}, allowlist=CONFIGURED,
    )
    assert record["outcome"] == "refused"
    assert "allowlist" in record["error"]
    assert notification_ledger.attempts == [], "an unlisted service was called anyway"


async def test_a_slow_notifier_times_out_rather_than_hanging(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> None:
    """A hang in the alarm path stops every later alarm behind it."""
    import asyncio

    from custom_components.glt_flow_card import notifications

    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    class _Hanging:
        async def async_call(self, *args: Any, **kwargs: Any) -> None:
            await asyncio.sleep(3600)

    class _Hass:
        services = _Hanging()

    record = await notifications.deliver(
        _Hass(), {"service": FIXTURE_SERVICE, "message": "hi"},
        allowlist=CONFIGURED, timeout_seconds=0,
    )
    assert record["outcome"] == "timeout"


async def test_the_manager_records_attempts_against_the_alarm(
    hass: HomeAssistant, config_entry: MockConfigEntry, notification_ledger: Any,
) -> None:
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    manager.effective_options = {
        **manager.effective_options, "notify_allowlist": CONFIGURED,
    }
    alarm = {"id": "alm", "name": "Test",
             "notification": {"service": FIXTURE_SERVICE, "target": ["glt-test-recipient"]}}
    await manager._notify_alarm(alarm, "p")

    state = manager.data["alarm_state"]["p:alm"]
    assert state["last_delivery"]["outcome"] == "delivered"
    assert len(state["delivery_attempts"]) == 1


async def test_attempts_are_bounded(
    hass: HomeAssistant, config_entry: MockConfigEntry, notification_ledger: Any,
) -> None:
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    manager.effective_options = {
        **manager.effective_options,
        "notify_allowlist": CONFIGURED,
        "notify_attempt_bound": 3,
    }
    alarm = {"id": "alm", "notification": {"service": FIXTURE_SERVICE,
                                           "target": ["glt-test-recipient"]}}
    for _ in range(8):
        await manager._notify_alarm(alarm, "p")
    assert len(manager.data["alarm_state"]["p:alm"]["delivery_attempts"]) == 3


async def test_an_unconfigured_installation_reaches_no_external_service(
    hass: HomeAssistant, config_entry: MockConfigEntry, notification_ledger: Any,
) -> None:
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    assert tuple(manager.alarm_settings()["notify_allowlist"]) == DEFAULT_ALLOWLIST
    alarm = {"id": "alm", "notification": {"service": "notify.mobile_app_phone"}}
    await manager._notify_alarm(alarm, "p")
    assert manager.data["alarm_state"]["p:alm"]["last_delivery"]["outcome"] == "refused"
    assert notification_ledger.attempts == []
