"""The semantic model agrees across both runtimes (T3-01, T3-02, T3-12).

A contract rule that exists only in JavaScript is a rule the Companion does not
enforce, so this suite runs the same malformed shapes the Node sentinel does and
requires the same verdicts.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from custom_components.glt_flow_card.semantic_model import (
    BOUNDS,
    SEMANTIC_LEVELS,
    same_dimension,
    semantic_path,
    validate_semantic_model,
)

ROOT = Path(__file__).resolve().parents[3]

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
        model["nodes"].append({"id": "floor-1", "level": "floor", "parent": "site-a", "name": "Dup"})
    elif shape == "over_depth":
        for index in range(64):
            model["nodes"].append({
                "id": f"deep-{index}", "level": "subsystem",
                "parent": "sys-heat" if index == 0 else f"deep-{index - 1}",
                "name": f"Deep {index}",
            })
    elif shape == "over_breadth":
        for index in range(BOUNDS["max_children"] + 8):
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
    """The rule set is identical, or the Companion enforces something else."""
    # The models go through a file: the over-breadth shape alone is thousands of
    # nodes, and an argument list has a limit a fixture should not have to know.
    script = (
        "import('node:fs/promises').then(async (fs) => {"
        "  const m = await import('file://' + process.argv[1]);"
        "  const shapes = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));"
        "  const out = shapes.map((model) => m.validateSemanticModel(model).map((e) => e.code).sort());"
        "  console.log(JSON.stringify(out));"
        "});"
    )
    models = [_valid()] + [_mutate(shape) for shape in REJECTED_SHAPES]
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(models, handle)
        payload = handle.name
    result = subprocess.run(
        ["node", "-e", script, str(ROOT / "src/v100/semantic-model.mjs"), payload],
        capture_output=True, text=True, cwd=ROOT, check=False,
    )
    Path(payload).unlink(missing_ok=True)
    assert result.returncode == 0, result.stderr
    javascript = json.loads(result.stdout)
    python = [sorted(error["code"] for error in validate_semantic_model(model)) for model in models]
    assert javascript == python


def test_levels_match_the_shared_vocabulary() -> None:
    assert SEMANTIC_LEVELS[0] == "site"
    assert SEMANTIC_LEVELS[-1] == "datapoint"
