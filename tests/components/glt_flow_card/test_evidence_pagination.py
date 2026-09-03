"""Opaque scoped evidence pagination (T2-04's cursor half, T2-09).

Resolved A5: a cursor is a short-lived *server-state* token, not a
self-contained offset. It is never decodable by the caller, it is bound to the
user, connection/session, project and filter, and a restart invalidates it
rather than resuming it.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from .conftest import LifecycleEffects

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

RED_MARKER = (
    "EXPECTED_RED[phase2-evidence-pagination]: "
    "scoped opaque evidence pagination is unavailable"
)
EFFECT_PREFIX = "PHASE2_CURSOR_EFFECTS "

PROJECT_ID = "cursor-plant"
OTHER_PROJECT_ID = "cursor-other-plant"

#: Exactly one page size. There is no caller-selected limit and no total.
PAGE_SIZE = 50
#: A cursor expires after five minutes of idleness.
CURSOR_IDLE_SECONDS = 300
#: Registry bounds. Eviction is deterministic: oldest idle cursor first.
MAX_CURSORS_PER_CONNECTION = 32
MAX_CURSORS_PER_INTEGRATION = 256

#: Keys a page response may contain. `total`, `offset` and `has_hidden` are
#: absent by design, because each of them would leak rows the caller cannot see.
PAGE_KEYS = frozenset({"rows", "cursor", "has_more"})
FORBIDDEN_PAGE_KEYS = frozenset({"total", "offset", "count", "hidden", "page", "pages"})


def emit_effects(effects: LifecycleEffects, **extra: Any) -> None:
    """Print the zero-effect ledger before any product assertion runs."""
    snapshot = effects.snapshot()
    print(EFFECT_PREFIX + json.dumps({
        "service_attempts": snapshot["service_attempts"],
        "session_attempts": snapshot["sessions"],
        "cursors": snapshot["cursors"],
        "subscriptions": snapshot["subscriptions"],
        **extra,
    }, sort_keys=True))


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


# --------------------------------------------------------------------------
# Contract guarantees that hold before and after implementation.
# --------------------------------------------------------------------------


def test_page_response_shape_cannot_leak_hidden_rows() -> None:
    """No total, no offset, no page number: only rows and an opaque cursor."""
    assert PAGE_KEYS.isdisjoint(FORBIDDEN_PAGE_KEYS)
    assert "total" not in PAGE_KEYS


def test_bounds_are_declared_and_ordered() -> None:
    """Per-connection bounds are strictly smaller than integration bounds."""
    assert PAGE_SIZE == 50
    assert MAX_CURSORS_PER_CONNECTION < MAX_CURSORS_PER_INTEGRATION
    assert CURSOR_IDLE_SECONDS == 300


# --------------------------------------------------------------------------
# Product-completeness sentinel.
# --------------------------------------------------------------------------


async def pagination_gaps(hass: HomeAssistant, phase2_users: Any) -> list[str]:
    """Return every unmet opaque-cursor guarantee."""
    evidence = load("policy_sessions")
    if evidence is None:
        return [
            "custom_components.glt_flow_card.policy_sessions does not exist, so "
            "scoped opaque pagination cannot be enforced"
        ]

    gaps: list[str] = []
    for name in ("EvidenceCursorRegistry", "cursor_registry", "CursorInvalid"):
        if not hasattr(evidence, name):
            gaps.append(f"policy_sessions.{name} is missing")
    if gaps:
        return gaps

    registry = evidence.cursor_registry(hass)
    if registry is None:
        return ["the loaded runtime exposes no cursor registry"]

    viewer = phase2_users.principal("viewer")
    other = phase2_users.principal("operator")
    scope = {
        "user_id": viewer.user_id,
        "session_id": "cursor-session-a",
        "project_id": PROJECT_ID,
        "filter": "all",
    }

    page = await registry.async_first_page(**scope)
    extra = set(page) - PAGE_KEYS
    if extra:
        gaps.append(f"the page response carried extra keys: {sorted(extra)}")
    if len(page.get("rows", [])) > PAGE_SIZE:
        gaps.append(f"a page returned more than {PAGE_SIZE} rows")

    cursor = page.get("cursor")
    if cursor is not None:
        if not isinstance(cursor, str) or len(cursor) < 16:
            gaps.append("the cursor is not an opaque high-entropy token")
        try:
            import base64

            decoded = base64.urlsafe_b64decode(cursor + "==")
            if b"offset" in decoded or b"project" in decoded:
                gaps.append("the cursor decodes to caller-readable state")
        except Exception:  # noqa: BLE001 - an undecodable cursor is the goal
            pass

        # Replay across every binding dimension must fail identically.
        for name, replay in {
            "another user": {**scope, "user_id": other.user_id},
            "another session": {**scope, "session_id": "cursor-session-b"},
            "another project": {**scope, "project_id": OTHER_PROJECT_ID},
            "another filter": {**scope, "filter": "control"},
        }.items():
            try:
                await registry.async_next_page(cursor=cursor, **replay)
                gaps.append(f"a cursor was replayed by {name}")
            except evidence.CursorInvalid:
                pass

        # A restart invalidates every outstanding cursor.
        registry.invalidate_generation()
        try:
            await registry.async_next_page(cursor=cursor, **scope)
            gaps.append("a cursor survived a runtime generation change")
        except evidence.CursorInvalid:
            pass

    if registry.active_count() > MAX_CURSORS_PER_INTEGRATION:
        gaps.append("the cursor registry exceeded its integration bound")
    return gaps


async def test_expected_red_phase2_evidence_pagination(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    phase2_users,
) -> None:
    """Evidence pages are bounded, scoped and paged by an opaque server token."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, page_size=PAGE_SIZE)

    gaps = await pagination_gaps(hass, phase2_users)
    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  cursor gap: {gap}")
    assert not gaps, "scoped opaque evidence pagination is unavailable"
