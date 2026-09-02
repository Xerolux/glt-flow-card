"""The Recorder ledger records what a query was, and fails what left its bounds.

This is the harness's own test. It exists because every later Phase-7 test rests
on the ledger being able to tell four things apart: a query that stayed inside
the fixture, one that left it, one that stayed inside but asked for more than the
product's declared bound, and no query at all.

The last of those is the subtle one. "No data came back" and "nothing was asked"
produce the same empty series, and a test that cannot distinguish them will
happily confirm the defect it was written to catch.
"""
from __future__ import annotations

import pytest

from .recorder_factory import (
    FAKE_RECORDER,
    RECORDER_CONTRACTS,
    LiveRecorderReached,
    QueryBoundExceeded,
    RecorderLedger,
)


def test_the_contract_set_is_closed_and_an_unknown_contract_is_a_defect() -> None:
    assert RECORDER_CONTRACTS == ("statistics", "statistic", "raw")
    ledger = RecorderLedger()
    with pytest.raises(ValueError, match="unknown recorder contract"):
        ledger.record("guess", source=FAKE_RECORDER, entities=1, window_seconds=60, rows=1)


def test_a_contained_query_records_its_contract_size_and_result() -> None:
    ledger = RecorderLedger()
    ledger.record("statistics", source=FAKE_RECORDER, entities=3, window_seconds=3600, rows=24)
    ledger.assert_contained()

    evidence = ledger.evidence()
    assert evidence["queries"] == 1
    assert evidence["contracts"] == ["statistics"]
    assert evidence["max_entities"] == 3
    assert evidence["max_rows"] == 24
    assert evidence["asked"] is True


def test_asking_nothing_is_distinguishable_from_getting_nothing() -> None:
    silent = RecorderLedger()
    assert silent.asked() is False

    asked = RecorderLedger()
    asked.record("raw", source=FAKE_RECORDER, entities=1, window_seconds=60, rows=0)
    assert asked.asked() is True
    assert asked.evidence()["max_rows"] == 0


def test_a_query_outside_the_fixture_fails_in_containment() -> None:
    ledger = RecorderLedger()
    ledger.record("raw", source="homeassistant", entities=1, window_seconds=60, rows=5)
    with pytest.raises(LiveRecorderReached, match="outside the fixture"):
        ledger.assert_contained()


@pytest.mark.parametrize(
    ("kwargs", "expected"),
    [
        ({"entities": 999, "window_seconds": 60, "rows": 1}, "entities"),
        ({"entities": 1, "window_seconds": 400 * 24 * 3600, "rows": 1}, "window"),
        ({"entities": 1, "window_seconds": 60, "rows": 10_000_000}, "rows"),
    ],
)
def test_a_query_past_a_declared_bound_fails_in_containment(kwargs, expected) -> None:
    ledger = RecorderLedger()
    ledger.record("raw", source=FAKE_RECORDER, **kwargs)
    with pytest.raises(QueryBoundExceeded) as caught:
        ledger.assert_contained()
    assert expected in str(caught.value)


def test_the_window_bound_governs_raw_queries_only() -> None:
    # A year of statistics is a bounded request -- the Recorder returns one row
    # per period, not one per state change. Applying the raw window bound to it
    # would refuse the very contract that makes long windows affordable.
    ledger = RecorderLedger()
    ledger.record(
        "statistics", source=FAKE_RECORDER, entities=1, window_seconds=365 * 24 * 3600, rows=12
    )
    ledger.assert_contained()


def test_a_raised_bound_is_explicit_in_the_test_not_invisible_in_the_harness() -> None:
    ledger = RecorderLedger(max_entities=100)
    ledger.record("statistics", source=FAKE_RECORDER, entities=80, window_seconds=3600, rows=80)
    ledger.assert_contained()
