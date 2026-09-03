"""The semantic model agrees across both runtimes (T3-01, T3-02, T3-12).

A contract rule that exists only in JavaScript is a rule the Companion does not
enforce, so this suite runs the same malformed shapes the Node sentinel does and
requires the same verdicts.
"""
from __future__ import annotations

import json
from pathlib import Path

from custom_components.glt_flow_card.project_contract import digest_canonical_json
from custom_components.glt_flow_card.semantic_model import (
    BOUNDS,
    SEMANTIC_LEVELS,
    same_dimension,
    semantic_path,
    validate_semantic_model,
)

CORPUS = json.loads(
    (Path(__file__).resolve().parent / "fixtures/semantic-parity-corpus.json").read_text("utf-8")
)
_PARAMETERS = CORPUS["parameters"]

REJECTED_SHAPES = (
    "self_cycle", "two_node_cycle", "long_cycle", "dangling_parent",
    "inverted_level", "multiple_parents", "over_depth", "over_breadth",
)


def _valid() -> dict:
    return {
        "nodes": [
            {"id": "site-a", "level": "site", "parent": None, "name": "Site A"},
            {"id": "bldg-1", "level": "building", "parent": "site-a", "name": "Building 1"},
            {"id": "floor-1", "level": "floor", "parent": "bldg-1", "name": "Floor 1"},
            {"id": "sys-heat", "level": "system", "parent": "floor-1", "name": "Heating"},
            {"id": "sub-primary", "level": "subsystem", "parent": "sys-heat", "name": "Primary"},
            {"id": "eq-hp", "level": "equipment", "parent": "sub-primary", "name": "Heat pump"},
            {"id": "dp-flow", "level": "datapoint", "parent": "eq-hp", "name": "Flow",
             "unit": "degC", "medium": "heating_flow", "direction": "input",
             "semantic_tags": ["measurement"]},
        ],
    }


def _mutate(shape: str) -> dict:
    if shape == "valid":
        return _valid()
    model = _valid()
    by_id = {node["id"]: node for node in model["nodes"]}
    if shape == "self_cycle":
        by_id["bldg-1"]["parent"] = "bldg-1"
    elif shape == "two_node_cycle":
        by_id["bldg-1"]["parent"] = "floor-1"
    elif shape == "long_cycle":
        by_id["site-a"]["parent"] = "eq-hp"
    elif shape == "dangling_parent":
        by_id["floor-1"]["parent"] = "does-not-exist"
    elif shape == "inverted_level":
        by_id["bldg-1"]["parent"] = "eq-hp"
    elif shape == "multiple_parents":
        model["nodes"].append(
            {"id": "floor-1", "level": "floor", "parent": "site-a", "name": "Duplicate"}
        )
    elif shape == "over_depth":
        for index in range(_PARAMETERS["over_depth_nodes"]):
            model["nodes"].append({
                "id": f"deep-{index}", "level": "subsystem",
                "parent": "sys-heat" if index == 0 else f"deep-{index - 1}",
                "name": f"Deep {index}",
            })
    elif shape == "over_breadth":
        for index in range(_PARAMETERS["over_breadth_nodes"]):
            model["nodes"].append({
                "id": f"wide-{index}", "level": "equipment",
                "parent": "sub-primary", "name": f"Wide {index}",
            })
    return model


def test_a_valid_model_is_accepted() -> None:
    assert validate_semantic_model(_valid()) == []


def test_every_malformed_shape_is_rejected_with_a_stable_code_and_path() -> None:
    for shape in REJECTED_SHAPES:
        errors = validate_semantic_model(_mutate(shape))
        assert errors, shape
        for error in errors:
            assert isinstance(error["code"], str) and error["code"]
            assert error["path"].startswith("/semantic_model/")


def test_unknown_vocabulary_members_are_rejected() -> None:
    for field, value in (("unit", "furlongs"), ("medium", "plasma"), ("direction", "sideways")):
        model = _valid()
        model["nodes"][-1][field] = value
        assert validate_semantic_model(model), field
    model = _valid()
    model["nodes"][-1]["semantic_tags"] = ["not-a-declared-tag"]
    assert validate_semantic_model(model)


def test_the_path_is_derived_from_parents() -> None:
    assert semantic_path(_valid(), "dp-flow") == [
        "site-a", "bldg-1", "floor-1", "sys-heat", "sub-primary", "eq-hp", "dp-flow",
    ]


def test_energy_and_power_are_not_the_same_dimension() -> None:
    """A prefix match would bind kW to a kWh slot; dimensions prevent that."""
    assert not same_dimension("kW", "kWh")
    assert same_dimension("degC", "degC")


def test_both_runtimes_return_the_same_verdicts() -> None:
    """The rule set is identical, or the Companion enforces something else.

    The Home Assistant lanes run a Python-only container with no `node` binary
    and no `src/` in the workspace, so this cannot shell out to JavaScript. It
    compares against the recorded JavaScript verdicts instead, and
    `test/semantic-parity-corpus.test.mjs` fails if those recordings are not
    exactly what the current `semantic-model.mjs` produces.

    The digest comparison is the part that matters. An earlier version of this
    test compared only error codes, and the two runtimes had quietly drifted to
    building *different* models -- 4096 wide nodes here, 2056 there -- while
    still agreeing on the verdict. Comparing the canonical bytes makes that
    impossible.
    """
    assert CORPUS["bounds"] == BOUNDS
    for recorded in CORPUS["shapes"]:
        model = _mutate(recorded["shape"])
        assert len(model["nodes"]) == recorded["node_count"], recorded["shape"]
        assert digest_canonical_json(model)["digest"] == recorded["model_digest"], (
            f"{recorded['shape']}: the Python model is not the model JavaScript validated"
        )
        codes = sorted(error["code"] for error in validate_semantic_model(model))
        assert codes == recorded["codes"], recorded["shape"]


def test_the_parity_corpus_covers_every_rejected_shape() -> None:
    """A shape dropped from the corpus must not silently stop being checked."""
    covered = {entry["shape"] for entry in CORPUS["shapes"]}
    assert covered == {"valid", *REJECTED_SHAPES}


def test_levels_match_the_shared_vocabulary() -> None:
    assert SEMANTIC_LEVELS[0] == "site"
    assert SEMANTIC_LEVELS[-1] == "datapoint"
