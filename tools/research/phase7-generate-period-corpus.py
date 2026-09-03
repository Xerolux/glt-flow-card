"""Generate the Phase-7 period corpus from the vendored Home Assistant.

Run: node tools/python-launcher.mjs tools/research/phase7-generate-period-corpus.py

Home Assistant is the authority on where a period starts and ends -- the research
measured that it resolves day, week, month and year on local-midnight boundaries
in the configured timezone, with 23- and 25-hour days and 743- and 745-hour
months. This writes those resolutions out as committed data so both runtimes can
be compared against one shared corpus rather than against each other.

Regenerate with the command above. The corpus is data; nothing in the command
graph runs this.
"""
from __future__ import annotations

import io
import json
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

os.environ.setdefault("TZ", "Europe/Berlin")

import homeassistant.util.dt as dt_util

ZONE = ZoneInfo("Europe/Berlin")
dt_util.set_default_time_zone(ZONE)

import homeassistant.components.recorder.util as recorder_util
from homeassistant.components.recorder.util import resolve_period

OUT = "tests/components/glt_flow_card/fixtures/period_corpus.json"

#: Probes chosen so the corpus carries both transition directions and an
#: ordinary control for each. A corpus of only transition dates would not catch
#: a resolver that is wrong every day.
PROBES = [
    ("spring-forward", datetime(2027, 3, 28, 12, tzinfo=ZONE)),
    ("fall-back", datetime(2027, 10, 31, 12, tzinfo=ZONE)),
    ("ordinary-summer", datetime(2027, 6, 15, 12, tzinfo=ZONE)),
    ("ordinary-winter", datetime(2027, 11, 15, 9, 30, tzinfo=ZONE)),
]

SPECS = [
    ("day", {"calendar": {"period": "day", "offset": 0}}),
    ("day-previous", {"calendar": {"period": "day", "offset": -1}}),
    ("week-mon", {"calendar": {"period": "week", "offset": 0, "first_weekday": "mon"}}),
    ("week-sun", {"calendar": {"period": "week", "offset": 0, "first_weekday": "sun"}}),
    ("month", {"calendar": {"period": "month", "offset": 0}}),
    ("month-previous", {"calendar": {"period": "month", "offset": -1}}),
    ("year", {"calendar": {"period": "year", "offset": 0}}),
    ("year-previous", {"calendar": {"period": "year", "offset": -1}}),
    ("rolling-24h", {"rolling_window": {"duration": timedelta(hours=24)}}),
]


def canonical(moment: datetime) -> str:
    """Render an instant the way both runtimes must agree on it.

    Seconds precision, explicit offset. Phase 6 learned that agreeing on every
    value while disagreeing on every byte is the real failure mode, because
    `toISOString()` writes milliseconds and Python's `isoformat()` omits them at
    zero. Fixing the representation in the corpus makes that impossible here.
    """
    return moment.astimezone(ZONE).replace(microsecond=0).isoformat()


def main() -> None:
    entries = []
    for probe_name, probe in PROBES:
        recorder_util.dt_util.now = lambda fixed=probe: fixed
        recorder_util.dt_util.utcnow = lambda fixed=probe: fixed.astimezone(dt_util.UTC)
        for spec_name, spec in SPECS:
            start, end = resolve_period(spec)
            entries.append(
                {
                    "end": canonical(end),
                    "now": canonical(probe),
                    "probe": probe_name,
                    "span_hours": round((end - start).total_seconds() / 3600, 4),
                    "spec": spec_name,
                    "start": canonical(start),
                    "timezone": "Europe/Berlin",
                }
            )

    corpus = {
        "entries": sorted(entries, key=lambda e: (e["probe"], e["spec"])),
        "format": "glt-flow-card-phase7-period-corpus",
        "home_assistant": f"{dt_util.__name__.split('.')[0]} 2026.2.3",
        "note": "regenerate with node tools/python-launcher.mjs tools/research/phase7-generate-period-corpus.py",
        "version": 1,
    }
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(
        json.dumps(corpus, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )
    print(f"wrote {OUT} with {len(entries)} entries")


if __name__ == "__main__":
    main()
