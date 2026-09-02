"""Per-event subscription reauthorization (the subscription half of T2-04).

A subscription is not a standing grant. Every emitted event is reauthorized
against the current ACL, and a role change or revocation sends one minimal
sequenced revocation event and no protected detail afterwards.
"""
from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
import pytest

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

PROJECT_ID = "subscription-plant"

#: The revocation event a client receives when its authority disappears. It
#: carries no project body, no other member's identity and no lease token.
REVOCATION_EVENT_KEYS = frozenset({"type", "project_id", "sequence", "reason"})

#: Fields no subscription event may ever contain.
FORBIDDEN_EVENT_KEYS = frozenset({
    "config",
    "candidate",
    "lease_token",
    "token",
    "access_token",
    "assignments",
    "members",
    "user_ids",
})


def load(name: str) -> Any:
    """Import one Companion module, or return None while it does not exist."""
    try:
        return __import__(f"custom_components.glt_flow_card.{name}", fromlist=[name])
    except ImportError:
        return None


def test_revocation_event_shape_is_minimal_by_contract() -> None:
    """A revocation tells the client to stop, and nothing else."""
    assert "reason" in REVOCATION_EVENT_KEYS
    assert REVOCATION_EVENT_KEYS.isdisjoint(FORBIDDEN_EVENT_KEYS)


def test_forbidden_event_keys_cover_every_known_leak_channel() -> None:
    """Project bodies, candidates, tokens and member lists stay server-side."""
    assert {"config", "candidate", "lease_token", "assignments"} <= FORBIDDEN_EVENT_KEYS


async def subscription_gaps(hass: HomeAssistant, phase2_users: Any) -> list[str]:
    """Return every unmet per-event reauthorization guarantee."""
    sessions = load("policy_sessions")
    if sessions is None:
        return [
            "custom_components.glt_flow_card.policy_sessions does not exist, so "
            "subscription events cannot be reauthorized per emission"
        ]

    gaps: list[str] = []
    for name in ("SubscriptionRegistry", "subscription_registry"):
        if not hasattr(sessions, name):
            gaps.append(f"policy_sessions.{name} is missing")
    if gaps:
        return gaps

    registry = sessions.subscription_registry(hass)
    if registry is None:
        return ["the loaded runtime exposes no subscription registry"]

    if registry.active_count() != 0:
        gaps.append("a freshly loaded runtime already holds subscriptions")

    access = load("project_access")
    if access is None:
        gaps.append("project access is unavailable, so revocation cannot be proven")
        return gaps

    repository = access.access_repository(hass)
    viewer = phase2_users.principal("viewer")
    await repository.async_assign(
        project_id=PROJECT_ID, user_id=viewer.user_id, role="viewer"
    )

    received: list[dict[str, Any]] = []
    unsubscribe = await registry.async_subscribe(
        project_id=PROJECT_ID,
        user_id=viewer.user_id,
        session_id="probe-session",
        send=received.append,
    )
    if registry.active_count() != 1:
        gaps.append("subscribing did not register exactly one active subscription")

    await registry.async_publish(PROJECT_ID, {"type": "project_changed", "revision": 1})
    if not received:
        gaps.append("an authorized subscriber received no event")

    await repository.async_revoke(project_id=PROJECT_ID, user_id=viewer.user_id)
    await registry.async_publish(PROJECT_ID, {"type": "project_changed", "revision": 2})

    revocations = [event for event in received if event.get("type") == "access_revoked"]
    if not revocations:
        gaps.append("revoking a role sent no revocation event")
    else:
        extra = set(revocations[-1]) - REVOCATION_EVENT_KEYS
        if extra:
            gaps.append(f"the revocation event carried extra keys: {sorted(extra)}")

    after = [event for event in received if event.get("revision") == 2]
    if after:
        gaps.append("a revoked subscriber still received protected detail")

    sequences = [event.get("sequence") for event in received if "sequence" in event]
    if sequences != sorted(sequences) or len(set(sequences)) != len(sequences):
        gaps.append("subscription events are not strictly sequenced")

    for event in received:
        leaked = set(event) & FORBIDDEN_EVENT_KEYS
        if leaked:
            gaps.append(f"a subscription event leaked {sorted(leaked)}")

    unsubscribe()
    if registry.active_count() != 0:
        gaps.append("unsubscribing did not release the subscription")
    return gaps
