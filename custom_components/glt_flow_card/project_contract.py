"""Raw-first project validation with cross-runtime canonical evidence."""

from __future__ import annotations

import base64
import hashlib
import json
import math
import re
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

_ROOT = Path(__file__).resolve().parent
_SCHEMA_PATHS = (
    _ROOT / "schemas" / "project" / "0.schema.json",
    _ROOT / "schemas" / "project" / "1.schema.json",
    _ROOT / "schemas" / "project" / "2.schema.json",
    _ROOT / "schemas" / "project" / "3.schema.json",
    _ROOT / "schemas" / "project" / "4.schema.json",
    _ROOT / "schemas" / "bundle-manifest.schema.json",
)
_LIMITS = json.loads((_ROOT / "schemas" / "limits.json").read_text(encoding="utf-8"))
# Every path but the last is a project schema version, in ascending order; the
# last is the bundle manifest. Deriving the split keeps adding a schema version
# from silently shifting an index nobody remembered to update.
_PROJECT_SCHEMAS = tuple(
    json.loads(path.read_text(encoding="utf-8")) for path in _SCHEMA_PATHS[:-1]
)
_ALL_SCHEMAS = _PROJECT_SCHEMAS + (
    json.loads(_SCHEMA_PATHS[-1].read_text(encoding="utf-8")),
)
_REGISTRY = Registry()
for _schema in _ALL_SCHEMAS:
    Draft202012Validator.check_schema(_schema)
    _REGISTRY = _REGISTRY.with_resource(
        _schema["$id"],
        Resource.from_contents(_schema),
    )
_PROJECT_VALIDATORS = tuple(
    Draft202012Validator(schema, registry=_REGISTRY) for schema in _PROJECT_SCHEMAS
)

_ID_COLLECTIONS = (
    "alarms",
    "assets",
    "datapoints",
    "equipment",
    "groups",
    "layers",
    "paths",
    "plugins",
    "profiles",
    "remote_sites",
    "schedules",
    "sites",
    "views",
    "work_orders",
)
_REFERENCE_EDGES = (
    ("paths", ("from_equipment", "to_equipment"), "equipment"),
    ("equipment", ("profile",), "profiles"),
    ("equipment", ("asset_id",), "assets"),
    ("datapoints", ("layer",), "layers"),
)
_REQUIRED_PROPERTY = re.compile(r"^'([^']+)' is a required property$")


def _escape_pointer(value: object) -> str:
    return str(value).replace("~", "~0").replace("/", "~1")


def _child_pointer(path: str, key: object) -> str:
    return f"{path}/{_escape_pointer(key)}"


def _pointer(parts: object) -> str:
    path = "".join(f"/{_escape_pointer(part)}" for part in parts)
    return path or "/"


def _stable_params(value: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value[key] for key in sorted(value, key=_utf16_sort_key)}


def _issue(code: str, path: str, params: Mapping[str, Any] | None = None) -> dict[str, Any]:
    return {
        "code": code,
        "path": path or "/",
        "params": _stable_params(params or {}),
    }


def _params_json(value: Mapping[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _utf16_sort_key(value: str) -> bytes:
    return value.encode("utf-16be", errors="surrogatepass")


def _issue_key(value: Mapping[str, Any]) -> tuple[bytes, bytes, bytes]:
    return tuple(
        _utf16_sort_key(part)
        for part in (value["path"], value["code"], _params_json(value["params"]))
    )


def _bounded_issues(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    errors.sort(key=_issue_key)
    limit = _LIMITS["json"]["max_errors"]
    if len(errors) <= limit:
        return errors
    sentinel = _issue(
        "contract.error_limit",
        "/errors",
        {"actual": len(errors), "limit": limit},
    )
    return sorted(errors[: limit - 1] + [sentinel], key=_issue_key)


def _non_json_error(params: Mapping[str, Any] | None = None) -> dict[str, Any]:
    return _issue("contract.type", "/", params or {"expected": "json"})


def _canonical_number(value: int | float) -> str:
    if isinstance(value, int):
        if abs(value) <= 9_007_199_254_740_991:
            return str(value)
        try:
            value = float(value)
        except OverflowError as error:
            raise TypeError("non-finite numbers are not JSON values") from error
    if not math.isfinite(value):
        raise TypeError("non-finite numbers are not JSON values")
    if value == 0:
        return "0"
    rendered = repr(value).lower()
    if "e" not in rendered:
        return rendered[:-2] if rendered.endswith(".0") else rendered
    mantissa, exponent = rendered.split("e", 1)
    exponent_value = int(exponent)
    if 1e-6 <= abs(value) < 1e21:
        negative = mantissa.startswith("-")
        digits = mantissa.lstrip("-").replace(".", "")
        decimal_index = (mantissa.lstrip("-").find(".") if "." in mantissa else len(digits)) + exponent_value
        if decimal_index <= 0:
            expanded = f"0.{('0' * -decimal_index)}{digits}"
        elif decimal_index >= len(digits):
            expanded = f"{digits}{'0' * (decimal_index - len(digits))}"
        else:
            expanded = f"{digits[:decimal_index]}.{digits[decimal_index:]}"
        return f"-{expanded}" if negative else expanded
    sign = "+" if exponent_value >= 0 else "-"
    return f"{mantissa}e{sign}{abs(exponent_value)}"


def _canonical_value(value: Any, active: set[int]) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return _canonical_number(value)
    if type(value) not in (dict, list):
        raise TypeError("value is not JSON-compatible")
    identity = id(value)
    if identity in active:
        raise TypeError("cyclic values are not JSON-compatible")
    active.add(identity)
    try:
        if isinstance(value, list):
            return f"[{','.join(_canonical_value(entry, active) for entry in value)}]"
        if any(not isinstance(key, str) for key in value):
            raise TypeError("JSON object keys must be strings")
        entries = (
            f"{json.dumps(key, ensure_ascii=False)}:{_canonical_value(value[key], active)}"
            for key in sorted(value, key=_utf16_sort_key)
        )
        return f"{{{','.join(entries)}}}"
    finally:
        active.remove(identity)


def canonicalize_json(value: Any) -> str:
    """Return sorted-key UTF-8 canonical JSON while preserving array order."""

    return _canonical_value(value, set())


def digest_canonical_json(value: Any) -> dict[str, str]:
    """Return canonical JSON and its lowercase SHA-256 digest."""

    canonical = canonicalize_json(value)
    return {
        "canonical": canonical,
        "digest": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
    }


def _parse_integer(value: str) -> int | float:
    parsed = int(value)
    if abs(parsed) <= 9_007_199_254_740_991:
        return parsed
    return float(value)


def _reject_constant(value: str) -> None:
    raise ValueError(f"non-JSON numeric constant: {value}")


def _empty_metrics(byte_count: int | None) -> dict[str, int | None]:
    return {
        "bytes": byte_count,
        "depth": None,
        "nodes": None,
        "max_collection_size": None,
        "max_string_bytes": None,
    }


def _raw_document(raw_input: Any) -> dict[str, Any]:
    if isinstance(raw_input, str):
        raw_bytes = raw_input.encode("utf-8")
    elif isinstance(raw_input, (bytes, bytearray, memoryview)):
        raw_bytes = bytes(raw_input)
    else:
        return {"bytes": None, "document": raw_input}
    byte_count = len(raw_bytes)
    maximum = _LIMITS["json"]["max_bytes"]
    if byte_count > maximum:
        return {
            "error": _issue(
                "contract.json_bytes",
                "/",
                {"actual": byte_count, "limit": maximum},
            ),
            "metrics": _empty_metrics(byte_count),
        }
    try:
        return {
            "bytes": byte_count,
            "document": json.loads(
                raw_bytes.decode("utf-8"),
                parse_constant=_reject_constant,
                parse_int=_parse_integer,
            ),
        }
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError):
        return {
            "error": _non_json_error(),
            "metrics": _empty_metrics(byte_count),
        }


def _preflight_document(document: Any, raw_bytes: int | None) -> dict[str, Any]:
    maximum = _LIMITS["json"]
    metrics: dict[str, int | None] = {
        "bytes": raw_bytes,
        "depth": 0,
        "nodes": 0,
        "max_collection_size": 0,
        "max_string_bytes": 0,
    }
    active: set[int] = set()
    stack: list[tuple[Any, ...]] = [("value", document, "", 1)]

    while stack:
        entry = stack.pop()
        if entry[0] == "exit":
            active.remove(entry[1])
            continue
        _, value, path, depth = entry
        metrics["nodes"] += 1
        metrics["depth"] = max(metrics["depth"], depth)
        if metrics["nodes"] > maximum["max_nodes"]:
            return {
                "error": _issue(
                    "contract.nodes",
                    "/",
                    {"actual": metrics["nodes"], "limit": maximum["max_nodes"]},
                ),
                "metrics": metrics,
            }
        if depth > maximum["max_depth"]:
            return {
                "error": _issue(
                    "contract.depth",
                    "/",
                    {"actual": depth, "limit": maximum["max_depth"]},
                ),
                "metrics": metrics,
            }
        if isinstance(value, str):
            try:
                string_bytes = len(value.encode("utf-8"))
            except UnicodeEncodeError:
                return {
                    "error": _issue(
                        "contract.type",
                        path or "/",
                        {"expected": "unicode_scalar_sequence"},
                    ),
                    "metrics": metrics,
                }
            metrics["max_string_bytes"] = max(metrics["max_string_bytes"], string_bytes)
            if string_bytes > maximum["max_string_bytes"]:
                return {
                    "error": _issue(
                        "contract.string_bytes",
                        path or "/",
                        {"actual": string_bytes, "limit": maximum["max_string_bytes"]},
                    ),
                    "metrics": metrics,
                }
            key = path.rsplit("/", 1)[-1]
            if key == "id" and len(value) > maximum["max_id_chars"]:
                return {
                    "error": _issue(
                        "contract.id_length",
                        path,
                        {"actual": len(value), "limit": maximum["max_id_chars"]},
                    ),
                    "metrics": metrics,
                }
            if key == "path" and len(value) > maximum["max_path_chars"]:
                return {
                    "error": _issue(
                        "contract.path_length",
                        path,
                        {"actual": len(value), "limit": maximum["max_path_chars"]},
                    ),
                    "metrics": metrics,
                }
            continue
        if value is None or isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            if isinstance(value, float) and not math.isfinite(value):
                return {"error": _non_json_error({"expected": "finite_number"}), "metrics": metrics}
            continue
        if type(value) not in (dict, list):
            return {"error": _non_json_error(), "metrics": metrics}
        if isinstance(value, dict) and any(not isinstance(key, str) for key in value):
            return {"error": _non_json_error(), "metrics": metrics}
        if isinstance(value, dict):
            try:
                for key in value:
                    key.encode("utf-8")
            except UnicodeEncodeError:
                return {
                    "error": _non_json_error(
                        {"expected": "unicode_scalar_sequence"}
                    ),
                    "metrics": metrics,
                }
        identity = id(value)
        if identity in active:
            return {"error": _non_json_error({"expected": "acyclic_json"}), "metrics": metrics}
        active.add(identity)
        stack.append(("exit", identity))
        entries = list(enumerate(value)) if isinstance(value, list) else list(value.items())
        metrics["max_collection_size"] = max(metrics["max_collection_size"], len(entries))
        for key, child in reversed(entries):
            stack.append(("value", child, _child_pointer(path, key), depth + 1))

    try:
        canonical = canonicalize_json(document)
        canonical_bytes = len(canonical.encode("utf-8"))
        if metrics["bytes"] is None:
            metrics["bytes"] = canonical_bytes
        if metrics["bytes"] > maximum["max_bytes"]:
            return {
                "error": _issue(
                    "contract.json_bytes",
                    "/",
                    {"actual": metrics["bytes"], "limit": maximum["max_bytes"]},
                ),
                "metrics": metrics,
            }
        return {"canonical": canonical, "metrics": metrics}
    except (TypeError, UnicodeEncodeError):
        return {"error": _non_json_error(), "metrics": metrics}


def _declared_version(document: Any) -> dict[str, Any]:
    if not isinstance(document, dict):
        return {"version": 0}
    if "schema_version" not in document:
        return {"version": 0}
    version = document["schema_version"]
    if isinstance(version, bool) or not isinstance(version, (int, float)) or int(version) != version:
        return {"error": _issue("contract.type", "/schema_version", {"expected": "integer"})}
    version = int(version)
    if version < 0 or version >= len(_PROJECT_VALIDATORS):
        return {
            "error": _issue(
                "contract.schema_version",
                "/schema_version",
                {"actual": version, "allowed": [0, 1, 2]},
            )
        }
    return {"version": version}


def _map_schema_error(error: Any) -> dict[str, Any]:
    path = _pointer(error.absolute_path)
    if error.validator == "required":
        match = _REQUIRED_PROPERTY.match(error.message)
        property_name = match.group(1) if match else "unknown"
        path = _child_pointer("" if path == "/" else path, property_name)
        return _issue("contract.required", path, {"property": property_name})
    if error.validator == "type":
        return _issue("contract.type", path, {"expected": error.validator_value})
    if error.validator == "const":
        code = "contract.schema_version" if path == "/schema_version" else "contract.type"
        return _issue(code, path, {"expected": error.validator_value})
    if error.validator == "pattern":
        code = "contract.id_pattern" if path.endswith("/id") else "contract.type"
        return _issue(code, path, {"pattern": error.validator_value})
    if error.validator == "maxLength":
        code = "contract.id_length" if path.endswith("/id") else (
            "contract.path_length" if path.endswith("/path") else "contract.string_bytes"
        )
        return _issue(code, path, {"limit": error.validator_value})
    return _issue("contract.type", path, {"keyword": error.validator or "false_schema"})


def _reference_issues(document: Any) -> list[dict[str, Any]]:
    if not isinstance(document, dict):
        return []
    errors: list[dict[str, Any]] = []
    identities: dict[str, set[str]] = {}
    for collection in _ID_COLLECTIONS:
        entries = document.get(collection)
        entries = entries if isinstance(entries, list) else []
        known: set[str] = set()
        identities[collection] = known
        for index, entry in enumerate(entries):
            identity = entry.get("id") if isinstance(entry, dict) else None
            if not isinstance(identity, str):
                continue
            if identity in known:
                errors.append(
                    _issue(
                        "contract.duplicate_id",
                        f"/{collection}/{index}/id",
                        {"collection": collection, "id": identity},
                    )
                )
            else:
                known.add(identity)
    for collection, fields, target in _REFERENCE_EDGES:
        entries = document.get(collection)
        entries = entries if isinstance(entries, list) else []
        targets = identities.get(target, set())
        for index, entry in enumerate(entries):
            if not isinstance(entry, dict):
                continue
            for field in fields:
                identity = entry.get(field)
                if isinstance(identity, str) and identity not in targets:
                    errors.append(
                        _issue(
                            "contract.dangling_reference",
                            f"/{collection}/{index}/{field}",
                            {"collection": target, "id": identity},
                        )
                    )
    return errors


def _result(
    *,
    limits: Mapping[str, Any],
    canonical: str | None = None,
    errors: list[dict[str, Any]] | None = None,
    schema_version: int | None = None,
) -> dict[str, Any]:
    normalized = _bounded_issues(errors or [])
    return {
        "valid": not normalized,
        "errors": normalized,
        "schema_version": schema_version,
        "canonical": canonical,
        "digest": hashlib.sha256(canonical.encode("utf-8")).hexdigest() if canonical is not None else None,
        "limits": dict(limits),
    }


def evaluate_project_contract(raw_input: Any) -> dict[str, Any]:
    """Validate untrusted raw input before any migration, defaults, or normalization."""

    raw = _raw_document(raw_input)
    if "error" in raw:
        return _result(limits=raw["metrics"], errors=[raw["error"]])
    preflight = _preflight_document(raw["document"], raw["bytes"])
    if "error" in preflight:
        return _result(limits=preflight["metrics"], errors=[preflight["error"]])
    declared = _declared_version(raw["document"])
    if "error" in declared:
        return _result(
            canonical=preflight["canonical"],
            errors=[declared["error"]],
            limits=preflight["metrics"],
        )
    version = declared["version"]
    schema_errors = list(_PROJECT_VALIDATORS[version].iter_errors(raw["document"]))
    errors = [_map_schema_error(error) for error in schema_errors]
    if not errors:
        errors = _reference_issues(raw["document"])
    return _result(
        canonical=preflight["canonical"],
        errors=errors,
        limits=preflight["metrics"],
        schema_version=version,
    )


def _json_lines() -> None:
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    for line in sys.stdin:
        if not line.strip():
            continue
        request = json.loads(line)
        raw = base64.b64decode(request["raw_base64"], validate=True)
        response = {
            "id": request["id"],
            "evidence": evaluate_project_contract(raw),
        }
        print(json.dumps(response, ensure_ascii=False, separators=(",", ":")), flush=True)


if __name__ == "__main__" and "--json-lines" in sys.argv:
    _json_lines()
