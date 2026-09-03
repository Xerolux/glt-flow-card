"""Shared scaffolding for the Phase-7 controlled RED sentinels.

Every sentinel has the same shape, established in Phase 2 and carried through
Phase 6: emit the ledger before any product assertion runs, collect *gaps*
rather than asserting one thing at a time, then print the named marker and fail.
Collecting gaps matters -- a sentinel that stops at the first missing behaviour
tells the GREEN plan one thing per run, and the plan needs the whole list.

Phase 7 adds a **query** dimension to the ledger. Proving zero unintended
service calls was necessary and is no longer sufficient in a phase whose subject
is a read that is *intended*: the question here is whether the query stayed
inside the fixture and inside the bound the product declared. The second half
fails while passing, which is why it is a ledger field rather than a convention.
"""
from __future__ import annotations

import json
from typing import Any

from .recorder_factory import RecorderLedger


def emit_queries(prefix: str, ledger: RecorderLedger | None = None, **extra: Any) -> None:
    """Print the query ledger before any product assertion runs."""
    evidence = ledger.evidence() if ledger is not None else {
        "asked": False, "capped": 0, "contracts": [], "max_entities": 0,
        "max_rows": 0, "max_window_seconds": 0.0, "queries": 0,
    }
    print(prefix + json.dumps({**evidence, **extra}, sort_keys=True))


def report(marker: str, gaps: list[str], message: str) -> None:
    """Print the named RED marker with every gap, then fail on the message.

    The marker is printed only when there is something to report, so a sentinel
    that has gone GREEN prints nothing and ``assert-red.mjs`` classifies it as
    implemented rather than as a broken harness.
    """
    if gaps:
        print(marker)
        for gap in gaps:
            print(f"  gap: {gap}")
    assert not gaps, message


def missing(module: str, name: str) -> str | None:
    """Return a gap when a module or attribute the phase needs is absent.

    Import errors are turned into gaps rather than allowed to abort collection,
    because a sentinel that fails at import tells ``assert-red.mjs`` the harness
    is broken rather than that the behaviour is missing, and the RED gate
    correctly refuses to count that as controlled.
    """
    try:
        imported = __import__(
            f"custom_components.glt_flow_card.{module}", fromlist=[name]
        )
    except ImportError:
        return f"custom_components.glt_flow_card.{module} does not exist"
    if not hasattr(imported, name):
        return f"{module}.{name} does not exist"
    return None
