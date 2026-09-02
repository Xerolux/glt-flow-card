"""Pure sequential project migrations with canonical receipts."""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections.abc import Callable, Mapping
from typing import Any

from .project_contract import digest_canonical_json, evaluate_project_contract

CURRENT_PROJECT_SCHEMA_VERSION = 3


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


PROJECT_MIGRATIONS: dict[int, dict[str, int | Callable[[Mapping[str, Any]], dict[str, Any]]]] = {
    0: {"from": 0, "to": 1, "migrate": _step_zero_to_one},
    1: {"from": 1, "to": 2, "migrate": _step_one_to_two},
    2: {"from": 2, "to": 3, "migrate": _step_two_to_three},
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
