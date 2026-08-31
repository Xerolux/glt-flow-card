"""Behavioral parity tests for the raw-first Python project contract."""

from __future__ import annotations

import copy
import hashlib
import json

import pytest

from custom_components.glt_flow_card.project_contract import (
    canonicalize_json,
    evaluate_project_contract,
)


def _nested_array(depth: int) -> object:
    value: object = None
    for _ in range(1, depth):
        value = [value]
    return value


def _valid_project() -> dict[str, object]:
    return {
        "type": "custom:glt-flow-card",
        "schema_version": 2,
        "project": {"id": "python-fixture", "name": "Python Fixture", "revision": 0},
        "equipment": [{"id": "pump-1", "type": "pump"}],
    }


def test_canonical_json_matches_javascript_sorted_key_contract() -> None:
    value = {
        "z": 1,
        "nested": {"y": "ü", "x": -0.0},
        "ordered": [{"b": True, "a": False}, 2],
    }
    canonical = canonicalize_json(value)

    assert canonical == '{"nested":{"x":0,"y":"ü"},"ordered":[{"a":false,"b":true},2],"z":1}'
    result = evaluate_project_contract(value)
    assert result["digest"] == hashlib.sha256(canonical.encode()).hexdigest()


def test_valid_input_is_not_mutated_and_emits_serializable_evidence() -> None:
    value = _valid_project()
    original = copy.deepcopy(value)

    result = evaluate_project_contract(value)

    assert result["valid"] is True
    assert result["errors"] == []
    assert result["schema_version"] == 2
    assert value == original
    json.dumps(result, ensure_ascii=False)


@pytest.mark.parametrize(
    ("raw", "code", "actual"),
    [
        (b'"' + (b"x" * 5_242_879) + b'"', "contract.json_bytes", 5_242_881),
        (lambda: json.dumps(_nested_array(65)).encode(), "contract.depth", 65),
    ],
)
def test_rejects_raw_oversized_and_deep_documents_before_schema(
    raw: bytes | object,
    code: str,
    actual: int,
) -> None:
    if callable(raw):
        raw = raw()
    result = evaluate_project_contract(raw)

    assert result["valid"] is False
    assert result["errors"] == [{
        "code": code,
        "path": "/",
        "params": {"actual": actual, "limit": 5_242_880 if "bytes" in code else 64},
    }]
    assert result["schema_version"] is None
    assert result["canonical"] is None
    assert result["digest"] is None


def test_stable_errors_sort_and_cap_identically() -> None:
    value = _valid_project()
    value["equipment"] = [{"type": "pump"} for _ in range(101)]

    result = evaluate_project_contract(value)

    assert len(result["errors"]) == 100
    assert result["errors"] == sorted(
        result["errors"],
        key=lambda error: (error["path"], error["code"], json.dumps(error["params"], separators=(",", ":"))),
    )
    assert sum(error["code"] == "contract.error_limit" for error in result["errors"]) == 1


def test_schema_and_reference_errors_use_shared_codes_and_pointers() -> None:
    missing = _valid_project()
    missing["equipment"] = [{"type": "pump"}]
    duplicate = _valid_project()
    duplicate["equipment"] = [
        {"id": "pump-1", "type": "pump"},
        {"id": "pump-1", "type": "pump"},
    ]

    assert evaluate_project_contract(missing)["errors"][0] == {
        "code": "contract.required",
        "path": "/equipment/0/id",
        "params": {"property": "id"},
    }
    assert evaluate_project_contract(duplicate)["errors"][0] == {
        "code": "contract.duplicate_id",
        "path": "/equipment/1/id",
        "params": {"collection": "equipment", "id": "pump-1"},
    }


@pytest.mark.parametrize("value", [float("nan"), {"value": float("inf")}, {1: "not-json"}])
def test_non_json_values_fail_closed(value: object) -> None:
    result = evaluate_project_contract(value)
    assert result["valid"] is False
    assert result["errors"][0]["code"] == "contract.type"
