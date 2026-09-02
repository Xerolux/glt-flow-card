"""The period vocabulary is closed in the Companion runtime.

Mirroring rather than importing is deliberate -- an import would make a silent
divergence invisible -- so the assertion that makes it safe is the byte
comparison against the browser runtime. That comparison lives in
``test/period-vocabulary.test.mjs``, not here: the Home Assistant lane workspace
has neither ``src/v100/`` nor a ``node`` binary, so a parity test on this side
would break the lane matrix.
"""
from __future__ import annotations

import pytest

from custom_components.glt_flow_card.period_vocabulary import (
    AGGREGATES,
    FIRST_WEEKDAYS,
    LABELS,
    PERIOD_CONTRACTS,
    PERIOD_NAMES,
    REFUSAL_REASONS,
    VALUE_SOURCES,
    contract_for,
    is_aggregate,
    is_period_name,
    is_value_source,
    label_for,
    vocabulary_fingerprint,
)


def test_an_unknown_period_is_refused_not_defaulted() -> None:
    # D12: `aggregateSeries` ends its ternary chain in an unguarded else, so
    # `aggregate: "p95"` silently computes a mean and reports no error. A
    # vocabulary that accepts anything is not a vocabulary.
    with pytest.raises(ValueError, match="unknown_period"):
        contract_for("sometimes")
    assert is_period_name("day") is True
    assert is_period_name("fortnight") is False


def test_an_unknown_aggregate_is_not_a_member() -> None:
    assert is_aggregate("p95") is False
    assert is_aggregate("mean") is True


def test_sum_is_deliberately_absent_from_the_aggregate_set() -> None:
    # Summing instantaneous samples does not produce watt-hours; the result
    # depends on the sampling rate (D11).
    assert "sum" not in AGGREGATES
    assert "change" in AGGREGATES


def test_year_is_answered_by_the_singular_contract() -> None:
    # Measured in 07-RESEARCH: the plural command's period enum stops at month.
    assert contract_for("year") == "statistic"
    assert contract_for("month") == "statistics"
    assert contract_for("day") == "statistics"
    assert contract_for("week") == "statistics"


def test_every_period_names_a_contract() -> None:
    for period in PERIOD_NAMES:
        assert PERIOD_CONTRACTS.get(period)


def test_the_sources_keep_no_data_and_did_not_ask_apart() -> None:
    assert VALUE_SOURCES == ("statistics", "raw", "unavailable")
    assert is_value_source("guess") is False


def test_every_member_has_wording_in_both_languages() -> None:
    for group, members in (
        ("aggregate", AGGREGATES),
        ("period", PERIOD_NAMES),
        ("refusal", REFUSAL_REASONS),
        ("source", VALUE_SOURCES),
    ):
        for member in members:
            for language in ("de", "en"):
                assert label_for(group, member, language)


def test_nothing_is_labelled_that_is_not_a_member() -> None:
    # The direction a loop over members alone cannot catch: a label left behind
    # after a member was removed is a set that quietly grew again.
    for group, members in (
        ("aggregate", AGGREGATES),
        ("period", PERIOD_NAMES),
        ("refusal", REFUSAL_REASONS),
        ("source", VALUE_SOURCES),
    ):
        for labelled in LABELS[group]:
            assert labelled in members, f"{group} {labelled!r} is labelled but not a member"


def test_every_refusal_reason_is_distinct_and_says_something_specific() -> None:
    assert len(set(REFUSAL_REASONS)) == len(REFUSAL_REASONS)
    for reason in REFUSAL_REASONS:
        # A bare refusal tells an engineer the tool disagrees with them; a reason
        # tells them which of the two is wrong. A one-word reason does neither.
        assert len(label_for("refusal", reason, "de")) > 20


def test_the_first_weekdays_match_the_calendar_specs_spelling() -> None:
    assert FIRST_WEEKDAYS == ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
