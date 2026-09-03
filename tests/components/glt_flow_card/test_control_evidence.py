"""Trusted control evidence lifecycle (T2-08).

Dispatching is not confirming. The server records `accepted` durably *before*
it dispatches, records `dispatched` separately, and only a matching readback
within the declared timeout may become `readback_confirmed`. Anything uncertain
after dispatch is recorded as `result_unknown` and is never automatically
repeated: a repeat is a second physical action on a real plant.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects
from .control_contract import (
    CONTROL_EVIDENCE_STATES,
    MALICIOUS_INPUTS,
    MAX_TRUSTED_EVENT_BYTES,
    POST_DISPATCH_STATES,
    SAMPLE_CONTROL,
)

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase2-control-evidence]: "
    "trusted control evidence lifecycle is unavailable"
)
EFFECT_PREFIX = "PHASE2_EVIDENCE_EFFECTS "

PROJECT_ID = "evidence-plant"


def project_with_control() -> dict[str, Any]:
    """A verified head for this module's project that defines one control."""
    from .test_configured_controls import project_with_control as build

    document = build()
    document["project"]["id"] = PROJECT_ID
    document["project"]["name"] = "Evidence Plant"
    document["project"]["revision"] = 0
    return document

#: Where a failure can be injected relative to the physical action. Everything
#: before dispatch must leave the plant untouched; everything after it must
#: leave the evidence honest.
FAILURE_BARRIERS = (
    "before_accepted_append",
    "after_accepted_append",
    "before_dispatch",
    "during_dispatch",
    "after_dispatch",
    "before_readback",
    "after_readback",
    "after_evidence_append",
)

#: Barriers at which zero service attempts are the only acceptable outcome.
PRE_DISPATCH_BARRIERS = frozenset({
    "before_accepted_append",
    "after_accepted_append",
    "before_dispatch",
})


def emit_effects(
    effects: LifecycleEffects, controlled: Any = None, **extra: Any
) -> None:
    """Print the zero-call ledger before any product assertion runs."""
    snapshot = effects.snapshot()
    print(EFFECT_PREFIX + json.dumps({
        "blocked_service_attempts": snapshot["service_attempts"],
        "controlled_service_calls": len(controlled.calls) if controlled else 0,
        "control_waits": snapshot["control_waits"],
        "late_callbacks": snapshot["late_callbacks"],
        **extra,
    }, sort_keys=True))


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


# --------------------------------------------------------------------------
# Contract guarantees that hold before and after implementation.
# --------------------------------------------------------------------------


def test_dispatch_is_never_reported_as_success() -> None:
    """There is no `succeeded` state; confirmation requires a readback."""
    assert "succeeded" not in CONTROL_EVIDENCE_STATES
    assert "readback_confirmed" in CONTROL_EVIDENCE_STATES
    assert "result_unknown" in CONTROL_EVIDENCE_STATES


def test_post_dispatch_states_are_exactly_the_uncertain_ones() -> None:
    """Everything after the action is uncertain until a readback lands."""
    assert POST_DISPATCH_STATES <= set(CONTROL_EVIDENCE_STATES)
    assert "denied" not in POST_DISPATCH_STATES
    assert "failed_before_dispatch" not in POST_DISPATCH_STATES
    assert "cancelled_before_dispatch" not in POST_DISPATCH_STATES


def test_failure_barriers_cover_both_sides_of_the_physical_action() -> None:
    """Every injection point is named, so none can be silently untested."""
    assert PRE_DISPATCH_BARRIERS < set(FAILURE_BARRIERS)
    assert "during_dispatch" in FAILURE_BARRIERS
    assert "after_dispatch" in FAILURE_BARRIERS


def test_readback_definition_is_explicit_and_bounded() -> None:
    """A control declares what confirmation looks like and how long to wait."""
    readback = SAMPLE_CONTROL["readback"]
    assert readback["entity_id"] and readback["expect_state"]
    assert 0 < readback["timeout_seconds"] <= 60


def test_trusted_event_size_bound_is_declared() -> None:
    """A single trusted event cannot grow without limit."""
    assert MAX_TRUSTED_EVENT_BYTES == 8 * 1024


# --------------------------------------------------------------------------
# Product-completeness sentinel.
# --------------------------------------------------------------------------


async def control_evidence_gaps(hass: HomeAssistant, controlled_service: Any) -> list[str]:
    """Return every unmet control-evidence guarantee."""
    evidence = load("trusted_evidence")
    if evidence is None:
        return ["custom_components.glt_flow_card.trusted_evidence does not exist"]

    gaps: list[str] = []
    for name in ("ControlEvidenceRecorder", "CONTROL_EVIDENCE_STATES", "TrustedEvidenceStore"):
        if not hasattr(evidence, name):
            gaps.append(f"trusted_evidence.{name} is missing")
    if gaps:
        return gaps

    if tuple(evidence.CONTROL_EVIDENCE_STATES) != CONTROL_EVIDENCE_STATES:
        gaps.append("the shipped evidence states do not match the contract")

    recorder = evidence.ControlEvidenceRecorder(hass)
    if not hasattr(recorder, "async_accept"):
        gaps.append("the recorder cannot durably record `accepted` before dispatch")
    if hasattr(recorder, "async_retry") or hasattr(recorder, "async_redispatch"):
        gaps.append("the recorder exposes an automatic repeat of a physical action")

    for barrier in FAILURE_BARRIERS:
        if not recorder.supports_barrier(barrier):
            gaps.append(f"failure barrier {barrier} cannot be injected")

    if controlled_service.calls:
        gaps.append(
            f"evidence inspection caused {len(controlled_service.calls)} service calls"
        )
    return gaps


async def test_expected_red_phase2_control_evidence(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    controlled_service,
) -> None:
    """Control evidence distinguishes every state and never repeats an action."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, controlled_service, barriers=len(FAILURE_BARRIERS))

    from .test_trusted_evidence import trusted_evidence_gaps

    gaps = await control_evidence_gaps(hass, controlled_service)
    gaps.extend(await trusted_evidence_gaps(hass))

    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  evidence gap: {gap}")
    assert not gaps, "trusted control evidence lifecycle is unavailable"


async def test_one_accepted_request_causes_at_most_one_service_attempt(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    controlled_service,
    phase2_users,
) -> None:
    """An Operator executes a control once, and the evidence is honest.

    Resolved A4 in practice: no engineering lease is taken, exactly one service
    attempt reaches Home Assistant with the target resolved from the head, and
    only a matching readback is allowed to say `readback_confirmed`.
    """
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    runtime = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id]
    manager = hass.data["glt_flow_card"]["manager"]

    operator = phase2_users.principal("operator")
    await runtime.access.async_assign(
        project_id=PROJECT_ID, user_id=operator.user_id, role="operator"
    )
    await manager.save_project(
        {"id": PROJECT_ID, "config": project_with_control()},
        autosave=False,
        user_id=operator.user_id,
        expected_revision=0,
    )
    head = manager.project(PROJECT_ID)

    controlled_service.allow("switch", "turn_on")
    hass.states.async_set("switch.pump_1", "on")

    connection = await phase2_users.async_connect("operator")
    executed = await connection.command({
        "type": "glt_flow_card/controls/execute",
        "project_id": PROJECT_ID,
        "control_id": "pump-1-start",
        "expected_revision": head["revision"],
        "input": {"reason": "morning start"},
    })
    assert executed["success"] is True, executed
    assert executed["result"]["state"] == "readback_confirmed"

    assert len(controlled_service.calls) == 1
    call = controlled_service.calls[0]
    assert call["domain"] == "switch" and call["service"] == "turn_on"
    # Home Assistant merges the target into the call data, so this is the exact
    # entity the plant was asked to act on - resolved from the head, never sent.
    assert call["data"]["entity_id"] == "switch.pump_1"
    assert call["data"]["reason"] == "morning start"
    assert call["context_user_id"] == operator.user_id

    # No engineering lease was needed or taken for an operational action.
    assert runtime.leases.active_count() == 0

    correlation = executed["result"]["correlation_id"]
    states = [
        event["result"] for event in runtime.evidence.rows({PROJECT_ID})
        if event.get("correlation_id") == correlation
    ]
    assert set(states) == {"accepted", "dispatched", "readback_confirmed"}
    emit_effects(lifecycle_effects, controlled_service, attempts=len(controlled_service.calls))
    await phase2_users.async_close()


async def test_a_wrong_readback_is_never_reported_as_confirmed(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    controlled_service,
    phase2_users,
) -> None:
    """The plant did not reach the expected state, so nothing claims it did."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    runtime = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id]
    manager = hass.data["glt_flow_card"]["manager"]

    operator = phase2_users.principal("operator")
    await runtime.access.async_assign(
        project_id=PROJECT_ID, user_id=operator.user_id, role="operator"
    )
    await manager.save_project(
        {"id": PROJECT_ID, "config": project_with_control()},
        autosave=False,
        user_id=operator.user_id,
        expected_revision=0,
    )
    head = manager.project(PROJECT_ID)

    controlled_service.allow("switch", "turn_on")
    hass.states.async_set("switch.pump_1", "off")

    connection = await phase2_users.async_connect("operator")
    executed = await connection.command({
        "type": "glt_flow_card/controls/execute",
        "project_id": PROJECT_ID,
        "control_id": "pump-1-start",
        "expected_revision": head["revision"],
        "input": {},
    })
    assert executed["result"]["state"] == "timed_out"
    assert executed["result"]["state"] not in {"readback_confirmed", "succeeded"}
    assert len(controlled_service.calls) == 1
    await phase2_users.async_close()


async def test_a_malicious_request_reaches_no_service_at_all(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    controlled_service,
    phase2_users,
) -> None:
    """Every rejection path leaves the controlled-service ledger empty."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    runtime = hass.data["glt_flow_card"]["runtimes"][config_entry.entry_id]
    manager = hass.data["glt_flow_card"]["manager"]

    operator = phase2_users.principal("operator")
    await runtime.access.async_assign(
        project_id=PROJECT_ID, user_id=operator.user_id, role="operator"
    )
    await manager.save_project(
        {"id": PROJECT_ID, "config": project_with_control()},
        autosave=False,
        user_id=operator.user_id,
        expected_revision=0,
    )
    head = manager.project(PROJECT_ID)
    controlled_service.allow("switch", "turn_on")

    connection = await phase2_users.async_connect("operator")
    for name, payload in MALICIOUS_INPUTS:
        if not isinstance(payload, dict):
            continue
        response = await connection.command({
            "type": "glt_flow_card/controls/execute",
            "project_id": PROJECT_ID,
            "control_id": "pump-1-start",
            "expected_revision": head["revision"],
            "input": payload,
        })
        assert response["success"] is False, name
        # A rejected attempt still consumes the execute budget, so later
        # iterations legitimately hit the rate limit. Both are refusals that
        # reach no service.
        assert response["error"]["code"] in {"invalid_input", "rate_limited"}, name

    unknown = await connection.command({
        "type": "glt_flow_card/controls/execute",
        "project_id": PROJECT_ID,
        "control_id": "not-a-control",
        "expected_revision": head["revision"],
        "input": {},
    })
    assert unknown["success"] is False

    stale = await connection.command({
        "type": "glt_flow_card/controls/execute",
        "project_id": PROJECT_ID,
        "control_id": "pump-1-start",
        "expected_revision": head["revision"] + 5,
        "input": {},
    })
    assert stale["error"]["code"] == "revision_conflict"

    assert controlled_service.calls == []
    await phase2_users.async_close()
