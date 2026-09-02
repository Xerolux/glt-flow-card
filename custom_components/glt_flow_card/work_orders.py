"""A work order is a sequence of entries, not a row that gets overwritten.

The record exists to answer a question months later, usually to somebody who was
not there: *was this serviced, by whom, and what did they find?* Every defect the
audit found destroys that answer rather than the workflow.

**D22 is the sharpest.** ``save_work_order`` did ``{**old, **work_order}``, so
completing an order erased who opened it and when, and a completed record was
indistinguishable from a rewritten one. A maintenance history that can be
silently edited is not evidence of anything.

So: entries are append-only, a correction is a **new entry naming what it
corrects**, and the current status is *derived* from the entries rather than
stored beside them -- which is what makes it impossible for the record and the
display to disagree.

**D21: no transitions.** Any status string was accepted, so ``"banana"`` was a
valid status and a completed order could silently return to open. Transitions
are checked before an entry is appended, and both sides are named in the refusal
because "invalid transition" alone leaves the operator guessing which half was
wrong.

**D25: unbounded growth.** The store was only ever written to. Phase 6 named
this shape: unbounded state is a leak with a friendly name. Retention is
explicit, and an **open** order is never pruned.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from .content_id import content_id
from .dispatch_vocabulary import (
    WORK_ORDER_STATES,
    transition_allowed,
    transition_needs_reason,
)

#: How long a completed work order is kept, by default.
#:
#: Two years, because a maintenance record's job is to answer a question at the
#: next inspection, and inspections are annual. A site decision with a stated
#: default, documented the way Phase 6 documented every alarm default.
DEFAULT_RETENTION_DAYS = 730

#: The most entries one work order may carry.
#:
#: An order that accumulates thousands of entries is a symptom rather than a
#: record, and the bound stops one runaway integration filling the store.
MAX_ENTRIES = 500

#: Why a work-order change was refused.
WORK_ORDER_REFUSALS: tuple[str, ...] = (
    "unknown_status",
    "invalid_transition",
    "reason_required",
    "entries_exhausted",
    "work_order_not_found",
    "actor_required",
)


class WorkOrderRejected(ValueError):
    """A change was refused, with a reason from the closed set."""

    def __init__(self, reason: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.detail = detail or {}


def _refuse(reason: str, **detail: Any) -> WorkOrderRejected:
    assert reason in WORK_ORDER_REFUSALS, f"undeclared refusal: {reason}"
    return WorkOrderRejected(reason, detail)


def open_work_order(
    *, asset_id: str, title: str, actor_user_id: str, opened_at: str, responsible_user_id: str = "",
) -> dict[str, Any]:
    """Create a work order with exactly one entry: the opening.

    The id is content-derived (T8-22), so re-creating the same order is the same
    order and two created in the same millisecond do not collide -- the third
    occurrence of the clock-derived id defect, closed in one shared helper.
    """
    if not actor_user_id:
        raise _refuse("actor_required")
    seed = {"asset_id": asset_id, "opened_at": opened_at, "title": title}
    order_id = content_id("work_order", seed)
    entry = _entry(
        order_id=order_id, status="open", actor_user_id=actor_user_id, at=opened_at,
        note=title, reason=None, corrects=None,
    )
    return {
        "asset_id": asset_id,
        "entries": [entry],
        "id": order_id,
        # `responsible_user_id`, not a free-text name (D26): "who is
        # responsible" must be resolvable, notifiable and permission-checkable.
        "responsible_user_id": responsible_user_id,
        "title": title,
    }


def _entry(
    *, order_id: str, status: str, actor_user_id: str, at: str,
    note: str | None, reason: str | None, corrects: str | None,
) -> dict[str, Any]:
    payload = {
        "actor_user_id": actor_user_id,
        "at": at,
        "corrects": corrects,
        "note": note,
        "reason": reason,
        "status": status,
        "work_order_id": order_id,
    }
    payload["id"] = content_id("work_order_entry", payload)
    return payload


def current_status(order: dict[str, Any]) -> str:
    """Return the status the entries imply.

    Derived rather than stored. A stored status can drift from the entries that
    were supposed to produce it, and then the record and the display disagree
    while both look authoritative.
    """
    entries = order.get("entries") or []
    if not entries:
        return "open"
    return str(entries[-1]["status"])


def append_transition(
    order: dict[str, Any],
    *,
    status: str,
    actor_user_id: str,
    at: str,
    note: str = "",
    reason: str = "",
    corrects: str | None = None,
) -> dict[str, Any]:
    """Append one transition, or refuse before anything is stored.

    Checked *before* the append, so a refused transition leaves no trace of
    having nearly happened.
    """
    if not actor_user_id:
        raise _refuse("actor_required")
    if status not in WORK_ORDER_STATES:
        raise _refuse("unknown_status", status=status, allowed=list(WORK_ORDER_STATES))

    present = current_status(order)
    if not transition_allowed(present, status):
        # Both sides named. "Invalid transition" alone leaves the operator to
        # guess which half was wrong.
        raise _refuse("invalid_transition", current=present, attempted=status)
    if transition_needs_reason(present, status) and not reason.strip():
        # A reopen without a reason is a record that cannot answer why it
        # exists, which is exactly what a maintenance history is for.
        raise _refuse("reason_required", current=present, attempted=status)

    entries = list(order.get("entries") or [])
    if len(entries) >= MAX_ENTRIES:
        raise _refuse("entries_exhausted", limit=MAX_ENTRIES)

    entries.append(_entry(
        order_id=str(order["id"]), status=status, actor_user_id=actor_user_id, at=at,
        note=note or None, reason=reason or None, corrects=corrects,
    ))
    # A new dict rather than a mutation, so a caller holding the old one still
    # holds what it read. Copy-on-write is the same discipline the project
    # migrations use for the same reason.
    return {**order, "entries": entries}


def correct(
    order: dict[str, Any], *, corrects_entry_id: str, note: str, actor_user_id: str, at: str,
) -> dict[str, Any]:
    """Append a correction naming the entry it corrects.

    A correction never edits. The wrong entry stays, and the record says it was
    corrected -- which is the difference between a history and a draft.
    """
    known = {str(entry["id"]) for entry in order.get("entries") or []}
    if corrects_entry_id not in known:
        raise _refuse("work_order_not_found", entry_id=corrects_entry_id)
    entries = list(order.get("entries") or [])
    entries.append(_entry(
        order_id=str(order["id"]), status=current_status(order), actor_user_id=actor_user_id,
        at=at, note=note, reason=None, corrects=corrects_entry_id,
    ))
    return {**order, "entries": entries}


def prune(
    orders: list[dict[str, Any]], *, now: datetime, retention_days: int = DEFAULT_RETENTION_DAYS,
) -> dict[str, Any]:
    """Drop completed orders past the horizon, and never an open one.

    Pruning is *recorded* rather than silent: a record that vanished without
    explanation is worse than one that was never kept, because somebody will
    look for it.
    """
    horizon = now - timedelta(days=retention_days)
    kept: list[dict[str, Any]] = []
    dropped: list[str] = []
    for order in orders:
        status = current_status(order)
        if status not in ("completed", "cancelled"):
            # An open order is never pruned, however old. Age is not a reason to
            # forget about work that has not been done.
            kept.append(order)
            continue
        entries = order.get("entries") or []
        try:
            last = datetime.fromisoformat(str(entries[-1]["at"]))
        except (IndexError, KeyError, TypeError, ValueError):
            # An unreadable timestamp keeps the record. The other choice throws
            # away evidence because of a formatting problem.
            kept.append(order)
            continue
        if last < horizon:
            dropped.append(str(order["id"]))
        else:
            kept.append(order)
    return {"dropped": dropped, "orders": kept, "retention_days": retention_days}
