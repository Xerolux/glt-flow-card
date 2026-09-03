"""Derive a record's identity from what it is.

This closes a defect on its **third** occurrence. Phase 5 found
``paste_${Date.now()}`` and fixed it in the paste path. Phase 7 found
``report_${Date.now()}`` and fixed it in report runs. Phase 8's audit found
``wo_${Date.now()}`` in work orders, and fixing it a third time in a third place
would have guaranteed a fourth.

Two reasons a clock-derived id is wrong, and they are independent:

**It is not reproducible.** Re-creating the same record produces a different id,
so nothing downstream can say whether two records are the same thing. Reports
are explicitly required to be reproducible and work-order history is required to
be immutable; neither survives an identity that changes on every run.

**It collides.** ``Date.now()`` has millisecond resolution, and two records
created in the same millisecond -- which is ordinary when a loop creates them --
get the same id.

The canonical bytes are the project's existing ones, reusing
``measured_value.canonical_number``, so this does not introduce a fourth notion
of "canonical" alongside the three that already agree.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from .measured_value import canonical_number

#: How many hex characters of the digest an id carries.
#:
#: 16 hex characters is 64 bits. At the scale this product works at -- thousands
#: of work orders, not billions -- the collision probability is negligible, and
#: a shorter id is one a human can read out over a telephone, which is a real
#: thing that happens with a work-order number.
ID_LENGTH = 16

#: The separator between the kind and the payload bytes.
#:
#: Printable on purpose. A control character would be invisible in a diff, a log
#: line and a code review, and this string is part of an identity that must be
#: reproducible across two runtimes for years.
KIND_SEPARATOR = ":"

#: Kinds that may be identified. Closed, because the prefix is part of the id
#: and a typo in a kind would silently create a parallel id space.
ID_KINDS: tuple[str, ...] = (
    "work_order",
    "work_order_entry",
    "attachment",
    "scenario",
    "maintenance_plan",
    "commissioning_run",
    "simulation_session",
)


def _canonicalize(value: Any) -> Any:
    """Return a value in the form the digest is taken over.

    Numbers go through `canonical_number` so that `0` and `0.0` -- the same
    value, different bytes -- cannot produce two ids for one record. That exact
    pair cost this project a cycle in 07-02.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return canonical_number(value)
    if isinstance(value, dict):
        return {str(key): _canonicalize(value[key]) for key in sorted(value)}
    if isinstance(value, (list, tuple)):
        return [_canonicalize(item) for item in value]
    return value


def canonical_bytes(payload: Any) -> str:
    """Return the exact bytes both runtimes hash."""
    return json.dumps(
        _canonicalize(payload), ensure_ascii=False, separators=(",", ":"), sort_keys=True,
    )


def content_id(kind: str, payload: Any) -> str:
    """Return a stable, content-derived id, or refuse an unknown kind.

    The kind is a prefix rather than only a hash input, so an id says what it
    identifies when it appears in a log or a URL. An id whose kind cannot be
    read is one nobody can trace back.
    """
    if kind not in ID_KINDS:
        raise ValueError(f"unknown_id_kind: {kind!r}")
    material = f"{kind}{KIND_SEPARATOR}{canonical_bytes(payload)}"
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()
    return f"{kind}-{digest[:ID_LENGTH]}"
