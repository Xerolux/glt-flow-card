"""The view stream is sequenced, bounded and generation-bound (T4-09, T4-10).

Home Assistant's websocket API supplies no sequence number and no replay
(`connection.send_event` and `messages.event_message` carry neither), so gap
detection is this integration's own responsibility. The SubscriptionRegistry
already stamps a monotonic sequence; this is the other half — a snapshot taken
*with* the sequence it corresponds to, in one critical section, so an event
emitted between the read and the stamp cannot be silently lost.

A snapshot is also the most expensive read in the phase, and the conditions
that trigger a resync are ones a client controls. It is therefore bounded.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .panel_seed import PROJECT_ID, declared_route, seed_operations_project

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase4-view-stream]: "
    "the sequenced bounded view stream is unavailable"
)
EFFECT_PREFIX = "PHASE4_STREAM_EFFECTS "

#: Inherited from policy_sessions.MAX_SUBSCRIPTIONS_PER_CONNECTION. Phase 4 must
#: not introduce a second, different limit.
MAX_SUBSCRIPTIONS = 8


def emit_effects(**extra: Any) -> None:
    print(EFFECT_PREFIX + json.dumps(
        {"service_attempts": 0, "network": 0, "subscriptions_after": 0, **extra},
        sort_keys=True,
    ))


async def subscribe(connection, *, project_id: str = PROJECT_ID) -> dict[str, Any]:
    try:
        return await connection.command({
            "type": "glt_flow_card/views/subscribe",
            "project_id": project_id,
        })
    except Exception as error:  # noqa: BLE001 - a missing route must read as a gap
        return {"success": False, "error": {"code": "no_route", "message": str(error)}}


async def test_expected_red_phase4_view_stream(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """A snapshot carries its sequence, events are monotonic, and both are bounded."""
    emit_effects(cases=5)
    gaps: list[str] = []
    runtime = await seed_operations_project(hass, config_entry, phase2_users)

    policy = declared_route("glt_flow_card/views/subscribe")
    if policy is None:
        gaps.append("glt_flow_card/views/subscribe is not declared in the policy contract")
    elif policy.scope != "project" or policy.capability != "project.read":
        gaps.append("views/subscribe is not a project-scoped project.read route")

    engineer = await phase2_users.async_connect("engineer")
    first = await subscribe(engineer)
    if first.get("success") is not True:
        gaps.append("an authorized engineer could not subscribe to a view")
    else:
        result = first["result"]
        if "snapshot" not in result:
            gaps.append("the subscription returned no snapshot")
        sequence = result.get("sequence")
        if not isinstance(sequence, int):
            gaps.append("the snapshot does not carry the sequence it was read at")
        else:
            # The registry's counter must already be at least the snapshot's
            # sequence: a snapshot stamped from outside the critical section
            # would let an emission slip between the read and the stamp.
            current = runtime.subscriptions.sequence()
            if current < sequence:
                gaps.append(
                    f"the snapshot sequence {sequence} is ahead of the registry {current}, "
                    "so it was not stamped inside the read",
                )

        # A second subscription must not restart the sequence: a client that
        # resubscribes has to be able to tell it missed nothing.
        second = await subscribe(engineer)
        if second.get("success") is True:
            if second["result"].get("sequence", -1) < result.get("sequence", 0):
                gaps.append("a later snapshot carries an earlier sequence")

    # The per-connection subscription ceiling is Phase 2's, not a new one.
    accepted = 0
    refused: dict[str, Any] | None = None
    for _ in range(MAX_SUBSCRIPTIONS + 4):
        response = await subscribe(engineer)
        if response.get("success") is True:
            accepted += 1
        else:
            refused = response
            break
    if refused is None:
        gaps.append(
            f"more than {MAX_SUBSCRIPTIONS} subscriptions were accepted on one connection",
        )

    # Snapshot requests are rate limited: the resync path is triggered by
    # conditions a hostile or merely buggy client controls.
    rate_limited = False
    for _ in range(64):
        response = await subscribe(engineer)
        if response.get("success") is False:
            if response.get("error", {}).get("code") == "rate_limited":
                rate_limited = True
            break
        await asyncio.sleep(0)
    if not rate_limited:
        gaps.append("snapshot requests are not rate limited, so a resync storm is unbounded")

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  view stream gap: {gap}")
    assert not gaps, "the sequenced bounded view stream is unavailable"
    await phase2_users.async_close()
