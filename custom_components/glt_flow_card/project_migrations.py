"""Pure sequential project migrations with canonical receipts."""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections.abc import Callable, Mapping
from typing import Any

from .alarm_vocabulary import migrate_severity
from .project_contract import digest_canonical_json, evaluate_project_contract

CURRENT_PROJECT_SCHEMA_VERSION = 5


def _clone_canonical(value: Any) -> Any:
    return json.loads(digest_canonical_json(value)["canonical"])


def _slug(value: Any) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or "glt-project"))
    normalized = "".join(character for character in normalized if not unicodedata.combining(character))
    result = re.sub(r"[^a-zA-Z0-9._:-]+", "-", normalized).strip("-").lower()
    return result or "glt-project"


def _step_zero_to_one(source: Mapping[str, Any]) -> dict[str, Any]:
    candidate = _clone_canonical(source)
    candidate["schema_version"] = 1
    return _clone_canonical(candidate)


def _step_one_to_two(source: Mapping[str, Any]) -> dict[str, Any]:
    candidate = _clone_canonical(source)
    existing = candidate.get("project") or {}
    name = existing.get("name") or candidate.get("title") or "GLT Project"
    candidate["schema_version"] = 2
    candidate["project"] = {
        "id": existing.get("id") or _slug(name),
        "name": name,
        "revision": existing.get("revision", 0),
        **existing,
    }
    return _clone_canonical(candidate)


def _step_two_to_three(source: Mapping[str, Any]) -> dict[str, Any]:
    candidate = _clone_canonical(source)
    candidate["schema_version"] = 3
    # Schema 2's `semantic_model` was an unvalidated open object. Schema 3 gives
    # it a validated shape; anything already there is preserved, and an empty
    # node list is added only where none existed. Nothing is dropped, because a
    # migration that discards content an engineer authored is not a migration.
    existing = candidate.get("semantic_model")
    model = dict(existing) if isinstance(existing, Mapping) else {}
    if not isinstance(model.get("nodes"), list):
        model["nodes"] = []
    candidate["semantic_model"] = model
    return _clone_canonical(candidate)


def _step_three_to_four(source: Mapping[str, Any]) -> dict[str, Any]:
    candidate = _clone_canonical(source)
    candidate["schema_version"] = 4
    # Schema 3's profile ports were `openObject` -- entirely unvalidated, so a
    # typo in `direction` survived every check. Schema 4 gives a port a closed
    # shape, which means anything already there has to fit it.
    #
    # Two rules, both chosen so nothing an engineer authored is lost or
    # invented: a field the closed shape does not define is dropped rather than
    # failing the whole migration, because a port carrying an unknown key is a
    # schema-2-era accident and not content; and `kind` is defaulted only where
    # the medium makes it unambiguous. Where it does not, the port is left
    # without one, and the compatibility check treats an absent kind as
    # "unknown" -- which refuses less than a wrong guess would.
    known = ("id", "label", "medium", "direction", "side", "kind", "multiplicity")
    signal_media = ("signal", "control", "status")
    power_media = ("power", "electrical", "mains")
    profiles = candidate.get("profiles")
    for profile in profiles if isinstance(profiles, list) else []:
        ports = profile.get("ports") if isinstance(profile, dict) else None
        if not isinstance(ports, list):
            continue
        rebuilt = []
        for port in ports:
            if not isinstance(port, Mapping):
                rebuilt.append(port)
                continue
            nxt = {key: port[key] for key in known if key in port}
            if "kind" not in nxt:
                medium = str(nxt.get("medium", ""))
                if medium in signal_media:
                    nxt["kind"] = "signal"
                elif medium in power_media:
                    nxt["kind"] = "power"
                elif medium:
                    nxt["kind"] = "process"
            rebuilt.append(nxt)
        profile["ports"] = rebuilt
    # Contributions are new and start empty. An absent collection and an empty
    # one must not differ, or "no packs installed" reads as two different states.
    if not isinstance(candidate.get("contributions"), list):
        candidate["contributions"] = []
    return _clone_canonical(candidate)


#: Fields schema 5 declares on an alarm. Anything else is quarantined.
#:
#: This list and ``schemas/project/5.schema.json`` must agree exactly, and
#: ``test_project_migrations.py`` asserts it against the schema. They disagreed
#: once during development -- ``state`` was declared and not listed -- and the
#: symptom was a Phase-4 roll-up silently counting nothing, because the
#: migration quarantined a field the schema was happy to keep.
_ALARM_FIELDS = (
    "active_states", "condition", "delay_seconds", "entity", "equipment_id",
    "hysteresis", "id", "inactive_states", "label", "legacy", "links",
    "maintenance", "name", "notification", "priority", "state",
)

#: Fields schema 5 declares on a schedule.
_SCHEDULE_FIELDS = (
    "binding", "data", "days", "enabled", "entity_id", "from", "id", "kind",
    "legacy", "name", "service", "time", "to",
)

_TIME_PATTERN = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")

#: Exported so a test can compare them against the schema they mirror.
SCHEMA_MIRRORED_FIELDS = {"alarm": _ALARM_FIELDS, "schedule": _SCHEDULE_FIELDS}


def _alarm_collections(candidate: dict[str, Any]) -> list[list[Any]]:
    """Return every alarm collection in a candidate, wherever it lives.

    There are two: the project's own and each profile's. The audit called the
    second "equipment level"; it is actually on the profile, which is why this
    walks rather than naming them.
    """
    collections: list[list[Any]] = []
    if isinstance(candidate.get("alarms"), list):
        collections.append(candidate["alarms"])
    for profile in candidate.get("profiles") or []:
        if isinstance(profile, dict) and isinstance(profile.get("alarms"), list):
            collections.append(profile["alarms"])
    return collections


def _quarantine(target: dict[str, Any], key: str, value: Any, reported: list[str]) -> None:
    """Move one rejected value into ``legacy``, recording what it was called."""
    legacy = target.get("legacy")
    if not isinstance(legacy, dict):
        legacy = {}
        target["legacy"] = legacy
    legacy[key] = value
    reported.append(key)


def _migrate_alarm(alarm: Any, reported: list[str]) -> None:
    if not isinstance(alarm, dict):
        return
    undeclared = [key for key in list(alarm) if key not in _ALARM_FIELDS]
    for key in undeclared:
        _quarantine(alarm, key, alarm[key], reported)
        del alarm[key]

    legacy = alarm.get("legacy") if isinstance(alarm.get("legacy"), dict) else {}
    stored = legacy.get("severity", alarm.get("priority"))
    if stored is not None or "priority" in alarm:
        alarm["priority"] = migrate_severity(stored)["priority"]

    for key, coerce in (("delay_seconds", int), ("hysteresis", float)):
        if key not in alarm:
            continue
        raw = alarm[key]
        try:
            numeric = float(raw)
        except (TypeError, ValueError):
            numeric = float("nan")
        if numeric != numeric or numeric < 0:  # NaN or negative
            # Quarantined, never coerced. Coercing "soon" to 0 would turn a
            # visible misconfiguration into an alarm that fires instantly and
            # looks correct.
            _quarantine(alarm, key, raw, reported)
            del alarm[key]
        else:
            alarm[key] = coerce(numeric)


def _migrate_schedule(schedule: Any, reported: list[str]) -> None:
    if not isinstance(schedule, dict):
        return
    undeclared = [key for key in list(schedule) if key not in _SCHEDULE_FIELDS]
    for key in undeclared:
        _quarantine(schedule, key, schedule[key], reported)
        del schedule[key]

    # Schema 4 declared no `kind`, and every stored schedule is an instant: the
    # runner compares one `HH:MM` and calls a service. Declaring it is not a
    # guess, it is writing down what the only implementation does.
    schedule.setdefault("kind", "instant")

    for key in ("time", "from", "to"):
        if key not in schedule:
            continue
        value = schedule[key]
        if not isinstance(value, str) or not _TIME_PATTERN.match(value):
            _quarantine(schedule, key, value, reported)
            del schedule[key]
    days = schedule.get("days")
    if isinstance(days, list):
        valid = [d for d in days if isinstance(d, int) and not isinstance(d, bool) and 0 <= d <= 6]
        if len(valid) != len(days):
            _quarantine(schedule, "days", days, reported)
            schedule["days"] = valid


def _step_four_to_five(source: Mapping[str, Any]) -> dict[str, Any]:
    candidate = _clone_canonical(source)
    candidate["schema_version"] = 5
    # Schema 4 left every field the alarm engine and the schedule runner read
    # undeclared, so `delay_seconds: "soon"` and `time: "tea"` were both
    # schema-valid and failed at the moment the effect was supposed to happen.
    #
    # The rule here is quarantine, not deletion. A rejected value moves into
    # `legacy` and is reported: a site's misconfiguration is still its data, and
    # the receipt is where it learns. That differs deliberately from the 3-to-4
    # port rule, which dropped unknown keys -- a port carrying an unknown key
    # was a schema-2-era accident, while `delay_seconds: "soon"` is something a
    # person typed on purpose.
    reported: list[str] = []
    for collection in _alarm_collections(candidate):
        for alarm in collection:
            _migrate_alarm(alarm, reported)
    for schedule in candidate.get("schedules") or []:
        _migrate_schedule(schedule, reported)
    if "timezone" in candidate and not isinstance(candidate["timezone"], str):
        del candidate["timezone"]
    return _clone_canonical(candidate)


PROJECT_MIGRATIONS: dict[int, dict[str, int | Callable[[Mapping[str, Any]], dict[str, Any]]]] = {
    0: {"from": 0, "to": 1, "migrate": _step_zero_to_one},
    1: {"from": 1, "to": 2, "migrate": _step_one_to_two},
    2: {"from": 2, "to": 3, "migrate": _step_two_to_three},
    3: {"from": 3, "to": 4, "migrate": _step_three_to_four},
    4: {"from": 4, "to": 5, "migrate": _step_four_to_five},
}


def _contract_failure(prefix: str, evidence: Mapping[str, Any]) -> ValueError:
    details = ", ".join(f'{error["code"]}@{error["path"]}' for error in evidence["errors"])
    return ValueError(f"{prefix}: {details or 'unknown contract error'}")


def _step_receipt(
    step: Mapping[str, Any], source: Mapping[str, Any], candidate: Mapping[str, Any]
) -> dict[str, Any]:
    return {
        "id": f'{step["from"]}->{step["to"]}',
        "from": step["from"],
        "to": step["to"],
        "source_digest": digest_canonical_json(source)["digest"],
        "candidate_digest": digest_canonical_json(candidate)["digest"],
        "warnings": [],
        "loss": {"dropped": [], "preserved": []},
    }


def migrate_project_document(raw_input: Any, *, dry_run: bool = True) -> dict[str, Any]:
    """Return a validated migrated copy and receipt without persistence."""

    del dry_run
    source_evidence = evaluate_project_contract(raw_input)
    source = json.loads(source_evidence["canonical"]) if source_evidence["canonical"] else _clone_canonical(raw_input)
    declared_version = source.get("schema_version", 0) if isinstance(source, dict) else None
    if isinstance(declared_version, int) and declared_version > CURRENT_PROJECT_SCHEMA_VERSION:
        raise ValueError(f"unsupported project schema version {declared_version}")
    if not source_evidence["valid"]:
        raise _contract_failure("source project contract is invalid", source_evidence)

    candidate = _clone_canonical(source)
    version = source_evidence["schema_version"]
    steps: list[dict[str, Any]] = []
    while version < CURRENT_PROJECT_SCHEMA_VERSION:
        step = PROJECT_MIGRATIONS.get(version)
        if step is None or step["to"] != version + 1:
            raise ValueError(f"missing sequential project migration {version}->{version + 1}")
        before = candidate
        migrate = step["migrate"]
        assert callable(migrate)
        candidate = migrate(before)
        target_evidence = evaluate_project_contract(candidate)
        if not target_evidence["valid"] or target_evidence["schema_version"] != step["to"]:
            raise _contract_failure(f'migration target {step["to"]} contract is invalid', target_evidence)
        steps.append(_step_receipt(step, before, candidate))
        version = int(step["to"])

    candidate_evidence = evaluate_project_contract(candidate)
    if (
        not candidate_evidence["valid"]
        or candidate_evidence["schema_version"] != CURRENT_PROJECT_SCHEMA_VERSION
    ):
        raise _contract_failure("migration candidate contract is invalid", candidate_evidence)
    return {
        "candidate": candidate,
        "receipt": {
            "source_schema_version": source_evidence["schema_version"],
            "candidate_schema_version": CURRENT_PROJECT_SCHEMA_VERSION,
            "source_digest": source_evidence["digest"],
            "candidate_digest": candidate_evidence["digest"],
            "steps": steps,
            "warnings": [],
            "loss": {"dropped": [], "preserved": []},
        },
    }


def _json_lines() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    for line in sys.stdin:
        if not line.strip():
            continue
        request = json.loads(line)
        result = migrate_project_document(
            request["document"], dry_run=request.get("options", {}).get("dry_run", True)
        )
        response = {"id": request["id"], "result": result}
        print(json.dumps(response, ensure_ascii=False, separators=(",", ":")), flush=True)


if __name__ == "__main__" and "--json-lines" in sys.argv:
    _json_lines()
