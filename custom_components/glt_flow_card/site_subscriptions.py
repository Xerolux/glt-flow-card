"""Subscriptions to remote sites, bounded and named.

``09-RESEARCH.md`` measured the difference that makes this module necessary.
Home Assistant's ``subscribe_events`` with ``event_type: state_changed`` delivers
**every** state change on the remote instance. For a supervision view watching
twenty entities on a site with two thousand, that is a hundredfold
amplification — a view that costs the site it is watching more than the site
costs itself.

``subscribe_entities`` takes an entity list and delivers compressed deltas. It is
the right primitive, and it is what makes a bound meaningful rather than nominal:
bounding the *number* of subscriptions is pointless if each one is a firehose.

A subscription is a **held** resource, so both bounds exist and they are
different questions: how much one site is asked to carry, and how much this
Companion holds in total.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

#: How many subscriptions one site may carry.
MAX_PER_SITE = 4

#: How many this Companion may hold across all sites.
#:
#: Not `per-site x sites`: that is a consequence and it grows every time somebody
#: adds a site. The total is a property of this machine.
MAX_TOTAL = 16

#: How many entities one subscription may name.
MAX_ENTITIES_PER_SUBSCRIPTION = 200

#: Why a subscription was refused.
SUBSCRIPTION_REFUSALS: tuple[str, ...] = (
    "site_subscription_limit",
    "total_subscription_limit",
    "too_many_entities",
    "no_entities_named",
    "subscription_not_found",
)


class SubscriptionRefused(ValueError):
    """A subscription was refused, with a reason and the limit it hit."""

    def __init__(self, reason: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.detail = detail or {}


@dataclass
class RemoteSubscriptions:
    """What this Companion currently holds open against remote sites."""

    per_site: int = MAX_PER_SITE
    total: int = MAX_TOTAL
    held: dict[str, list[dict[str, Any]]] = field(default_factory=dict)

    def count(self, site_id: str | None = None) -> int:
        if site_id is None:
            return sum(len(entries) for entries in self.held.values())
        return len(self.held.get(site_id, []))

    def subscribe(self, *, site_id: str, entity_ids: list[str], token: str) -> dict[str, Any]:
        """Open one subscription naming its entities, or refuse with the limit.

        The entity list is required. A subscription with no entities would have
        to mean "everything", and "everything" is the amplification this module
        exists to prevent — so it is refused rather than interpreted.
        """
        entities = [str(entity) for entity in (entity_ids or []) if entity]
        if not entities:
            raise SubscriptionRefused("no_entities_named", {"site_id": site_id})
        if len(entities) > MAX_ENTITIES_PER_SUBSCRIPTION:
            raise SubscriptionRefused("too_many_entities", {
                "limit": MAX_ENTITIES_PER_SUBSCRIPTION, "requested": len(entities),
            })
        if self.count(site_id) >= self.per_site:
            raise SubscriptionRefused("site_subscription_limit", {
                "limit": self.per_site, "site_id": site_id,
            })
        if self.count() >= self.total:
            raise SubscriptionRefused("total_subscription_limit", {"limit": self.total})

        entry = {
            "entity_ids": sorted(set(entities)),
            "id": token,
            "site_id": site_id,
            # The wire command, recorded so a test can assert *which* primitive
            # was used. `subscribe_events` would satisfy every count-based
            # assertion here while delivering a hundred times the traffic.
            "command": "subscribe_entities",
        }
        self.held.setdefault(site_id, []).append(entry)
        return dict(entry)

    def release(self, *, site_id: str, token: str) -> dict[str, Any]:
        """Release one subscription and free its slot."""
        entries = self.held.get(site_id, [])
        for index, entry in enumerate(entries):
            if entry["id"] == token:
                entries.pop(index)
                if not entries:
                    self.held.pop(site_id, None)
                return {"released": token, "site_id": site_id}
        raise SubscriptionRefused("subscription_not_found", {"site_id": site_id, "id": token})

    def release_site(self, site_id: str) -> int:
        """Release everything held against one site.

        Called when a site is removed from the allowlist, so revocation takes
        effect on held resources rather than only on new ones.
        """
        released = len(self.held.pop(site_id, []))
        return released

    def describe(self) -> dict[str, Any]:
        return {
            "limits": {"per_site": self.per_site, "total": self.total,
                       "entities_per_subscription": MAX_ENTITIES_PER_SUBSCRIPTION},
            "per_site": {site_id: len(entries) for site_id, entries in sorted(self.held.items())},
            "total": self.count(),
        }
