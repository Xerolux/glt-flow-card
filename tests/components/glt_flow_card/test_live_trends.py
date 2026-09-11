"""Use Recorder's actual epoch timestamps and entity-to-rows response."""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from custom_components.glt_flow_card.live_trends import build_statistics, default_window

pytestmark = [pytest.mark.enable_socket, pytest.mark.allow_hosts(["127.0.0.1", "localhost"])]


def test_complete_hour_window_is_bounded_and_utc():
    start, end, expected = default_window(datetime(2026, 9, 11, 20, 42, tzinfo=timezone.utc))
    assert start == "2026-09-10T20:00:00+00:00"
    assert end == "2026-09-11T20:00:00+00:00"
    assert len(expected) == 24


def test_real_statistics_keep_entities_values_and_gaps_separate():
    _, _, grid = default_window(datetime(2026, 9, 11, 20, tzinfo=timezone.utc))
    epoch = datetime.fromisoformat(grid[0]).timestamp()
    result = build_statistics({
        "sensor.temperature": [{"start": epoch, "mean": 23.5, "change": None}],
        "sensor.energy": [{"start": epoch, "change": 1.25}],
    }, ["sensor.temperature", "sensor.energy"], grid)
    assert result["source"] == "statistics"
    assert result["series"][0]["points"][0]["value"] == 23.5
    assert result["series"][1]["points"][0]["value"] == 1.25
    assert result["series"][0]["points"][0]["at"] == grid[0]
    assert result["coverage"] == 1 / 24
    assert result["gaps"]


def test_truncation_and_recorder_failure_do_not_claim_complete_data():
    grid = ["2026-09-11T18:00:00+00:00", "2026-09-11T19:00:00+00:00"]
    rows = [{"start": at, "mean": 20} for at in grid]
    result = build_statistics({"sensor.a": rows}, ["sensor.a"], grid, limit=1)
    assert result["capped"] is True
    assert result["coverage"] == 0.5
    failed = build_statistics(None, ["sensor.a"], grid, error="Recorder unavailable")
    assert failed["source"] == "unavailable"
    assert failed["coverage"] == 0
    assert failed["series"][0]["points"] == []


async def test_default_route_reaches_recorder_and_filters_foreign_entities(hass, config_entry, phase2_users):
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager, _runtime_for
    _manager(hass).data["projects"]["trends"] = {"id": "trends", "config": {"datapoints": [{"entity": "sensor.a"}]}}
    await _runtime_for(hass).access.async_assign(project_id="trends", user_id=phase2_users.principal("viewer").user_id, role="viewer")
    connection = await phase2_users.async_connect("viewer")
    async def answer(_hass, request):
        assert request["message"]["period"] == "hour"
        assert request["message"]["statistic_ids"] == ["sensor.a"]
        assert request["message"]["start_time"]
        return {"sensor.a": [{"start": datetime.fromisoformat(request["message"]["start_time"]).timestamp(), "mean": 21.75}]}, None
    recorder = AsyncMock(side_effect=answer)
    with patch("custom_components.glt_flow_card._ask_recorder", recorder):
        result = await connection.command({"type": "glt_flow_card/history/statistics", "project_id": "trends", "entity_ids": ["sensor.a", "sensor.foreign"]})
    assert result["success"], result
    assert result["result"]["series"][0]["points"][0]["value"] == 21.75
    assert len(result["result"]["series"]) == 1
    recorder.assert_awaited_once()
