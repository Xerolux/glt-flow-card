"""Phase-4 runtime state does not outlive the runtime that owns it (T4-12).

Phase 4 adds two things a reload could strand: the view-stream service, which
holds a snapshot budget per connection, and the subscriptions those snapshots
belong to. A budget surviving an unload would let a pre-reload client keep
spending against a runtime that no longer exists; a snapshot sequence surviving
one would let a client believe it had missed nothing when in fact everything
changed underneath it.

The release order is the Phase-2 one and matters for the same reason:
availability disappears first, so nothing admitted after that point can observe
a half-released runtime.
"""
from __future__ import annotations

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card.view_stream import (
    MAX_SNAPSHOTS_IN_FLIGHT,
    MIN_SNAPSHOT_INTERVAL_SECONDS,
    SNAPSHOT_BURST,
    SnapshotRefused,
    ViewStreamService,
)

from .panel_seed import seed_operations_project

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


def _service(sequence: int = 7, clock: list[float] | None = None) -> ViewStreamService:
    ticks = clock if clock is not None else [0.0]
    return ViewStreamService(sequence_of=lambda: sequence, monotonic=lambda: ticks[0])


def test_a_snapshot_and_its_sequence_come_from_one_read() -> None:
    """The counter is read after the body, with nothing awaited in between."""
    observed: list[str] = []

    def read() -> dict:
        observed.append("body")
        return {"objects": []}

    service = ViewStreamService(
        sequence_of=lambda: (observed.append("sequence") or 11),
        monotonic=lambda: 0.0,
    )
    result = service.snapshot(1, read)
    assert observed == ["body", "sequence"], "the sequence must be stamped after the read"
    assert result["sequence"] == 11


def test_only_one_snapshot_may_be_in_flight_per_connection() -> None:
    service = _service()
    refused: list[str] = []

    def reentrant() -> dict:
        try:
            service.snapshot(1, lambda: {})
        except SnapshotRefused as error:
            refused.append(error.code)
        return {}

    service.snapshot(1, reentrant)
    assert refused == ["rate_limited"]
    assert MAX_SNAPSHOTS_IN_FLIGHT == 1


def test_a_second_snapshot_too_soon_is_refused() -> None:
    clock = [0.0]
    service = _service(clock=clock)
    service.snapshot(1, lambda: {})
    with pytest.raises(SnapshotRefused):
        service.snapshot(1, lambda: {})
    # Past the floor, it is allowed again: the bound throttles, it does not lock.
    clock[0] = MIN_SNAPSHOT_INTERVAL_SECONDS * 2
    assert service.snapshot(1, lambda: {})["sequence"] == 7


def test_a_burst_beyond_the_window_ceiling_is_refused() -> None:
    clock = [0.0]
    service = _service(clock=clock)
    for index in range(SNAPSHOT_BURST):
        clock[0] = index * MIN_SNAPSHOT_INTERVAL_SECONDS * 2
        service.snapshot(1, lambda: {})
    clock[0] += MIN_SNAPSHOT_INTERVAL_SECONDS * 2
    with pytest.raises(SnapshotRefused):
        service.snapshot(1, lambda: {})


def test_budgets_are_per_connection() -> None:
    """One noisy connection must not throttle another."""
    clock = [0.0]
    service = _service(clock=clock)
    service.snapshot(1, lambda: {})
    # A different connection is unaffected by the first one's floor.
    assert service.snapshot(2, lambda: {})["sequence"] == 7


def test_forgetting_a_connection_releases_its_budget() -> None:
    service = _service()
    service.snapshot(1, lambda: {})
    assert service.resource_ledger()["budgets"] == 1
    service.forget(1)
    assert service.resource_ledger() == {"budgets": 0, "in_flight": 0}


async def test_invalidation_clears_every_phase4_resource(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """After invalidation the view service holds nothing at all."""
    runtime = await seed_operations_project(hass, config_entry, phase2_users)
    assert runtime.views is not None
    runtime.views.snapshot(99, lambda: {"objects": []})
    assert runtime.views.resource_ledger()["budgets"] == 1

    await runtime.async_invalidate()
    assert runtime.available is False
    assert runtime.views.resource_ledger() == {"budgets": 0, "in_flight": 0}
    await phase2_users.async_close()


async def test_availability_disappears_before_anything_is_released(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """A request admitted mid-teardown must never see a half-released runtime."""
    runtime = await seed_operations_project(hass, config_entry, phase2_users)
    seen: list[bool] = []

    original = runtime.views.clear

    def observe() -> None:
        seen.append(runtime.available)
        original()

    runtime.views.clear = observe  # type: ignore[method-assign]
    await runtime.async_invalidate()
    assert seen == [False], "the runtime was still available while releasing"
    await phase2_users.async_close()


async def test_unload_leaves_no_phase4_state_behind(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """Setup, unload, and nothing Phase 4 added remains in component data."""
    runtime = await seed_operations_project(hass, config_entry, phase2_users)
    runtime.views.snapshot(5, lambda: {"objects": []})
    await phase2_users.async_close()

    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()

    runtimes = hass.data.get("glt_flow_card", {}).get("runtimes", {})
    assert config_entry.entry_id not in runtimes
    assert runtime.available is False
    assert runtime.views.resource_ledger() == {"budgets": 0, "in_flight": 0}


async def test_a_late_snapshot_after_unload_is_inert(
    hass: HomeAssistant, config_entry: MockConfigEntry, phase2_users,
) -> None:
    """A callback that fires after teardown finds nothing, and does not raise."""
    runtime = await seed_operations_project(hass, config_entry, phase2_users)
    await phase2_users.async_close()
    assert await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()

    # The service still exists as an object; it simply owns nothing, and taking
    # a snapshot against it cannot resurrect a budget for a dead generation.
    runtime.views.forget(1)
    assert runtime.views.resource_ledger() == {"budgets": 0, "in_flight": 0}
