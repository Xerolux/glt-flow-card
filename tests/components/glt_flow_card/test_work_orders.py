"""A maintenance record survives being written to (T8-18, T8-19, T8-20).

The record exists to answer a question months later, to somebody who was not
there. Every assertion here is about that question still being answerable.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from custom_components.glt_flow_card import attachments, work_orders
from custom_components.glt_flow_card.work_orders import WorkOrderRejected

EFFECT_PREFIX = "PHASE8_WORK_ORDER_EFFECTS "

OPENED = "2027-06-01T08:00:00+02:00"


def _emit(**counts):
    print(EFFECT_PREFIX + json.dumps({"network": 0, "notification": 0, "remote": 0,
                                      "service": 0, **counts}, sort_keys=True))


def _open():
    return work_orders.open_work_order(
        asset_id="pump-1", title="Lager schmieren", actor_user_id="u1", opened_at=OPENED,
    )


def test_completing_an_order_preserves_who_opened_it_and_when():
    """T8-18. `{**old, **new}` erased exactly this.

    A completed record was indistinguishable from a rewritten one, which is the
    difference between evidence and a draft.
    """
    order = _open()
    order = work_orders.append_transition(
        order, status="assigned", actor_user_id="u2", at="2027-06-01T09:00:00+02:00",
    )
    order = work_orders.append_transition(
        order, status="in_progress", actor_user_id="u3", at="2027-06-01T10:00:00+02:00",
    )
    order = work_orders.append_transition(
        order, status="completed", actor_user_id="u3", at="2027-06-01T11:30:00+02:00",
        note="Lager geschmiert, Geräusch weg",
    )
    _emit(entries=len(order["entries"]))

    opening = order["entries"][0]
    assert opening["status"] == "open"
    assert opening["actor_user_id"] == "u1", "the opening actor was overwritten"
    assert opening["at"] == OPENED, "the opening time was overwritten"
    assert len(order["entries"]) == 4
    assert work_orders.current_status(order) == "completed"


def test_status_is_derived_from_the_entries_rather_than_stored_beside_them():
    """A stored status can drift from the entries that produced it.

    Then the record and the display disagree while both look authoritative.
    """
    order = _open()
    assert "status" not in order, "a stored status can drift from the entries"
    assert work_orders.current_status(order) == "open"


def test_an_invalid_transition_is_refused_before_anything_is_stored():
    """T8-19. `"banana"` was a valid status, and a completed order could reopen silently."""
    order = _open()
    with pytest.raises(WorkOrderRejected) as refused:
        work_orders.append_transition(
            order, status="banana", actor_user_id="u1", at=OPENED,
        )
    assert refused.value.reason == "unknown_status"
    assert len(order["entries"]) == 1, "a refused transition left a trace"


def test_a_refusal_names_both_the_current_status_and_the_attempted_one():
    """"Invalid transition" alone leaves the operator guessing which half was wrong."""
    order = _open()
    with pytest.raises(WorkOrderRejected) as refused:
        work_orders.append_transition(
            order, status="completed", actor_user_id="u1", at=OPENED,
        )
    assert refused.value.reason == "invalid_transition"
    assert refused.value.detail["current"] == "open"
    assert refused.value.detail["attempted"] == "completed"


def test_reopening_is_allowed_but_must_carry_a_reason():
    """A reopen without a reason is a record that cannot answer why it exists."""
    order = _open()
    for status, actor in (("assigned", "u2"), ("in_progress", "u2"), ("completed", "u2")):
        order = work_orders.append_transition(
            order, status=status, actor_user_id=actor, at="2027-06-01T10:00:00+02:00",
        )
    with pytest.raises(WorkOrderRejected) as refused:
        work_orders.append_transition(
            order, status="open", actor_user_id="u4", at="2027-06-08T08:00:00+02:00",
        )
    assert refused.value.reason == "reason_required"

    reopened = work_orders.append_transition(
        order, status="open", actor_user_id="u4", at="2027-06-08T08:00:00+02:00",
        reason="Geräusch ist wieder da",
    )
    assert work_orders.current_status(reopened) == "open"
    assert reopened["entries"][-1]["reason"] == "Geräusch ist wieder da"
    # And the completion is still there, so "was this done?" is still answerable.
    assert any(entry["status"] == "completed" for entry in reopened["entries"])


def test_handing_a_job_back_needs_no_reason():
    """The same destination means different things depending on where it came from.

    `assigned -> open` is handing a job back; `completed -> open` is saying the
    work was not in fact done. Only the second must justify itself.
    """
    order = _open()
    order = work_orders.append_transition(
        order, status="assigned", actor_user_id="u2", at=OPENED,
    )
    handed_back = work_orders.append_transition(
        order, status="open", actor_user_id="u2", at="2027-06-01T09:00:00+02:00",
    )
    assert work_orders.current_status(handed_back) == "open"


def test_a_correction_appends_and_names_what_it_corrects():
    """A correction never edits. The wrong entry stays, marked as corrected."""
    order = _open()
    target = order["entries"][0]["id"]
    corrected = work_orders.correct(
        order, corrects_entry_id=target, note="Falsches Aggregat angegeben",
        actor_user_id="u5", at="2027-06-02T08:00:00+02:00",
    )
    assert len(corrected["entries"]) == 2
    assert corrected["entries"][0] == order["entries"][0], "the corrected entry was edited"
    assert corrected["entries"][-1]["corrects"] == target


def test_a_correction_of_an_unknown_entry_is_refused():
    order = _open()
    with pytest.raises(WorkOrderRejected) as refused:
        work_orders.correct(
            order, corrects_entry_id="work_order_entry-deadbeefdeadbeef",
            note="x", actor_user_id="u1", at=OPENED,
        )
    assert refused.value.reason == "work_order_not_found"


def test_the_responsible_person_is_a_user_rather_than_free_text():
    """D26. "Who is responsible" must be resolvable, notifiable, permission-checkable."""
    order = work_orders.open_work_order(
        asset_id="pump-1", title="Service", actor_user_id="u1", opened_at=OPENED,
        responsible_user_id="u9",
    )
    assert order["responsible_user_id"] == "u9"
    assert "assignee" not in order


def test_ids_are_content_derived_rather_than_minted_from_the_clock():
    """T8-22, third occurrence of this defect in the codebase."""
    order = _open()
    assert order["id"].startswith("work_order-")
    assert work_orders.open_work_order(
        asset_id="pump-1", title="Lager schmieren", actor_user_id="u1", opened_at=OPENED,
    )["id"] == order["id"], "the same order got two identities"


# --- Bounds (T8-20) ---------------------------------------------------------


def test_an_open_order_is_never_pruned_however_old():
    """Age is not a reason to forget about work that has not been done."""
    now = datetime(2030, 1, 1, tzinfo=timezone.utc)
    old_open = _open()
    result = work_orders.prune([old_open], now=now, retention_days=1)
    assert result["dropped"] == []
    assert result["orders"] == [old_open]


def test_a_completed_order_past_the_horizon_is_dropped_and_recorded():
    """A record that vanished without explanation is worse than one never kept."""
    now = datetime(2030, 1, 1, tzinfo=timezone.utc)
    order = _open()
    for status in ("assigned", "in_progress", "completed"):
        order = work_orders.append_transition(
            order, status=status, actor_user_id="u2", at="2027-06-01T12:00:00+02:00",
        )
    result = work_orders.prune([order], now=now, retention_days=30)
    assert result["dropped"] == [order["id"]]
    assert result["orders"] == []
    assert result["retention_days"] == 30


def test_an_unreadable_timestamp_keeps_the_record():
    """Throwing away evidence over a formatting problem is the wrong trade."""
    now = datetime(2030, 1, 1, tzinfo=timezone.utc)
    order = _open()
    order = work_orders.append_transition(
        order, status="assigned", actor_user_id="u2", at="2027-06-01T12:00:00+02:00",
    )
    order = work_orders.append_transition(
        order, status="in_progress", actor_user_id="u2", at="2027-06-01T12:00:00+02:00",
    )
    order = work_orders.append_transition(
        order, status="completed", actor_user_id="u2", at="2027-06-01T12:00:00+02:00",
    )
    order["entries"][-1]["at"] = "not a timestamp"
    result = work_orders.prune([order], now=now, retention_days=1)
    assert result["dropped"] == []


def test_entries_are_bounded():
    order = _open()
    order["entries"] = order["entries"] * work_orders.MAX_ENTRIES
    with pytest.raises(WorkOrderRejected) as refused:
        work_orders.append_transition(
            order, status="assigned", actor_user_id="u1", at=OPENED,
        )
    assert refused.value.reason == "entries_exhausted"


# --- Attachments (T8-20) ----------------------------------------------------


def test_attachment_limits_are_readable_before_a_file_is_chosen():
    """A limit discovered by hitting it is a limit that wasted the work.

    On a phone, in a plant room, that work is a photograph somebody climbed a
    ladder to take.
    """
    limits = attachments.limits()
    assert limits["max_bytes"] == attachments.MAX_BYTES
    assert limits["max_attachments"] == attachments.MAX_ATTACHMENTS
    assert "image/jpeg" in limits["types"]


def test_an_over_size_attachment_is_refused_rather_than_truncated():
    """A half-stored photograph looks like evidence and is not."""
    content = b"\xff\xd8\xff" + b"x" * (attachments.MAX_BYTES + 1)
    with pytest.raises(attachments.AttachmentRejected) as refused:
        attachments.accept(content=content, declared_type="image/jpeg", filename="a.jpg")
    assert refused.value.reason == "attachment_too_large"
    assert refused.value.detail["limit"] == attachments.MAX_BYTES


def test_the_type_is_checked_by_content_not_by_filename():
    """A name is a claim made by whoever typed it."""
    with pytest.raises(attachments.AttachmentRejected) as refused:
        attachments.accept(
            content=b"<html>not a pdf</html>", declared_type="application/pdf",
            filename="report.pdf",
        )
    assert refused.value.reason == "content_does_not_match_type"


def test_a_type_outside_the_allowlist_is_refused():
    with pytest.raises(attachments.AttachmentRejected) as refused:
        attachments.accept(
            content=b"MZ\x90\x00", declared_type="application/x-msdownload", filename="x.exe",
        )
    assert refused.value.reason == "type_not_allowed"


def test_the_attachment_count_is_bounded():
    with pytest.raises(attachments.AttachmentRejected) as refused:
        attachments.accept(
            content=b"\x89PNG\r\n\x1a\n", declared_type="image/png", filename="a.png",
            existing=attachments.MAX_ATTACHMENTS,
        )
    assert refused.value.reason == "too_many_attachments"


def test_a_valid_attachment_is_accepted_and_identified_by_content():
    descriptor = attachments.accept(
        content=b"\x89PNG\r\n\x1a\n" + b"data", declared_type="image/png",
        filename="Zählerstand.png",
    )
    assert descriptor["type"] == "image/png"
    assert descriptor["id"].startswith("attachment-")
    assert descriptor["bytes"] == 12
