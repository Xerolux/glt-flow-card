"""A report run records what it was computed from, and reproduces it.

D19: ``reportCsv`` iterates ``card._config.kpis``, ``alarms`` and ``assets`` and
writes ``card._display?.(...)`` -- the value being rendered right now. The
designer offers day, week, month and year; nothing downstream reads ``period``.
A "Monatsbericht" contains one instant and says so nowhere.

D23: ids are ``report_${Date.now()}``. Phase 5 found and fixed the same defect in
paste, for the same two reasons: a clock-derived id is not reproducible and
collides within a millisecond. Reports are the one artefact in this product
explicitly required to be reproducible.

Both halves of reproducibility are here, and the second matters as much as the
first. **A report that silently produces a different number the second time is
worse than one that refuses**, because the first version has already been sent to
someone, and the difference between the two is the thing nobody can see.

This is Phase 1's receipt pattern and Phase 2's audit provenance applied to a
computed artifact rather than to a mutation.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from . import period_resolution
from .measured_value import canonical_number

#: What every run records. Closed: a run missing any of these cannot be
#: reproduced or defended, and the point of a run is that it can be.
RECORDED_INPUTS: tuple[str, ...] = (
    "aggregate",
    "coverage",
    "deadband",
    "produced_at",
    "report_id",
    "sources",
    "timezone",
    "version",
    "window",
)

#: Conservative default, a site decision in the sense Phase 6 established.
#: Unbounded state is a leak with a friendly name.
DEFAULT_RUNS_RETAINED = 200

#: The period spec a report's `{name, offset}` maps to. Reports name a period the
#: way a person does -- "last month" -- and the resolver takes a spec name.
_SPEC_FOR = {
    ("day", 0): "day", ("day", -1): "day-previous",
    ("week", 0): "week-mon",
    ("month", 0): "month", ("month", -1): "month-previous",
    ("year", 0): "year", ("year", -1): "year-previous",
}


def spec_for(period: Any) -> str:
    """Return the resolver spec for a report's period, or refuse.

    Refuses rather than falling back to a default, because a report whose period
    silently became "today" is exactly the class of defect this plan closes.
    """
    period = period or {}
    name = period.get("name")
    offset = int(period.get("offset") or 0)
    spec = _SPEC_FOR.get((name, offset))
    if spec is None:
        raise ValueError(f"unknown_period: {name!r} with offset {offset}")
    return spec


def _fingerprint(definition: Any, window: Any, settings: Any) -> str:
    """Return the digest of everything that decides a run's value.

    Content-derived, so re-running the same report over the same period gives the
    same id, and two reports that differ anywhere that matters give different
    ones. `Date.now()` gives neither property.
    """
    material = json.dumps(
        {
            "aggregate": (settings or {}).get("aggregate"),
            "content": list((definition or {}).get("content") or []),
            "deadband": (settings or {}).get("deadband"),
            "id": (definition or {}).get("id"),
            "version": (definition or {}).get("version"),
            "window": window,
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def execute(
    definition: Any,
    *,
    now: str,
    timezone: str,
    settings: Any = None,
    previous: Any = None,
) -> dict[str, Any]:
    """Run one report over its resolved period, recording every input.

    ``previous`` is an earlier run of the same report. When one is given, the
    result names which inputs differ, so a changed number is explained rather
    than merely produced.
    """
    definition = definition or {}
    settings = settings or {}
    resolved = period_resolution.resolve(
        spec_for(definition.get("period")), now=now, timezone=timezone
    )
    window = {"end": resolved["end"], "span_hours": resolved["span_hours"], "start": resolved["start"]}

    sources = [str(entry) for entry in (definition.get("content") or [])]
    run = {
        "aggregate": settings.get("aggregate", "none"),
        "coverage": canonical_number(float(settings.get("coverage", 0))),
        "deadband": canonical_number(float(settings.get("deadband", 0))),
        "produced_at": now,
        "report_id": str(definition.get("id") or _fingerprint(definition, window, settings)[:16]),
        "sources": sources,
        "timezone": timezone,
        "value": settings.get("value"),
        "version": int(definition.get("version") or 1),
        "window": window,
    }
    run["fingerprint"] = _fingerprint(definition, window, settings)
    run["changed_inputs"] = changed_inputs(previous, run)
    return run


def changed_inputs(previous: Any, current: Any) -> list[str]:
    """Return which recorded inputs differ between two runs.

    Names them rather than reporting a boolean, because "this number changed"
    without "and here is what changed" leaves the reader to guess, and the
    plausible guess is that the plant changed.
    """
    if not previous:
        return []
    differing = [
        field for field in RECORDED_INPUTS
        if field != "produced_at" and (previous or {}).get(field) != (current or {}).get(field)
    ]
    return sorted(differing)


def reproduces(previous: Any, current: Any) -> bool:
    """Return whether two runs computed the same thing from the same inputs."""
    return bool(previous) and (previous or {}).get("fingerprint") == (current or {}).get("fingerprint")


def prune_runs(runs: Any, *, retained: int = DEFAULT_RUNS_RETAINED) -> list[Any]:
    """Keep the most recent runs, dropping the oldest.

    Bounded with a configured default, as Phase 6 bounded alarm history and
    schedule runs. A bound of zero or less is ignored rather than honoured: it
    would silently discard every run and read as a feature that never worked.
    """
    rows = list(runs or [])
    if not isinstance(retained, int) or isinstance(retained, bool) or retained < 1:
        retained = DEFAULT_RUNS_RETAINED
    return rows[-retained:]
