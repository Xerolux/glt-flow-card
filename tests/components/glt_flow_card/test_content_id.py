"""Record identity is derived from content, not from the clock (T8-22).

The browser side of this contract lives in `test/content-id.test.mjs`, which
compares canonical bytes across both runtimes. This side asserts the properties
that make the derivation worth having, computed here rather than compared to a
literal digest: a frozen digest would prove that today's implementation is
today's implementation and nothing about the property the record needs.
"""
from __future__ import annotations

import pytest

from custom_components.glt_flow_card.content_id import (
    ID_KINDS,
    ID_LENGTH,
    canonical_bytes,
    content_id,
)


def test_the_same_record_yields_the_same_id():
    """Re-creating a record must produce the identity it had before.

    This is the half of the defect that broke reproducibility. Reports are
    explicitly required to be reproducible and work-order history to be
    immutable; neither survives an identity that changes on every run.
    """
    payload = {"asset_id": "pump-1", "opened": "2027-06-01T00:00:00+02:00", "title": "Service"}
    assert content_id("work_order", payload) == content_id("work_order", dict(payload))


def test_key_order_does_not_change_an_id():
    """Two dictionaries with the same content are the same record."""
    first = {"asset_id": "pump-1", "title": "Service"}
    second = {"title": "Service", "asset_id": "pump-1"}
    assert content_id("work_order", first) == content_id("work_order", second)


def test_records_created_in_the_same_millisecond_do_not_collide():
    """The other half of the defect.

    `Date.now()` has millisecond resolution, so everything a loop creates gets
    one id. That is ordinary rather than exotic: importing a maintenance plan
    creates a work order per asset in a tight loop.
    """
    ids = {content_id("work_order", {"seq": index, "title": "Service"}) for index in range(500)}
    assert len(ids) == 500, "content-derived ids collided"


def test_a_nested_change_reaches_the_digest():
    """A digest that ignores nested values would give two records one identity."""
    base = {"actor": "u1", "nested": {"deep": {"flag": True, "n": 0}}}
    changed = {"actor": "u1", "nested": {"deep": {"flag": True, "n": 1}}}
    assert content_id("simulation_session", base) != content_id("simulation_session", changed)


def test_integral_floats_and_ints_are_one_record():
    """`0` and `0.0` are the same value and different bytes.

    That pair cost this project a cycle in 07-02, where it produced two
    canonical forms for one number. Here it would produce two ids for one
    record, which is the same bug with worse consequences.
    """
    assert canonical_bytes({"hours": 0}) == canonical_bytes({"hours": 0.0})
    assert content_id("maintenance_plan", {"hours": 2500}) == content_id(
        "maintenance_plan", {"hours": 2500.0},
    )


def test_an_id_says_what_it_identifies():
    """An id whose kind cannot be read is one nobody can trace back."""
    for kind in ID_KINDS:
        identifier = content_id(kind, {"probe": 1})
        assert identifier.startswith(f"{kind}-")
        assert len(identifier) == len(kind) + 1 + ID_LENGTH


def test_an_unknown_kind_is_refused_rather_than_prefixed():
    """A typo in a kind would silently create a parallel id space.

    Records would still get ids, nothing would fail, and two id spaces would
    coexist until somebody tried to look one up in the other.
    """
    with pytest.raises(ValueError, match="unknown_id_kind"):
        content_id("wrok_order", {"title": "Service"})
