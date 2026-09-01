"""Behavioral parity tests for the raw-first Python project contract."""

from __future__ import annotations

import copy
import hashlib
import json

import pytest
from referencing.exceptions import NoSuchResource

from custom_components.glt_flow_card import project_contract
from custom_components.glt_flow_card.project_contract import (
    canonicalize_json,
    evaluate_project_contract,
)

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


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


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (9_007_199_254_740_991, "9007199254740991"),
        (9_007_199_254_740_992, "9007199254740992"),
        (9_007_199_254_740_993, "9007199254740992"),
        (1.0000000000000002e20, "100000000000000020000"),
        (1e21, "1e+21"),
        (1e-6, "0.000001"),
        (5e-324, "5e-324"),
    ],
)
def test_canonical_numbers_match_ecmascript_number_to_string(
    value: int | float,
    expected: str,
) -> None:
    assert canonicalize_json({"number": value}) == f'{{"number":{expected}}}'


def test_valid_input_is_not_mutated_and_emits_serializable_evidence() -> None:
    value = _valid_project()
    original = copy.deepcopy(value)

    result = evaluate_project_contract(value)

    assert result["valid"] is True
    assert result["errors"] == []
    assert result["schema_version"] == 2
    assert value == original
    json.dumps(result, ensure_ascii=False)


def test_schema_registry_fails_closed_without_remote_retrieval() -> None:
    with pytest.raises(NoSuchResource):
        project_contract._REGISTRY.get_or_retrieve("https://schemas.example.invalid/remote.json")


@pytest.mark.parametrize(
    ("raw", "code", "actual"),
    [
        (lambda: b'"' + (b"x" * 5_242_879) + b'"', "contract.json_bytes", 5_242_881),
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


@pytest.mark.parametrize("escaped", [r"\ud800", r"\udc00"])
def test_raw_lone_surrogates_fail_closed_with_stable_unicode_evidence(
    escaped: str,
) -> None:
    raw = (
        '{"type":"custom:glt-flow-card","schema_version":2,'
        '"project":{"id":"unicode","name":"Unicode","revision":0},'
        f'"extensions":{{"text":"{escaped}"}}}}'
    ).encode()

    result = evaluate_project_contract(raw)

    assert result["valid"] is False
    assert result["errors"] == [{
        "code": "contract.type",
        "path": "/extensions/text",
        "params": {"expected": "unicode_scalar_sequence"},
    }]


def test_raw_valid_surrogate_pair_is_accepted() -> None:
    raw = (
        '{"type":"custom:glt-flow-card","schema_version":2,'
        '"project":{"id":"unicode","name":"Unicode","revision":0},'
        '"extensions":{"text":"\\ud83d\\ude00"}}'
    ).encode()

    result = evaluate_project_contract(raw)

    assert result["valid"] is True
    assert "😀" in result["canonical"]
