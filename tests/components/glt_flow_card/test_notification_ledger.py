"""The notification ledger must fail a test that reached a real recipient.

Phase 2 established that a test must cause zero *unintended* service calls.
Phase 6 is the first phase whose subject is a service call that is *intended*,
so that rule stops settling the question: a suite can assert everything it meant
to assert and still have paged somebody.

The property under test is therefore unusual -- it is about a test that passes.
`test_a_passing_test_that_escaped_still_fails` proves it by running the escaping
case in a subprocess and reading its outcome, because a mechanism that turns a
pass into a failure cannot demonstrate itself from inside the run it is failing.
"""
from __future__ import annotations

import subprocess
import sys

import pytest
from homeassistant.core import HomeAssistant

from .user_factory import (
    FAKE_NOTIFY_DOMAIN,
    FAKE_NOTIFY_RECIPIENT,
    FAKE_NOTIFY_SERVICE,
    NotificationLedger,
    RealRecipientReached,
)

#: The node id of the deliberately-escaping case, run only as a subprocess.
ESCAPING_CASE = (
    "tests/components/glt_flow_card/test_notification_ledger.py"
    "::test_escapes_the_fixture_on_purpose"
)


def test_a_contained_attempt_is_recorded_with_its_outcome() -> None:
    ledger = NotificationLedger()
    ledger.record(
        FAKE_NOTIFY_DOMAIN,
        FAKE_NOTIFY_SERVICE,
        {"target": FAKE_NOTIFY_RECIPIENT, "message": "hello"},
        "delivered",
    )
    ledger.assert_contained()
    assert ledger.evidence() == {
        "attempts": 1,
        "services": [f"{FAKE_NOTIFY_DOMAIN}.{FAKE_NOTIFY_SERVICE}"],
        "recipients": [FAKE_NOTIFY_RECIPIENT],
        "outcomes": ["delivered"],
    }


def test_a_real_notification_service_is_refused() -> None:
    ledger = NotificationLedger()
    ledger.record("notify", "mobile_app_phone", {"message": "hello"}, "delivered")
    with pytest.raises(RealRecipientReached, match="notify.mobile_app_phone"):
        ledger.assert_contained()


def test_a_real_recipient_is_refused_even_through_the_fake_service() -> None:
    # The subtler half: the service is the fixture's, but the payload names
    # somebody. A check on the service alone would pass this.
    ledger = NotificationLedger()
    ledger.record(
        FAKE_NOTIFY_DOMAIN,
        FAKE_NOTIFY_SERVICE,
        {"target": ["+4915112345678"]},
        "delivered",
    )
    with pytest.raises(RealRecipientReached, match=r"\+4915112345678"):
        ledger.assert_contained()


def test_both_recipient_shapes_are_read() -> None:
    # The legacy per-service API names `target`; the entity API names
    # `entity_id`. One assertion must cover both, or half the surface is unread.
    assert NotificationLedger.recipients({"target": "a"}) == ("a",)
    assert NotificationLedger.recipients({"entity_id": ["b", "c"]}) == ("b", "c")
    assert NotificationLedger.recipients({"target": ["a"], "entity_id": "b"}) == ("a", "b")
    assert NotificationLedger.recipients({"message": "no recipient"}) == ()


async def test_the_fixture_records_a_real_call(
    hass: HomeAssistant, notification_ledger: NotificationLedger
) -> None:
    await hass.services.async_call(
        FAKE_NOTIFY_DOMAIN,
        FAKE_NOTIFY_SERVICE,
        {"target": FAKE_NOTIFY_RECIPIENT, "message": "hello"},
        blocking=True,
    )
    assert len(notification_ledger.attempts) == 1
    assert notification_ledger.attempts[0]["outcome"] == "delivered"


async def test_a_notifier_that_raises_is_recorded_rather_than_swallowed(
    hass: HomeAssistant, notification_ledger: NotificationLedger
) -> None:
    notification_ledger.fail_next("notifier unavailable")
    with pytest.raises(Exception, match="notifier unavailable"):
        await hass.services.async_call(
            FAKE_NOTIFY_DOMAIN,
            FAKE_NOTIFY_SERVICE,
            {"target": FAKE_NOTIFY_RECIPIENT, "message": "hello"},
            blocking=True,
        )
    assert notification_ledger.attempts[0]["outcome"] == "failed"
    assert notification_ledger.attempts[0]["error"] == "notifier unavailable"


@pytest.mark.escaping_notification
async def test_escapes_the_fixture_on_purpose(
    hass: HomeAssistant, notification_ledger: NotificationLedger
) -> None:
    """Reach a recipient outside the fixture, and assert nothing about it.

    Every assertion in this test passes. It exists to be run as a subprocess by
    the test below, which reads its outcome: if the ledger works, this reports a
    failure anyway, from teardown.
    """
    hass.services.async_register(FAKE_NOTIFY_DOMAIN, "escape", lambda call: None)
    await hass.services.async_call(
        FAKE_NOTIFY_DOMAIN,
        "escape",
        {"target": "a-real-person", "message": "hello"},
        blocking=True,
    )
    assert True


def test_a_passing_test_that_escaped_still_fails() -> None:
    """The whole point: a test whose own assertions all pass must still fail."""
    completed = subprocess.run(  # noqa: S603 - fixed argv, no shell
        [
            sys.executable, "-m", "pytest", ESCAPING_CASE,
            "-q", "-p", "no:cacheprovider", "-m", "escaping_notification",
        ],
        capture_output=True,
        encoding="utf-8",
        check=False,
    )
    output = f"{completed.stdout}{completed.stderr}"
    assert completed.returncode != 0, f"the escaping test was allowed to pass:\n{output}"
    assert "RealRecipientReached" in output or "outside the fixture" in output, output
    # And it failed in teardown, not in the body -- the body asserted nothing
    # about the notification at all.
    assert "a-real-person" in output, output
