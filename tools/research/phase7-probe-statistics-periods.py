"""Measure how Home Assistant resolves statistics period boundaries.

Run: node tools/python-launcher.mjs tools/research/phase7-probe-statistics-periods.py

Produces the day/week/month spans quoted in 07-RESEARCH.md section 2 -- 23 and
25 hour days, 167 and 169 hour weeks, 743 and 745 hour months for Europe/Berlin.
Committed so those numbers stay checkable rather than being asserted from a
scratch file nobody can re-run.
"""
import os
os.environ.setdefault("TZ", "Europe/Berlin")
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import homeassistant.util.dt as dt_util
dt_util.set_default_time_zone(ZoneInfo("Europe/Berlin"))
from homeassistant.components.recorder.statistics import (
    reduce_day_ts_factory, reduce_week_ts_factory, reduce_month_ts_factory,
)
BER = ZoneInfo("Europe/Berlin")
def show(label, factory, probe):
    same, start_end = factory()
    ts = probe.timestamp()
    lo, hi = start_end(ts)
    f = lambda t: datetime.fromtimestamp(t, BER).isoformat()
    print(f"{label}: probe={probe.isoformat()} -> [{f(lo)} .. {f(hi)}] span={(hi-lo)/3600:.2f}h")

# spring forward 2027-03-28, fall back 2027-10-31
for label, factory in (("day", reduce_day_ts_factory), ("week", reduce_week_ts_factory), ("month", reduce_month_ts_factory)):
    for probe in (datetime(2027, 3, 28, 12, tzinfo=BER), datetime(2027, 10, 31, 12, tzinfo=BER), datetime(2027, 6, 15, 12, tzinfo=BER)):
        show(label, factory, probe)
