"""Adapt real Recorder statistics to named, bounded UI series."""
from datetime import datetime, timedelta, timezone
import math

from . import series_coverage


def instant(value):
    if isinstance(value, (float, int)) and not isinstance(value, bool):
        return datetime.fromtimestamp(value, timezone.utc).isoformat()
    return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()


def default_window(now):
    """The last 24 complete hourly buckets, resolved by the server."""
    end = now.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(hours=24)
    return start.isoformat(), end.isoformat(), [(start + timedelta(hours=i)).isoformat() for i in range(24)]


def build_statistics(answer, entity_ids, expected, *, error=None, limit=500):
    grid = [instant(at) for at in expected]
    series, gaps = [], []
    remaining = max(0, limit)
    capped = False
    coverages = []
    for entity_id in dict.fromkeys(entity_ids):
        rows = []
        for raw in (answer or {}).get(entity_id, []) if isinstance(answer, dict) else []:
            try:
                at = instant(raw.get("start"))
            except (ValueError, TypeError, OverflowError, OSError):
                continue
            value = next((raw[key] for key in ("mean", "change", "state")
                          if isinstance(raw.get(key), (int, float)) and not isinstance(raw[key], bool)
                          and math.isfinite(raw[key])), None)
            rows.append({"start": at, "value": value})
        rows.sort(key=lambda row: row["start"])
        capped = capped or len(rows) > remaining
        rows = rows[:remaining]
        remaining -= len(rows)
        built = series_coverage.build_series({"contract": "statistics", "returned": rows,
            "expected_instants": grid, "expected_buckets": len(grid), "error": error})
        series.append({"entity_id": entity_id, "label": entity_id, "points": built["points"],
                       "coverage": built["coverage"], "gaps": built["gaps"]})
        coverages.append(built["coverage"])
        gaps.extend(built["gaps"])
    return {"series": series, "coverage": min(coverages, default=0), "gaps": gaps,
            "source": "unavailable" if error else "statistics", "capped": capped}
