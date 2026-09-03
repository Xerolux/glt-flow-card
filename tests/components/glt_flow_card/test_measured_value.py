"""The measured value in the Companion runtime.

The mirror of ``test/measured-value.test.mjs``. The cross-runtime byte
comparison that makes mirroring safe lives in ``test/measured-value.test.mjs``
rather than here, and deliberately so: the Home Assistant lane workspace
contains neither ``src/v100/`` nor a ``node`` binary, so a parity test written
on this side would break the lane matrix. Node can reach Python; the lane cannot
reach Node. ``test_lane_portability.py`` is what caught the first attempt.
"""
from __future__ import annotations

import pytest

from custom_components.glt_flow_card.measured_value import (
    MEASURED_FIELDS,
    absent,
    canonical_measured,
    coverage_of,
    has_value,
    is_complete,
    measured,
)
from custom_components.glt_flow_card.period_vocabulary import (
    AGGREGATES,
    PERIOD_NAMES,
    REFUSAL_REASONS,
    VALUE_SOURCES,
    contract_for,
    label_for,
    vocabulary_fingerprint,
)

COMPLETE = {
    "coverage": 1,
    "period": "day",
    "source": "statistics",
    "unit": "kWh",
    "value": 79,
}


def test_a_measured_value_cannot_be_built_without_coverage() -> None:
    with pytest.raises(TypeError):
        measured(value=1, unit="kWh", source="statistics", period="day")


@pytest.mark.parametrize("coverage", [-0.1, 1.1, float("nan"), "most", True])
def test_coverage_must_be_a_fraction(coverage) -> None:
    with pytest.raises(ValueError, match="coverage"):
        measured(**{**COMPLETE, "coverage": coverage})


def test_a_value_with_zero_coverage_is_a_contradiction() -> None:
    with pytest.raises(ValueError, match="not a value"):
        measured(**{**COMPLETE, "coverage": 0, "value": 0})


def test_absent_is_a_complete_answer_and_it_is_not_zero() -> None:
    nothing = absent(source="unavailable", period="day")
    assert nothing["value"] is None
    assert nothing["coverage"] == 0
    assert has_value(nothing) is False
    assert is_complete(nothing) is False
    # The distinction the whole phase turns on.
    assert nothing["value"] is not 0  # noqa: F632 - identity is the point


@pytest.mark.parametrize("value", ["", "n/a", "—", True])
def test_a_value_is_a_number_or_none_never_a_placeholder(value) -> None:
    with pytest.raises(ValueError, match="number or None"):
        measured(**{**COMPLETE, "value": value})


def test_an_unknown_source_or_period_is_refused() -> None:
    with pytest.raises(ValueError, match="unknown_source"):
        measured(**{**COMPLETE, "source": "guess"})
    with pytest.raises(ValueError, match="unknown_period"):
        measured(**{**COMPLETE, "period": "sometimes"})


def test_the_three_sources_keep_no_data_and_did_not_ask_apart() -> None:
    no_data = absent(source="statistics", period="day")
    not_asked = absent(source="unavailable", period="day")
    assert no_data["value"] == not_asked["value"]
    assert no_data["coverage"] == not_asked["coverage"]
    assert no_data["source"] != not_asked["source"]


def test_every_gap_names_a_start_and_an_end() -> None:
    with pytest.raises(ValueError, match="start and an end"):
        measured(**{**COMPLETE, "gaps": [{"start": "x"}]})
    with_gap = measured(
        **{
            **COMPLETE,
            "coverage": 0.5,
            "gaps": [{"end": "2027-06-06T00:00:00+02:00", "start": "2027-06-03T00:00:00+02:00"}],
        }
    )
    assert len(with_gap["gaps"]) == 1
    assert is_complete(with_gap) is False


def test_coverage_is_computed_from_expected_against_returned() -> None:
    assert coverage_of(7, 7) == 1
    assert coverage_of(7, 0) == 0
    assert coverage_of(7, 4) == 4 / 7
    assert coverage_of(7, 99) == 1
    assert coverage_of(0, 0) == 0
    with pytest.raises(ValueError, match="non-negative integer"):
        coverage_of(-1, 0)


def test_the_field_set_is_closed_and_every_field_is_present() -> None:
    assert sorted(measured(**COMPLETE)) == sorted(MEASURED_FIELDS)
