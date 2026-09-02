"""What a site can be, and why it did not answer.

Mirrored in ``src/v100/site-vocabulary.mjs`` and compared as canonical bytes.
The byte trap has caught this codebase four times, so the canonical form is
written first rather than added after the first divergence.
"""
from __future__ import annotations

import json
from typing import Any

#: What a site can be.
#:
#: The last two are the pair that matters. `unreachable` means asked and did not
#: answer; `circuit_open` means **not asked**, because it has been failing. A
#: view that shows them identically hides how long the problem has existed, which
#: is the difference between "check the network" and "that plant has been off
#: since Tuesday".
SITE_STATES: tuple[str, ...] = ("healthy", "slow", "unreachable", "circuit_open")

#: Which site states count as an answer.
ANSWERING_STATES: tuple[str, ...] = ("healthy", "slow")

#: Why a remote read or call did not produce a result.
#:
#: Closed, and this is the whole point: `str(err)` from `aiohttp` carries the
#: host and port it failed to reach, so a caller could enumerate internal
#: topology by triggering failures. An error string is also an *interface*, and
#: one that changes with a library version is not one.
REMOTE_FAILURES: tuple[str, ...] = (
    "timeout",
    "connection_refused",
    "unauthorized",
    "malformed_response",
    "unreachable",
    "circuit_open",
    "deadline_reached",
    "not_permitted",
)

#: The four command outcomes, reused from Phase 4 rather than redefined.
#:
#: The distinction between "we do not know whether it happened" and "it did not
#: happen" matters **more** over a network, not less: a timeout on a POST is the
#: canonical case where the service may well have run. Reporting it as failed
#: invites a retry, and a retry after an unknown is how plant gets operated
#: twice.
REMOTE_OUTCOMES: tuple[str, ...] = ("accepted", "sent", "confirmed", "effect_unknown", "failed")

#: Failures that mean the effect may nonetheless have happened.
UNKNOWN_EFFECT_FAILURES: tuple[str, ...] = ("timeout", "deadline_reached")


def is_site_state(value: Any) -> bool:
    return isinstance(value, str) and value in SITE_STATES


def is_remote_failure(value: Any) -> bool:
    return isinstance(value, str) and value in REMOTE_FAILURES


def outcome_for_failure(reason: str) -> str:
    """Return the command outcome one failure reason implies.

    A timeout is `effect_unknown`, never `failed`. This is a function rather than
    a table lookup at each call site so the rule has one home: written out at
    four call sites, one of them eventually says `failed`.
    """
    if reason in UNKNOWN_EFFECT_FAILURES:
        return "effect_unknown"
    if reason not in REMOTE_FAILURES:
        raise ValueError(f"unknown_remote_failure: {reason!r}")
    return "failed"


def vocabulary_fingerprint() -> dict[str, Any]:
    return {
        "answering_states": list(ANSWERING_STATES),
        "remote_failures": list(REMOTE_FAILURES),
        "remote_outcomes": list(REMOTE_OUTCOMES),
        "site_states": list(SITE_STATES),
        "unknown_effect_failures": list(UNKNOWN_EFFECT_FAILURES),
    }


def canonical_vocabulary() -> str:
    """Return the canonical bytes both runtimes must agree on."""
    return json.dumps(
        vocabulary_fingerprint(), ensure_ascii=False, separators=(",", ":"), sort_keys=True,
    )
