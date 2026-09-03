"""A roll-up says how complete it is (T9-14).

The defect this phase is named after: an answer that is incomplete and does not
say so. A portfolio view of five sites where one did not respond, rendered as a
portfolio view of five sites.
"""
from __future__ import annotations

import json

import pytest

from custom_components.glt_flow_card import site_rollup
from custom_components.glt_flow_card.remote_fanout import SiteAnswer
from custom_components.glt_flow_card.site_rollup import IncompleteAggregate

EFFECT_PREFIX = "PHASE9_ROLLUP_EFFECTS "


def _emit(**counts):
    print(EFFECT_PREFIX + json.dumps(
        {"network": 0, "remote": 0, "service": 0, "socket": 0, **counts}, sort_keys=True,
    ))


def _answers():
    return [
        SiteAnswer(site_id="nord", state="healthy", states={"sensor.a": {"state": "1"}}),
        SiteAnswer(site_id="sued", state="healthy", states={"sensor.b": {"state": "2"}}),
        SiteAnswer(site_id="west", state="unreachable", reason="timeout"),
    ]


def test_a_partial_roll_up_names_the_sites_it_is_missing():
    """A count is not enough.

    "Two sites are missing" and "the two northern plants are missing" lead to
    different actions, and only the second lets somebody go and look.
    """
    result = site_rollup.roll_up(_answers(), values={"nord": 10.0, "sued": 20.0}, label="Verbrauch")
    _emit(sites=3)
    assert result["complete"] is False
    assert result["answered_sites"] == ["nord", "sued"]
    assert result["absent_sites"] == [
        {"reason": "timeout", "site_id": "west", "state": "unreachable"},
    ]


def test_a_silent_site_contributes_nothing_rather_than_zero():
    """Contributing zero is exactly how a total comes out smaller and confident.

    Phase 7 found this with meters: a month with half its meters offline
    reported a smaller cost. This is that, one network hop out.
    """
    result = site_rollup.roll_up(
        _answers(), values={"nord": 10.0, "sued": 20.0, "west": 999.0},
    )
    assert result["total"] == 30
    # And the discarded contribution is named, so a reader can see whose number
    # was left out rather than only that the total is partial.
    assert result["ignored_contributions"] == ["west"]


def test_coverage_is_stated_and_uses_phase_sevens_shape():
    """A second notion of "how complete is this" is how two parts start disagreeing."""
    result = site_rollup.roll_up(_answers())
    assert result["coverage"] == pytest.approx(2 / 3)
    assert result["total_sites"] == 3


def test_a_complete_roll_up_says_it_is_complete():
    """Otherwise "complete" would only ever be inferred from an empty list.

    An assertion that only ever sees the incomplete case cannot tell a correct
    implementation from one that always reports incompleteness.
    """
    answers = [
        SiteAnswer(site_id="nord", state="healthy", states={}),
        SiteAnswer(site_id="sued", state="slow", states={}),
    ]
    result = site_rollup.roll_up(answers)
    assert result["complete"] is True
    assert result["coverage"] == 1
    assert result["absent_sites"] == []


def test_a_slow_site_counts_as_answered():
    """`slow` is an answer. Treating it as absent would discard real data."""
    answers = [SiteAnswer(site_id="s", state="slow", states={"sensor.a": {"state": "1"}})]
    assert site_rollup.roll_up(answers)["complete"] is True


def test_a_circuit_open_site_is_absent_with_that_reason():
    """It carries *why* it is absent, and the reason is not "timeout"."""
    answers = [
        SiteAnswer(site_id="a", state="healthy", states={}),
        SiteAnswer(site_id="b", state="circuit_open", reason="circuit_open"),
    ]
    absent = site_rollup.roll_up(answers)["absent_sites"]
    assert absent == [{"reason": "circuit_open", "site_id": "b", "state": "circuit_open"}]


def test_failing_the_whole_roll_up_is_not_an_option():
    """Explicitly asserted, because it is the tempting wrong fix.

    Errors are simpler than partial answers, and raising here would make four
    healthy sites invisible because of one that is down — worse than the
    missing one.
    """
    answers = [SiteAnswer(site_id=f"s{i}", state="unreachable", reason="timeout") for i in range(4)]
    answers.append(SiteAnswer(site_id="alive", state="healthy", states={"sensor.a": {"state": "1"}}))
    result = site_rollup.roll_up(answers, values={"alive": 5.0})
    assert result["answered_sites"] == ["alive"]
    assert result["total"] == 5


def test_an_aggregate_without_stated_completeness_is_refused():
    """A guard rather than a convention.

    A convention is followed until somebody adds a fourth aggregate in a hurry,
    and the failure is silent by construction: the number renders and looks
    right.
    """
    with pytest.raises(IncompleteAggregate) as refused:
        site_rollup.require_stated_completeness({"label": "Verbrauch", "total": 30})
    assert "absent_sites" in str(refused.value)


def test_a_well_formed_aggregate_passes_the_guard():
    result = site_rollup.roll_up(_answers(), values={"nord": 1.0})
    assert site_rollup.require_stated_completeness(result) is result


def test_an_empty_portfolio_has_zero_coverage_rather_than_full():
    """No sites is not "all sites answered".

    Reading it as complete would report an unconfigured installation as a
    healthy one, which is the confident-zero shape three phases have now
    corrected.
    """
    assert site_rollup.coverage_of([]) == 0
