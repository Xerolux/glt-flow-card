"""Shared scaffolding for the Phase-6 controlled RED sentinels.

Every sentinel has the same shape, established in Phase 2: emit the effect
ledger before any product assertion runs, collect *gaps* rather than asserting
one thing at a time, then print the named marker and fail. Collecting gaps
matters -- a sentinel that stops at the first missing behaviour tells the GREEN
plan one thing per run, and the plan needs the whole list.

The ledger emission is here rather than copied into five files because Phase 6
adds a second dimension to it. Proving *zero unintended* service calls is no
longer sufficient in a phase whose subject is a call that is intended, so the
notification ledger's containment is asserted by its own fixture teardown and
this prints what it saw.
"""
from __future__ import annotations

import json
from typing import Any

from .conftest import LifecycleEffects


def emit_effects(prefix: str, effects: LifecycleEffects, **extra: Any) -> None:
    """Print the zero-effect ledger before any product assertion runs."""
    snapshot = effects.snapshot()
    print(prefix + json.dumps({
        "service_attempts": snapshot["service_attempts"],
        "session_attempts": snapshot["sessions"],
        "late_callbacks": snapshot["late_callbacks"],
        "listeners": snapshot["listeners"],
        "tasks": snapshot["tasks"],
        **extra,
    }, sort_keys=True))


def report(marker: str, gaps: list[str], message: str) -> None:
    """Print the named RED marker with every gap, then fail on the message.

    The marker is printed only when there is something to report, so a sentinel
    that has gone GREEN prints nothing and `assert-red.mjs` classifies it as
    implemented rather than as a broken harness.
    """
    if gaps:
        print(marker)
        for gap in gaps:
            print(f"  gap: {gap}")
    assert not gaps, message
