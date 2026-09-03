"""A state change costs what it should (T6-06).

D3: line 1941 subscribes to the bare `state_changed` bus event with no entity
filter, and the handler then iterates every project × every alarm and filters
afterwards. The cost is O(state changes × projects × alarms) for every state
change in the whole Home Assistant instance, not just this card's.

The fix is an index, and an index is a cache. A cache that misses a rebuild is a
**worse** defect than the scan it replaces: the scan was slow, the stale cache is
silently wrong. So the index is built by exactly one function, every mutation
path calls it, and the result is compared against an independent full rescan --
never against a second call to the builder, which would prove determinism rather
than correctness.
"""
from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .alarm_factory import build_corpus
from .conftest import LifecycleEffects
from .phase6_red import emit_effects, report

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = "EXPECTED_RED[phase6-index]: the entity to alarm index is unavailable"
EFFECT_PREFIX = "PHASE6_INDEX_EFFECTS "

#: Every path that changes which entities carry an alarm. Each must rebuild.
MUTATION_PATHS = (
    "project_saved",
    "project_deleted",
    "project_imported",
    "alarm_added",
    "alarm_removed",
    "ids_remapped",
    "migrated",
)


def rescan(projects: dict[str, Any]) -> dict[str, list[str]]:
    """Build the index the slow way, independently of the implementation.

    Deliberately naive and written here rather than imported: comparing the
    builder against itself proves it is deterministic, not that it is right.
    """
    index: dict[str, list[str]] = {}
    for project_id, project in projects.items():
        for alarm in (project.get("config") or {}).get("alarms") or []:
            entity = alarm.get("entity")
            if not entity:
                continue
            index.setdefault(entity, []).append(f"{project_id}:{alarm.get('id')}")
    return {entity: sorted(keys) for entity, keys in index.items()}


def index_gaps() -> list[str]:
    """Return every index behaviour the Companion does not yet have."""
    gaps: list[str] = []

    try:
        from custom_components.glt_flow_card import alarm_engine
    except ImportError:
        return ["there is no alarm_engine module, so there is no single index builder"]

    build = getattr(alarm_engine, "rebuild_alarm_index", None)
    if build is None:
        gaps.append(
            "alarm_engine has no rebuild_alarm_index(); every state change in the "
            "installation currently scans every project and every alarm"
        )
        return gaps

    corpus = build_corpus()
    projects = {corpus.project["id"]: corpus.project}
    built = build(projects)
    expected = rescan(projects)
    if {k: sorted(v) for k, v in (built or {}).items()} != expected:
        gaps.append(f"the index disagrees with a full rescan: {built!r} != {expected!r}")

    if not hasattr(alarm_engine, "INDEX_MUTATION_PATHS"):
        gaps.append(
            "alarm_engine declares no INDEX_MUTATION_PATHS, so nothing says which "
            "paths must rebuild and a new path can forget silently"
        )
    else:
        declared = tuple(alarm_engine.INDEX_MUTATION_PATHS)
        missing = [path for path in MUTATION_PATHS if path not in declared]
        if missing:
            gaps.append(f"these mutation paths do not rebuild the index: {missing}")

    watched = getattr(alarm_engine, "watched_entities", None)
    if watched is None:
        gaps.append(
            "alarm_engine has no watched_entities(); the subscription must follow "
            "the index so a state change on an unrelated entity reaches no alarm"
        )
    elif set(watched(projects)) != set(expected):
        gaps.append("the watched entity set does not match the index")

    return gaps


async def test_expected_red_phase6_index(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
) -> None:
    """The index is built once, rebuilt everywhere, and equals a full rescan."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(EFFECT_PREFIX, lifecycle_effects, mutation_paths=len(MUTATION_PATHS))

    report(RED_MARKER, index_gaps(), "the entity to alarm index is unavailable")


# ---------------------------------------------------------------------------
# The behaviour, now that it exists
# ---------------------------------------------------------------------------


def _project(project_id: str, alarms: list[dict[str, Any]]) -> dict[str, Any]:
    return {"id": project_id, "config": {"alarms": alarms, "schedules": []}}


def test_the_index_equals_a_full_rescan_over_the_corpus() -> None:
    from custom_components.glt_flow_card import alarm_engine

    corpus = build_corpus()
    projects = {corpus.project["id"]: corpus.project}
    assert alarm_engine.rebuild_alarm_index(projects) == rescan(projects)


def test_every_mutation_path_leaves_the_index_equal_to_a_rescan() -> None:
    """Compared against an *independent* rescan, not a second call to the builder.

    Comparing a function with itself proves it is deterministic. The claim here
    is that it is right.
    """
    from custom_components.glt_flow_card import alarm_engine

    a = {"id": "alm-a", "entity": "sensor.a", "active_states": ["on"]}
    b = {"id": "alm-b", "entity": "sensor.b", "active_states": ["on"]}
    projects = {"p1": _project("p1", [a]), "p2": _project("p2", [b])}

    mutations = {
        "project_saved": lambda: projects.update({"p1": _project("p1", [a, b])}),
        "alarm_added": lambda: projects["p1"]["config"]["alarms"].append(
            {"id": "alm-c", "entity": "sensor.c", "active_states": ["on"]}
        ),
        "alarm_removed": lambda: projects["p1"]["config"]["alarms"].pop(0),
        "ids_remapped": lambda: projects["p2"]["config"]["alarms"].__setitem__(
            0, {**b, "id": "alm-b-copy"}
        ),
        "migrated": lambda: projects["p2"]["config"]["alarms"].__setitem__(
            0, {**b, "id": "alm-b-copy", "entity": "sensor.b-renamed"}
        ),
        "project_imported": lambda: projects.update({"p3": _project("p3", [a])}),
        "project_deleted": lambda: projects.pop("p1"),
    }
    # Every declared path is exercised, and the declaration is checked against
    # this list -- a new path added to one and not the other is the failure this
    # whole design exists to prevent.
    assert set(mutations) == set(alarm_engine.INDEX_MUTATION_PATHS)

    for name, mutate in mutations.items():
        mutate()
        assert alarm_engine.rebuild_alarm_index(projects) == rescan(projects), name


def test_an_alarm_with_no_entity_is_left_out_rather_than_keyed_on_none() -> None:
    from custom_components.glt_flow_card import alarm_engine

    projects = {"p1": _project("p1", [{"id": "alm", "active_states": ["on"]},
                                      {"id": "alm2", "entity": "  ", "active_states": ["on"]}])}
    assert alarm_engine.rebuild_alarm_index(projects) == {}


def test_the_index_accepts_the_same_entity_shapes_the_manager_normalises() -> None:
    """Otherwise the index and the scan disagree about what an alarm watches."""
    from custom_components.glt_flow_card import _entity_id, alarm_engine

    for shape in ("sensor.a", {"entity": "sensor.a"}, {"entity_id": "sensor.a"}):
        projects = {"p1": _project("p1", [{"id": "alm", "entity": shape}])}
        index = alarm_engine.rebuild_alarm_index(projects)
        assert index == {"sensor.a": ["p1:alm"]}, shape
        assert _entity_id(shape) == "sensor.a", shape


def test_watched_entities_follows_the_index() -> None:
    from custom_components.glt_flow_card import alarm_engine

    corpus = build_corpus()
    projects = {corpus.project["id"]: corpus.project}
    assert alarm_engine.watched_entities(projects) == sorted(rescan(projects))


def test_exactly_one_function_builds_the_index() -> None:
    """A cache that misses a rebuild is worse than the scan it replaces.

    The scan was slow; the stale cache is quietly wrong. One builder is what
    makes "every mutation path rebuilds" a checkable claim rather than a hope.
    """
    import inspect
    from pathlib import Path

    import custom_components.glt_flow_card as integration
    from custom_components.glt_flow_card import alarm_engine

    engine_source = inspect.getsource(alarm_engine)
    assert engine_source.count("def rebuild_alarm_index(") == 1
    manager_source = Path(integration.__file__).read_text(encoding="utf-8")
    # The manager may *call* it, but must not construct an index of its own.
    assert "setdefault(entity" not in manager_source


async def test_a_state_change_on_an_unwatched_entity_reaches_no_alarm(
    hass: HomeAssistant, config_entry: MockConfigEntry,
) -> None:
    """D3, closed. This was the cost of every state change in the instance."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    from custom_components.glt_flow_card import _manager

    manager = _manager(hass)
    manager.data["projects"]["p1"] = _project(
        "p1", [{"id": "alm", "entity": "binary_sensor.watched", "active_states": ["on"]}]
    )
    manager.async_refresh_alarm_subscription()
    manager._started_at = None  # inside the grace, so nothing transitions either way

    seen: list[str] = []
    original = manager.process_state_change

    async def spy(event):
        seen.append(event.data.get("entity_id"))
        await original(event)

    manager.process_state_change = spy
    manager.async_refresh_alarm_subscription()

    hass.states.async_set("binary_sensor.unrelated", "on")
    hass.states.async_set("sensor.also_unrelated", "42")
    await hass.async_block_till_done()
    assert seen == [], f"an unwatched entity reached the alarm scan: {seen}"

    hass.states.async_set("binary_sensor.watched", "on")
    await hass.async_block_till_done()
    assert seen == ["binary_sensor.watched"]
