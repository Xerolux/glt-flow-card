"""Measure resolve_period for calendar, rolling and fixed statistic periods.

Run: node tools/python-launcher.mjs tools/research/phase7-probe-resolve-period.py

Produces the table in 07-RESEARCH.md section 2, with "now" fixed at
2027-11-15T09:30+01:00 so the output is deterministic. This is the probe that
establishes that `year` is reachable through the calendar spec and that a
fall-back month resolves to 745 hours.
"""
import os
os.environ.setdefault("TZ", "Europe/Berlin")
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import homeassistant.util.dt as dt_util
BER = ZoneInfo("Europe/Berlin")
dt_util.set_default_time_zone(BER)
from homeassistant.components.recorder.util import resolve_period
import homeassistant.util.dt as u

# Freeze "now" by monkeypatching dt_util.now used inside resolve_period
import homeassistant.components.recorder.util as ru
fixed = datetime(2027, 11, 15, 9, 30, tzinfo=BER)
ru.dt_util.now = lambda: fixed
ru.dt_util.utcnow = lambda: fixed.astimezone(u.UTC)

def show(label, spec):
    s, e = resolve_period(spec)
    f = lambda t: t.astimezone(BER).isoformat() if t else None
    span = (e - s).total_seconds()/3600 if s and e else None
    print(f"{label}: [{f(s)} .. {f(e)}] span={span}h" if span else f"{label}: [{f(s)} .. {f(e)}]")

show("calendar year, offset 0", {"calendar": {"period": "year", "offset": 0}})
show("calendar year, offset -1", {"calendar": {"period": "year", "offset": -1}})
show("calendar month, offset 0", {"calendar": {"period": "month", "offset": 0}})
show("calendar month, offset -1", {"calendar": {"period": "month", "offset": -1}})
show("calendar day, offset -1", {"calendar": {"period": "day", "offset": -1}})
show("calendar week mon", {"calendar": {"period": "week", "offset": 0, "first_weekday": "mon"}})
show("calendar week sun", {"calendar": {"period": "week", "offset": 0, "first_weekday": "sun"}})
show("rolling 24h", {"rolling_window": {"duration": timedelta(hours=24)}})
