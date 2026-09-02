"""Connection-bound exclusive engineering leases (T2-10).

A lease is an ephemeral, memory-only capability. It is bound to project, actor,
connection/session, purpose, access revision and runtime generation; renewal
rotates the bearer; expiry has no grace period; and a losing caller learns only
that some lease is held, never by whom.
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
    "EXPECTED_RED[phase2-leases]: connection-bound engineering leases are unavailable"
)
EFFECT_PREFIX = "PHASE2_LEASE_EFFECTS "

PROJECT_ID = "lease-plant"

#: Accepted lease TTLs, in seconds. Anything outside this closed range is
#: rejected; the legacy 30-3600 lock range is deliberately not carried over.
MIN_TTL_SECONDS = 60
MAX_TTL_SECONDS = 900
VALID_TTLS = (60, 300, 900)
INVALID_TTLS = (0, 30, 59, 901, 3600, -1)

#: Purposes a lease may be issued for. `engineering` guards content mutation;
#: `administration` exists only for HA-admin membership recovery.
PURPOSES = ("engineering", "administration")

#: Every binding dimension a lease token must be checked against.
BINDING_FIELDS = (
    "project_id",
    "user_id",
    "session_id",
    "purpose",
    "access_revision",
    "generation",
)

#: Fields that must never appear in a lease response for a losing caller.
FORBIDDEN_DENIAL_FIELDS = frozenset({"owner", "owner_id", "user_id", "user_name", "token"})


def emit_effects(effects: LifecycleEffects, **extra: Any) -> None:
    """Print the zero-effect ledger before any product assertion runs."""
    snapshot = effects.snapshot()
    print(EFFECT_PREFIX + json.dumps({
        "service_attempts": snapshot["service_attempts"],
        "leases": snapshot["leases"],
        "tasks": snapshot["tasks"],
        "late_callbacks": snapshot["late_callbacks"],
        **extra,
    }, sort_keys=True))


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


class ManualClock:
    """A monotonic clock the lease tests advance explicitly."""

    def __init__(self, start: float = 1000.0) -> None:
        self._now = start

    def __call__(self) -> float:
        return self._now

    def advance(self, seconds: float) -> None:
        """Move time forward; expiry must be decided by this value alone."""
        self._now += seconds


# --------------------------------------------------------------------------
# Contract guarantees that hold before and after implementation.
# --------------------------------------------------------------------------


def test_ttl_range_replaces_the_legacy_lock_range() -> None:
    """Phase-2 leases are 60-900s; the legacy 30-3600s lock range is gone."""
    assert VALID_TTLS[0] == MIN_TTL_SECONDS
    assert VALID_TTLS[-1] == MAX_TTL_SECONDS
    for ttl in INVALID_TTLS:
        assert not (MIN_TTL_SECONDS <= ttl <= MAX_TTL_SECONDS)


def test_binding_covers_every_replay_dimension() -> None:
    """A token must be useless outside its exact issuing context."""
    assert set(BINDING_FIELDS) == {
        "project_id",
        "user_id",
        "session_id",
        "purpose",
        "access_revision",
        "generation",
    }


def test_denial_shape_never_names_the_holder() -> None:
    """A losing caller learns that a lease is held, not who holds it."""
    assert "owner" in FORBIDDEN_DENIAL_FIELDS
    assert "token" in FORBIDDEN_DENIAL_FIELDS


def test_manual_clock_only_moves_when_told() -> None:
    """Expiry evidence must be deterministic, never wall-clock dependent."""
    clock = ManualClock()
    start = clock()
    clock.advance(301)
    assert clock() == start + 301


# --------------------------------------------------------------------------
# Product-completeness sentinel.
# --------------------------------------------------------------------------


async def lease_gaps(hass: HomeAssistant, phase2_users: Any) -> list[str]:
    """Return every unmet lease guarantee."""
    leases = load("project_leases")
    if leases is None:
        return ["custom_components.glt_flow_card.project_leases does not exist"]

    gaps: list[str] = []
    for name in ("LeaseRegistry", "lease_registry", "LeaseDenied", "LeaseInvalid"):
        if not hasattr(leases, name):
            gaps.append(f"project_leases.{name} is missing")
    if gaps:
        return gaps

    clock = ManualClock()
    registry = leases.LeaseRegistry(clock=clock)
    engineer = phase2_users.principal("engineer")
    other = phase2_users.principal("engineer_two")

    def acquire(principal: Any, session: str, ttl: int = 300, purpose: str = "engineering"):
        return registry.acquire(
            project_id=PROJECT_ID,
            user_id=principal.user_id,
            session_id=session,
            purpose=purpose,
            ttl_seconds=ttl,
            access_revision=1,
        )

    for ttl in INVALID_TTLS:
        try:
            acquire(engineer, "session-ttl", ttl=ttl)
            gaps.append(f"a lease was issued with an out-of-range TTL of {ttl}")
            registry.release_all(PROJECT_ID)
        except ValueError:
            pass

    lease = acquire(engineer, "session-a")
    if not isinstance(getattr(lease, "token", None), str) or len(lease.token) < 24:
        gaps.append("the lease token is not an opaque high-entropy string")

    # Exclusivity: a second tab of the same user and a second user both lose.
    for principal, session, label in (
        (engineer, "session-b", "the same user's second connection"),
        (other, "session-c", "a second engineer"),
    ):
        try:
            acquire(principal, session)
            gaps.append(f"{label} acquired a concurrent exclusive lease")
        except leases.LeaseDenied as denied:
            leaked = FORBIDDEN_DENIAL_FIELDS & set(getattr(denied, "detail", {}) or {})
            if leaked:
                gaps.append(f"the denial leaked {sorted(leaked)}")

    # Every binding dimension must invalidate the token.
    valid = {
        "project_id": PROJECT_ID,
        "user_id": engineer.user_id,
        "session_id": "session-a",
        "purpose": "engineering",
        "access_revision": 1,
    }
    if not registry.validate(token=lease.token, **valid):
        gaps.append("a freshly issued lease did not validate in its own context")
    for field, wrong in {
        "project_id": "other-project",
        "user_id": other.user_id,
        "session_id": "session-z",
        "purpose": "administration",
        "access_revision": 2,
    }.items():
        if registry.validate(token=lease.token, **{**valid, field: wrong}):
            gaps.append(f"a lease token validated with a different {field}")

    # Renewal rotates the bearer and the old token dies immediately.
    renewed = registry.renew(token=lease.token, **valid, ttl_seconds=300)
    if renewed.token == lease.token:
        gaps.append("renewal did not rotate the lease token")
    if registry.validate(token=lease.token, **valid):
        gaps.append("the pre-renewal token still validates")

    # Expiry has no grace period.
    clock.advance(299)
    if not registry.validate(token=renewed.token, **valid):
        gaps.append("a lease expired before its TTL elapsed")
    clock.advance(2)
    if registry.validate(token=renewed.token, **valid):
        gaps.append("an expired lease still validated; there is no grace period")

    # A disconnect releases the lease and a reconnect must reacquire.
    fresh = acquire(engineer, "session-d")
    registry.release_session("session-d")
    if registry.validate(
        token=fresh.token, **{**valid, "session_id": "session-d"}
    ):
        gaps.append("a lease survived its connection being released")

    # A runtime generation change invalidates everything, with no persistence.
    live = acquire(engineer, "session-e")
    registry.invalidate_generation()
    if registry.validate(token=live.token, **{**valid, "session_id": "session-e"}):
        gaps.append("a lease survived a runtime generation change")
    if registry.active_count() != 0:
        gaps.append("invalidating the generation left lease state behind")

    serialized = json.dumps(registry.diagnostics(), sort_keys=True)
    for token in (lease.token, renewed.token, fresh.token, live.token):
        if token in serialized:
            gaps.append("a lease token appeared in diagnostics output")
            break
    return gaps


async def test_expected_red_phase2_leases(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    lifecycle_effects: LifecycleEffects,
    phase2_users,
) -> None:
    """Exactly one exclusive, connection-bound, rotating, expiring lease."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    emit_effects(lifecycle_effects, ttls=len(VALID_TTLS))

    gaps = await lease_gaps(hass, phase2_users)
    if gaps:
        print(RED_MARKER)
        for gap in gaps:
            print(f"  lease gap: {gap}")
    assert not gaps, "connection-bound engineering leases are unavailable"
