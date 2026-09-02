"""The controlled Recorder every Phase-7 test reads through, and its ledger.

Phase 6 added a notification dimension to the effect ledger because its subject
was a service call that was *intended*. Phase 7's subject is a **read** that is
intended, and the question a ledger has to answer here is different again: of the
queries a test meant to make, did any of them leave the fixture, and did any of
them exceed the bound the product declared?

Both halves matter and they fail differently. A query that reaches a live
Recorder makes the suite's results depend on somebody's database. A query that
stays inside the fixture but asks for a year of raw states proves the bound is
decoration -- and it proves it *while passing*, which is the failure shape this
whole phase exists to catch.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

#: The contracts a Phase-7 query may use. Closed, mirrored from `07-RESEARCH.md`.
RECORDER_CONTRACTS: tuple[str, ...] = ("statistics", "statistic", "raw")

#: The fixture Recorder's identity. It exists nowhere in Home Assistant, so a
#: query recorded against any other source left the fixture by definition.
FAKE_RECORDER = "glt_fake_recorder"


class LiveRecorderReached(AssertionError):
    """A test issued a query against something other than the fixture Recorder."""


class QueryBoundExceeded(AssertionError):
    """A test issued a query larger than the bound the product declared."""


@dataclass
class RecorderLedger:
    """Record every Recorder query with its contract, size and result.

    `rows` is what came back, not what was asked for, because the two answer
    different questions: the request size is what the bound governs, and the
    response size is what tells us whether a cap was reached silently.
    """

    queries: list[dict[str, Any]] = field(default_factory=list)
    #: Bounds the suite declares. A test that raises one has to say so out loud.
    max_entities: int = 40
    max_window_seconds: int = 7 * 24 * 3600
    max_rows: int = 50_000

    def record(
        self,
        contract: str,
        *,
        source: str,
        entities: int,
        window_seconds: float,
        rows: int,
        capped: bool = False,
    ) -> None:
        """Record one query. An unknown contract is a defect, not a category."""
        if contract not in RECORDER_CONTRACTS:
            raise ValueError(f"unknown recorder contract: {contract!r}")
        self.queries.append(
            {
                "capped": bool(capped),
                "contract": contract,
                "entities": int(entities),
                "rows": int(rows),
                "source": source,
                "window_seconds": float(window_seconds),
            }
        )

    @property
    def contracts(self) -> tuple[str, ...]:
        """Return the distinct contracts this suite used."""
        return tuple(sorted({q["contract"] for q in self.queries}))

    def asked(self) -> bool:
        """Return whether any query was made at all.

        "No data came back" and "nothing was asked" are different answers, and
        a series that is empty for the second reason is not evidence about the
        Recorder. Keeping them apart is why this exists as its own method.
        """
        return bool(self.queries)

    def assert_contained(self) -> None:
        """Fail if any query left the fixture or exceeded a declared bound.

        Called from the fixture's teardown, so it converts a passing test that
        reached a live Recorder -- or quietly asked for a year of raw states --
        into a failing one. Phase 6 established that a check the test itself has
        to remember to call is a check that gets forgotten.
        """
        escaped = sorted({q["source"] for q in self.queries if q["source"] != FAKE_RECORDER})
        if escaped:
            raise LiveRecorderReached(
                f"a test queried a Recorder outside the fixture: {escaped}"
            )

        exceeded: list[str] = []
        for query in self.queries:
            if query["entities"] > self.max_entities:
                exceeded.append(
                    f"{query['contract']}: {query['entities']} entities > {self.max_entities}"
                )
            if query["contract"] == "raw" and query["window_seconds"] > self.max_window_seconds:
                exceeded.append(
                    f"raw: {query['window_seconds']:.0f}s window > {self.max_window_seconds}s"
                )
            if query["rows"] > self.max_rows:
                exceeded.append(f"{query['contract']}: {query['rows']} rows > {self.max_rows}")
        if exceeded:
            raise QueryBoundExceeded(
                "a test issued a query past a declared bound: " + str(sorted(set(exceeded)))
            )

    def evidence(self) -> dict[str, Any]:
        """Return the canonical ledger evidence a RED sentinel prints."""
        return {
            "asked": self.asked(),
            "capped": sum(1 for q in self.queries if q["capped"]),
            "contracts": list(self.contracts),
            "max_entities": max((q["entities"] for q in self.queries), default=0),
            "max_rows": max((q["rows"] for q in self.queries), default=0),
            "max_window_seconds": max((q["window_seconds"] for q in self.queries), default=0.0),
            "queries": len(self.queries),
        }
