"""Ask the Recorder, through the contracts the research pinned.

This module is the step my planning omitted. 07-08 declared the four history
routes, 07-09 bounded them and 07-10 computes coverage from an answer -- and
nothing owned *obtaining* the answer, so the routes returned an honestly-sourced
empty result. A surface built on that would render an always-empty series, pass
its own rendering tests, and show an operator nothing.

Which contract answers which question was measured, not assumed
(``07-RESEARCH.md``):

- ``recorder/statistics_during_period`` takes ``period`` in
  ``5minute | hour | day | week | month`` and returns one row per period, with
  boundaries already resolved on local midnights in the configured timezone;
- ``recorder/statistic_during_period`` takes a ``CalendarStatisticPeriod`` whose
  ``period`` reaches ``year``, which the plural command cannot;
- ``history/history_during_period`` returns raw states.

The functions here are thin on purpose. They build a request, hand it to Home
Assistant, and shape the answer for ``series_coverage`` -- the arithmetic lives
where it was tested, and this module's only job is to be the place where "we
asked" and "we did not ask" become distinguishable.
"""
from __future__ import annotations

from typing import Any

from .period_vocabulary import contract_for

#: The websocket commands this module issues. Named here so a test can assert
#: which one a query used without reaching into Home Assistant's internals.
RECORDER_COMMANDS: dict[str, str] = {
    "statistic": "recorder/statistic_during_period",
    "statistics": "recorder/statistics_during_period",
    "raw": "history/history_during_period",
}

#: Statistic types this product asks for. `change` is the reset-aware difference
#: 07-12 depends on; `state` is the meter reading itself.
STATISTIC_TYPES: tuple[str, ...] = ("change", "max", "mean", "min", "state")


def build_request(
    *,
    period: str,
    entity_ids: Any,
    start: str,
    end: str,
    types: Any = None,
) -> dict[str, Any]:
    """Return the Recorder request for one period, or refuse.

    Refuses an unknown period rather than defaulting, so a caller cannot ask for
    "sometimes" and receive a day.
    """
    contract = contract_for(period) if period != "custom" else "raw"
    if contract == "either":
        contract = "statistics"
    ids = [str(entity) for entity in (entity_ids or [])]

    if contract == "statistics":
        return {
            "contract": "statistics",
            "message": {
                "end_time": end,
                "period": period,
                "start_time": start,
                "statistic_ids": ids,
                "type": RECORDER_COMMANDS["statistics"],
                "types": sorted(set(types or ("change",))),
            },
        }

    if contract == "statistic":
        # `year` lives only here. The plural command's enum stops at `month`,
        # and reading it alone concludes -- wrongly -- that the product must
        # aggregate years itself.
        return {
            "contract": "statistic",
            "message": {
                "calendar": {"offset": 0, "period": period},
                "statistic_id": ids[0] if ids else "",
                "type": RECORDER_COMMANDS["statistic"],
                "types": sorted(set(types or ("change",))),
            },
        }

    return {
        "contract": "raw",
        "message": {
            "end_time": end,
            "entity_ids": ids,
            "start_time": start,
            "type": RECORDER_COMMANDS["raw"],
        },
    }


def shape_answer(
    contract: str,
    answer: Any,
    *,
    expected_instants: Any,
    period: str | None = None,
    unit: str | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    """Shape a Recorder answer into the case ``series_coverage`` reads.

    ``expected_instants`` comes from ``period_resolution`` and is not derivable
    from the answer: the Recorder omits empty periods, so what came back is
    exactly the thing that cannot say what was asked for.

    A failure is carried as ``error`` rather than as an empty answer, because a
    correct implementation and a broken one both produce an empty series and
    only the stated source separates them.
    """
    if contract not in RECORDER_COMMANDS:
        raise ValueError(f"unknown recorder contract: {contract!r}")
    expected = [str(entry) for entry in (expected_instants or [])]
    rows: list[dict[str, Any]] = []
    if not error:
        for row in _rows_of(answer):
            if isinstance(row, dict):
                rows.append(row)
    return {
        "contract": contract,
        "error": error,
        "expected_buckets": len(expected),
        "expected_instants": expected,
        "period": period,
        "returned": rows,
        "unit_of_measurement": unit,
    }


def _rows_of(answer: Any) -> list[Any]:
    """Return the rows in a Recorder answer, whichever shape it arrived in.

    The plural command answers a mapping of statistic id to rows; the singular
    one answers a single object; the raw path answers a mapping of entity id to
    states. Normalising here keeps three shapes out of the arithmetic.
    """
    if isinstance(answer, list):
        return answer
    if isinstance(answer, dict):
        if any(isinstance(value, list) for value in answer.values()):
            collected: list[Any] = []
            for value in answer.values():
                if isinstance(value, list):
                    collected.extend(value)
            return collected
        return [answer]
    return []
