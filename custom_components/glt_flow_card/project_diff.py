"""Policy-driven semantic project diff and dependency closure."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Mapping

from .project_contract import digest_canonical_json, evaluate_project_contract

_ROOT = Path(__file__).resolve().parents[2]
DIFF_POLICY = json.loads((_ROOT / "schemas" / "diff-policy.json").read_text(encoding="utf-8"))
_IDENTITY_COLLECTIONS = set(DIFF_POLICY["order"]["identity_keyed_collections"])
_MOVE_FIELDS = set(DIFF_POLICY["category_rules"]["move_fields"])
_MISSING = object()


def _utf16_sort_key(value: str) -> bytes:
    return value.encode("utf-16-be", errors="surrogatepass")


def _clone(value: Any) -> Any:
    return json.loads(digest_canonical_json(value)["canonical"])


def _pointer_part(value: Any) -> str:
    return str(value).replace("~", "~0").replace("/", "~1")


def _valid_document(raw_input: Any, label: str) -> tuple[dict[str, Any], dict[str, Any]]:
    evidence = evaluate_project_contract(raw_input)
    if not evidence["valid"]:
        details = ", ".join(f'{error["code"]}@{error["path"]}' for error in evidence["errors"])
        raise ValueError(f"{label} project contract is invalid: {details}")
    return json.loads(evidence["canonical"]), evidence


def _value_hash(value: Any, present: bool) -> str | None:
    return digest_canonical_json(value)["digest"] if present else None


def _category_for(parts: list[str]) -> str:
    last = parts[-1] if parts else ""
    if any(part in _MOVE_FIELDS for part in parts):
        return "move"
    if (
        last in {"entity", "entity_id", "state_entity"}
        or (parts and parts[0] == "bindings")
        or (len(parts) >= 3 and parts[0] == "fields" and last == "entity")
        or (len(parts) >= 3 and parts[0] == "slots" and last == "entity_id")
    ):
        return "binding"
    return DIFF_POLICY["category_rules"]["fallback_category"]


def _impact_for(category: str, path: str) -> dict[str, Any]:
    if path == "/security" or path.startswith("/security/") or path == "/permissions" or path.startswith(
        "/permissions/"
    ) or path == "/plugins" or path.startswith("/plugins/"):
        return {"severity": "critical", "areas": ["security"]}
    areas = {
        "add": ["none"],
        "remove": ["operational", "referential"],
        "move": ["visual"],
        "binding": ["binding", "operational"],
        "config": ["operational"],
    }[category]
    return {
        "severity": DIFF_POLICY["impact"]["default_by_category"][category],
        "areas": areas,
    }


def _operation(
    category: str,
    path: str,
    collection: str | None,
    object_id: str | None,
    relative_parts: list[str],
    before: Any,
    before_present: bool,
    after: Any,
    after_present: bool,
) -> dict[str, Any]:
    return {
        "id": f"{category}:{path}",
        "category": category,
        "path": path,
        "collection": collection,
        "object_id": object_id,
        "field": f'/{"/".join(_pointer_part(part) for part in relative_parts)}' if relative_parts else "",
        "before_hash": _value_hash(before, before_present),
        "after_hash": _value_hash(after, after_present),
        "before": _clone(before) if before_present else None,
        "after": _clone(after) if after_present else None,
        "impact": _impact_for(category, path),
        "requires": [],
    }


def _same_primitive(before: Any, after: Any) -> bool:
    if isinstance(before, bool) or isinstance(after, bool):
        return type(before) is type(after) and before == after
    if isinstance(before, (int, float)) and isinstance(after, (int, float)):
        return before == after
    return type(before) is type(after) and before == after


def _compare_value(
    operations: list[dict[str, Any]],
    before: Any,
    after: Any,
    *,
    path: str,
    collection: str | None,
    object_id: str | None,
    relative_parts: list[str],
) -> None:
    before_present = before is not _MISSING
    after_present = after is not _MISSING
    if before_present and after_present and not isinstance(before, (dict, list)) and not isinstance(after, (dict, list)):
        if _same_primitive(before, after):
            return
    if not before_present or not after_present:
        category = ("remove" if before_present else "add") if not relative_parts else _category_for(relative_parts)
        operations.append(
            _operation(category, path, collection, object_id, relative_parts, before, before_present, after, after_present)
        )
        return
    before_container = isinstance(before, (dict, list))
    after_container = isinstance(after, (dict, list))
    if type(before) is not type(after) or not before_container:
        operations.append(_operation(
            _category_for(relative_parts), path, collection, object_id, relative_parts, before, True, after, True
        ))
        return
    if isinstance(before, list):
        for index in range(max(len(before), len(after))):
            _compare_value(
                operations,
                before[index] if index < len(before) else _MISSING,
                after[index] if index < len(after) else _MISSING,
                path=f"{path}/{index}",
                collection=collection,
                object_id=object_id,
                relative_parts=[*relative_parts, str(index)],
            )
        return
    keys = sorted(set(before) | set(after), key=_utf16_sort_key)
    for key in keys:
        _compare_value(
            operations,
            before.get(key, _MISSING),
            after.get(key, _MISSING),
            path=f"{path}/{_pointer_part(key)}",
            collection=collection,
            object_id=object_id,
            relative_parts=[*relative_parts, key],
        )


def _identity_map(document: Mapping[str, Any], collection: str) -> dict[str, dict[str, Any]]:
    identity_field = DIFF_POLICY["identity_fields"][collection]
    return {entry[identity_field]: entry for entry in document.get(collection, [])}


def _add_dependencies(
    operations: list[dict[str, Any]], before: Mapping[str, Any], after: Mapping[str, Any]
) -> None:
    operation_ids = {operation["id"] for operation in operations}
    before_maps = {collection: _identity_map(before, collection) for collection in DIFF_POLICY["identity_fields"]}
    after_maps = {collection: _identity_map(after, collection) for collection in DIFF_POLICY["identity_fields"]}
    for operation in operations:
        collection = operation["collection"]
        object_id = operation["object_id"]
        if not collection or not object_id:
            continue
        references = [
            reference for reference in DIFF_POLICY["dependencies"]["references"] if reference["from"] == collection
        ]
        source_maps = before_maps if operation["category"] == "remove" else after_maps
        source = source_maps[collection].get(object_id)
        if source is None:
            continue
        requirements: dict[str, dict[str, str]] = {}
        for reference in references:
            for field in reference["fields"]:
                target_id = source.get(field)
                if not isinstance(target_id, str):
                    continue
                target_path = f'/{reference["to"]}/{_pointer_part(target_id)}'
                prefix = "remove" if operation["category"] == "remove" else "add"
                target_operation = f"{prefix}:{target_path}"
                if target_operation in operation_ids:
                    requirements[target_operation] = {
                        "operation_id": target_operation,
                        "reason": f'reference:{reference["from"]}.{field}->{reference["to"]}',
                    }
        operation["requires"] = sorted(requirements.values(), key=lambda value: _utf16_sort_key(value["operation_id"]))


def compute_project_diff(before_input: Any, after_input: Any) -> dict[str, Any]:
    """Return deterministic semantic operations for two validated projects."""

    before, before_evidence = _valid_document(before_input, "source")
    after, after_evidence = _valid_document(after_input, "candidate")
    operations: list[dict[str, Any]] = []
    ordering_noise: list[str] = []
    for key in sorted(set(before) | set(after), key=_utf16_sort_key):
        if key in _IDENTITY_COLLECTIONS and isinstance(before.get(key), list) and isinstance(after.get(key), list):
            before_map = _identity_map(before, key)
            after_map = _identity_map(after, key)
            before_ids = list(before_map)
            after_ids = list(after_map)
            if len(before_ids) == len(after_ids) and set(before_ids) == set(after_ids) and before_ids != after_ids:
                ordering_noise.append(f"/{_pointer_part(key)}")
            for object_id in sorted(set(before_ids) | set(after_ids), key=_utf16_sort_key):
                _compare_value(
                    operations,
                    before_map.get(object_id, _MISSING),
                    after_map.get(object_id, _MISSING),
                    path=f"/{_pointer_part(key)}/{_pointer_part(object_id)}",
                    collection=key,
                    object_id=object_id,
                    relative_parts=[],
                )
            continue
        _compare_value(
            operations,
            before.get(key, _MISSING),
            after.get(key, _MISSING),
            path=f"/{_pointer_part(key)}",
            collection=None,
            object_id=None,
            relative_parts=[key],
        )
    operations.sort(key=lambda operation: _utf16_sort_key(operation["id"]))
    _add_dependencies(operations, before, after)
    return {
        "policy_version": DIFF_POLICY["policy_version"],
        "source_digest": before_evidence["digest"],
        "candidate_digest": after_evidence["digest"],
        "operations": operations,
        "ordering_noise": sorted(ordering_noise, key=_utf16_sort_key),
    }


def expand_diff_selection(diff_result: Mapping[str, Any], selected_operation_ids: list[str]) -> dict[str, Any]:
    """Expand selected operations to deterministic transitive policy dependencies."""

    operations = {operation["id"]: operation for operation in diff_result.get("operations", [])}
    requested = sorted(set(selected_operation_ids or []), key=_utf16_sort_key)
    for operation_id in requested:
        if operation_id not in operations:
            raise ValueError(f"unknown selected operation {operation_id}")
    state: dict[str, str] = {}
    included: set[str] = set()
    added: dict[str, dict[str, str]] = {}

    def visit(operation_id: str, required_by: str | None = None, reason: str | None = None, chain=None) -> None:
        active_chain = list(chain or [])
        if operation_id not in operations:
            raise ValueError(f"missing dependency operation {operation_id}")
        if state.get(operation_id) == "visiting":
            raise ValueError(f'cyclic diff dependency: {" -> ".join([*active_chain, operation_id])}')
        if state.get(operation_id) == "done":
            return
        state[operation_id] = "visiting"
        if required_by is not None and operation_id not in requested and operation_id not in added:
            added[operation_id] = {
                "operation_id": operation_id,
                "required_by": required_by,
                "reason": reason or "",
            }
        requirements = sorted(
            operations[operation_id].get("requires", []), key=lambda value: _utf16_sort_key(value["operation_id"])
        )
        for requirement in requirements:
            visit(requirement["operation_id"], operation_id, requirement["reason"], [*active_chain, operation_id])
        state[operation_id] = "done"
        included.add(operation_id)

    for operation_id in requested:
        visit(operation_id)
    return {
        "selected": sorted(included, key=_utf16_sort_key),
        "requested": requested,
        "added": sorted(added.values(), key=lambda value: _utf16_sort_key(value["operation_id"])),
    }


def _json_lines() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    for line in sys.stdin:
        if not line.strip():
            continue
        request = json.loads(line)
        response = {
            "id": request["id"],
            "result": compute_project_diff(request["before"], request["after"]),
        }
        print(json.dumps(response, ensure_ascii=False, separators=(",", ":")), flush=True)


if __name__ == "__main__" and "--json-lines" in sys.argv:
    _json_lines()
