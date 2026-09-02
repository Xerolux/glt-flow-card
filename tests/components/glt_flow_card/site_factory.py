"""The fixture transport every Phase-9 test reads a remote site through.

Each phase's ledger answers the question that phase can get wrong while passing.
Phase 7's was a query exceeding its bound; Phase 8's was an effect reaching the
plant during a rehearsal. **Phase 9's is a test that proves a bound while opening
a real socket** — which proves nothing about the product and something alarming
about the suite.

Two design decisions here are load-bearing.

**A real socket raises rather than being recorded.** Every other ledger violation
in this codebase is something a test asserts afterwards; this one cannot wait,
because by the time the ledger is read the request has already left the building
with a credential attached.

**Latency is injected, never slept.** A test proving a total deadline by sleeping
for the deadline is a test that takes as long as the deadline, and a suite that
takes minutes to prove a timeout is a suite nobody runs — so it gets deleted, and
the bound stops being tested. The fixture advances a clock instead.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

#: How a fixture site behaves. Closed, because a test that invents a behaviour
#: inline is a test whose scenario nobody else can reuse or compare against.
SITE_BEHAVIOURS: tuple[str, ...] = (
    "fast",
    "slow",
    "timeout",
    "refused",
    "malformed",
    "unauthorized",
)

#: The fixture's identity. It exists nowhere on any network, so a request
#: recorded against any other host left the fixture by definition.
FAKE_SITE_HOST = "glt-fake-site.invalid"

#: The sentinel token. Distinctive on purpose: `test_remote_failures.py` searches
#: every output of every remote path for this exact string, and a value like
#: "token" or "secret" would produce false matches against ordinary prose.
SENTINEL_TOKEN = "glt-sentinel-token-8f3a1c7e-do-not-leak"


class LiveSocketReached(AssertionError):
    """A test attempted a real network connection.

    Raised rather than recorded. By the time a ledger could be read, the request
    has already gone out carrying a credential.
    """


class UnknownSiteBehaviour(AssertionError):
    """A fixture site declared a behaviour the factory does not implement."""


@dataclass
class FakeClock:
    """A clock a test advances by hand.

    Every duration in this phase — per-site timeout, total deadline, circuit
    breaker window, value freshness — is measured against this rather than
    against wall time. It is what makes a fifty-minute defect testable in
    milliseconds.
    """

    now: float = 0.0

    def monotonic(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@dataclass
class FakeSite:
    """One remote site the fixture can answer for."""

    site_id: str
    behaviour: str = "fast"
    latency: float = 0.05
    states: dict[str, Any] = field(default_factory=dict)
    host: str = FAKE_SITE_HOST
    resolves_to: str = "203.0.113.10"
    verify_ssl: bool = True

    def __post_init__(self) -> None:
        if self.behaviour not in SITE_BEHAVIOURS:
            raise UnknownSiteBehaviour(
                f"{self.behaviour!r} is not a declared fixture behaviour; add it to "
                "SITE_BEHAVIOURS so other tests can use the same scenario",
            )


@dataclass
class SiteLedger:
    """Record every request a remote path would make.

    `requests` counts what left, `refused` counts what the product declined to
    send. Both are needed: a destination check that refuses is only proven by
    the absence of a matching request, and an absence is only meaningful if
    something was recorded when the check passed.
    """

    requests: list[dict[str, Any]] = field(default_factory=list)
    refused: list[dict[str, Any]] = field(default_factory=list)
    subscriptions: list[dict[str, Any]] = field(default_factory=list)

    def record(self, *, site_id: str, host: str, path: str, method: str = "GET") -> None:
        if host != FAKE_SITE_HOST:
            raise LiveSocketReached(
                f"a request for site {site_id!r} addressed {host!r} rather than the "
                "fixture; a Phase-9 test must never reach a real network",
            )
        self.requests.append({"host": host, "method": method, "path": path, "site_id": site_id})

    def refuse(self, *, site_id: str, reason: str, **detail: Any) -> None:
        self.refused.append({"reason": reason, "site_id": site_id, **detail})

    def counts(self) -> dict[str, int]:
        """The line every Phase-9 test emits.

        All four must be zero unless the test names them. `socket` counts real
        connections and is structurally always zero — it is emitted anyway, so
        the ledger line reads the same shape as every other phase's and a reader
        does not have to remember which counts exist here.
        """
        return {
            "network": 0,
            "remote": len(self.requests),
            "service": len([r for r in self.requests if r["method"] == "POST"]),
            "socket": 0,
        }

    def requests_for(self, site_id: str) -> list[dict[str, Any]]:
        return [entry for entry in self.requests if entry["site_id"] == site_id]


class FakeTransport:
    """Answers for a set of fixture sites, without a socket.

    `get_states` returns what `GET /api/states` would: **every** state in one
    response. That shape is the point — the shipped code asked per entity, and a
    fixture that also answered per entity would make the defect invisible.
    """

    def __init__(self, sites: list[FakeSite], *, clock: FakeClock, ledger: SiteLedger) -> None:
        self.sites = {site.site_id: site for site in sites}
        self.clock = clock
        self.ledger = ledger

    def _site(self, site_id: str) -> FakeSite:
        site = self.sites.get(site_id)
        if site is None:
            raise KeyError(site_id)
        return site

    async def get_states(self, site_id: str, *, timeout: float) -> list[dict[str, Any]]:
        site = self._site(site_id)
        self.ledger.record(site_id=site_id, host=site.host, path="/api/states")

        if site.behaviour == "refused":
            raise ConnectionRefusedError(f"connection refused by {site.host}:8123")
        if site.behaviour == "unauthorized":
            raise PermissionError(f"401 from {site.host}: bad token {SENTINEL_TOKEN}")
        if site.behaviour == "malformed":
            raise json.JSONDecodeError("Expecting value", "<not json>", 0)

        # Injected, not slept. A timeout is a comparison against the fixture
        # clock, so proving a fifty-minute defect costs milliseconds.
        self.clock.advance(site.latency)
        if site.behaviour == "timeout" or site.latency > timeout:
            raise TimeoutError(f"no response from {site.host} within {timeout}s")

        return [{"entity_id": entity_id, **state} for entity_id, state in site.states.items()]

    async def call_service(
        self, site_id: str, domain: str, service: str, data: dict[str, Any], *, timeout: float,
    ) -> list[dict[str, Any]]:
        site = self._site(site_id)
        self.ledger.record(
            site_id=site_id, host=site.host, path=f"/api/services/{domain}/{service}", method="POST",
        )
        if site.behaviour == "refused":
            raise ConnectionRefusedError(f"connection refused by {site.host}:8123")
        self.clock.advance(site.latency)
        if site.behaviour == "timeout" or site.latency > timeout:
            raise TimeoutError(f"no response from {site.host} within {timeout}s")
        # What `POST /api/services` actually returns: the states it changed.
        # This is the readback Phase 4's `confirmed` outcome needs, and the
        # shipped code discarded it.
        return [{"entity_id": entity, "state": "on"} for entity in (data.get("entity_id") or [])]

    def resolve(self, host: str) -> str:
        """Return the address a host resolves to *now*.

        Separate from the site's declared host so a test can change it between
        validation and connection, which is what DNS rebinding is and why an
        allowlist alone does not hold.
        """
        for site in self.sites.values():
            if site.host == host:
                return site.resolves_to
        return "203.0.113.1"
