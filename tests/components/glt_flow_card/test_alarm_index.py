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
    # Deselected from the default suite for the length of the RED wave. The
    # Phase-6 RED gate selects them explicitly and requires each to fail for
    # exactly its own named reason. Removed when the sentinel goes GREEN.
    pytest.mark.expected_red,
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
