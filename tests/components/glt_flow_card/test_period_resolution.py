"""Named periods resolve on local-calendar boundaries (T7-07).

D9: buckets are aligned to the UTC epoch with
``Math.floor(x / bucketMs) * bucketMs``, so for ``Europe/Berlin`` every "daily"
bucket starts at 01:00 or 02:00 local, and on a transition day it contains an
hour too much or too little of the wrong day. ``bucket_minutes`` cannot express
a month at all, and the report designer offers months and years.

The corpus these assertions run against was generated from the vendored Home
Assistant, which is the authority on where a period starts and ends. Every span
below was measured, not chosen.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from .phase7_red import emit_queries, missing, report

pytestmark = [
    pytest.mark.expected_red,
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase7-period-resolution]: "
    "local-calendar period resolution is unavailable"
)
EFFECT_PREFIX = "PHASE7_PERIOD_QUERIES "

CORPUS = json.loads(
    (Path(__file__).parent / "fixtures" / "period_corpus.json").read_text(encoding="utf-8")
)


def test_expected_red_phase7_period_resolution(recorder_ledger) -> None:
    emit_queries(EFFECT_PREFIX, recorder_ledger, corpus=len(CORPUS["entries"]))
    gaps: list[str] = []

    gap = missing("period_resolution", "resolve")
    if gap:
        gaps.append(gap)
        report(RED_MARKER, gaps, "local-calendar period resolution is unavailable")
        return

    from custom_components.glt_flow_card import period_resolution

    for entry in CORPUS["entries"]:
        resolved = period_resolution.resolve(
            entry["spec"], now=entry["now"], timezone=entry["timezone"]
        )
        if resolved.get("start") != entry["start"] or resolved.get("end") != entry["end"]:
            gaps.append(
                f"{entry['probe']}/{entry['spec']}: resolved "
                f"{resolved.get('start')}..{resolved.get('end')}, "
                f"corpus says {entry['start']}..{entry['end']}"
            )
        if abs(float(resolved.get("span_hours", 0)) - entry["span_hours"]) > 0.001:
            gaps.append(
                f"{entry['probe']}/{entry['spec']}: span {resolved.get('span_hours')!r} "
                f"hours, measured {entry['span_hours']}"
            )

    # An unknown period is refused, not defaulted. The defect this replaces
    # defaulted: an unrecognised aggregate silently became the mean.
    try:
        period_resolution.resolve("sometimes", now=CORPUS["entries"][0]["now"], timezone="Europe/Berlin")
    except ValueError:
        pass
    else:
        gaps.append("an unknown period name was resolved rather than refused")

    report(RED_MARKER, gaps, "local-calendar period resolution is unavailable")
