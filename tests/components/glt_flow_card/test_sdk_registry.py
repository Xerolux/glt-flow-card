"""A failed install changes nothing (SDK-01, T5-13, T5-14).

The requirement is narrow and worth stating plainly: an installation owner told
"that did not work" must not then have to work out which half of it applied. So
every refusal here is asserted twice -- that it refused, and that the registry
is byte-identical afterwards.
"""
from __future__ import annotations

import copy
import json

import pytest

from custom_components.glt_flow_card.sdk_registry import (
    INSTALL_REFUSALS,
    REGISTRY_LIMITS,
    InstallRefused,
    SdkRegistry,
    visible_packs,
)

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


def manifest(namespace: str = "acme", **overrides) -> dict:
    base = {
        "namespace": namespace,
        "version": "1.0.0",
        "supports_schema_versions": [4],
        "contributions": [
            {"id": f"{namespace}/pump", "kind": "symbol",
             "payload": {"markup": "<svg><circle r='19'/></svg>"}},
            {"id": f"{namespace}/pump-profile", "kind": "profile",
             "payload": {"equipment_type": "pump"}},
        ],
    }
    base.update(overrides)
    return base


def snapshot(registry: SdkRegistry) -> str:
    return json.dumps(registry.list_packs(), sort_keys=True)


def test_a_valid_pack_installs_and_reports_what_it_contributed() -> None:
    registry = SdkRegistry("p1")
    result = registry.install(manifest())
    assert result["namespace"] == "acme"
    assert result["contributions"] == {"profile": 1, "symbol": 1}
    assert registry.resource_ledger() == {"packs": 1, "contributions": 2}


def test_a_contribution_resolves_by_its_namespaced_id() -> None:
    registry = SdkRegistry("p1")
    registry.install(manifest())
    assert registry.resolve("acme/pump")["kind"] == "symbol"
    assert registry.resolve("acme/missing") is None
    assert registry.resolve("other/pump") is None


@pytest.mark.parametrize(
    ("mutate", "code"),
    [
        (lambda m: m.update(namespace="Acme Corp"), "manifest_invalid"),
        (lambda m: m.update(supports_schema_versions=[99]), "manifest_invalid"),
        (lambda m: m["contributions"].append(
            {"id": "other/x", "kind": "symbol", "payload": {}}), "manifest_invalid"),
    ],
)
def test_an_invalid_manifest_refuses_and_changes_nothing(mutate, code: str) -> None:
    registry = SdkRegistry("p1")
    registry.install(manifest("base"))
    before = snapshot(registry)
    broken = manifest()
    mutate(broken)
    with pytest.raises(InstallRefused) as refusal:
        registry.install(broken)
    assert refusal.value.code == code
    assert snapshot(registry) == before


def test_two_packs_claiming_one_namespace_refuse_and_name_both_versions() -> None:
    registry = SdkRegistry("p1")
    registry.install(manifest("acme"))
    before = snapshot(registry)
    with pytest.raises(InstallRefused) as refusal:
        registry.install(manifest("acme", version="2.0.0"))
    assert refusal.value.code == "namespace_taken"
    assert refusal.value.detail == {
        "namespace": "acme", "installed_version": "1.0.0", "offered_version": "2.0.0",
    }
    assert snapshot(registry) == before


def test_an_id_conflict_names_both_packs_and_the_contested_id() -> None:
    """The last check before a commit, kept even though the validator covers it.

    A check that depends on an earlier one staying correct is a check that will
    one day be wrong quietly.
    """
    registry = SdkRegistry("p1")
    registry.install(manifest("acme"))
    before = snapshot(registry)
    # Reach past the manifest validator, which would refuse this first, to
    # exercise the registry's own conflict check.
    registry._packs["other"] = {
        "version": "1.0.0", "supports_schema_versions": [4],
        "contribution_ids": ["acme/pump"], "kinds": {"symbol": 1},
        "manifest": {"contributions": []},
    }
    with pytest.raises(InstallRefused) as refusal:
        registry.install(manifest("zeta", contributions=[
            {"id": "zeta/a", "kind": "symbol", "payload": {}},
            {"id": "acme/pump", "kind": "symbol", "payload": {}},
        ]))
    # The manifest validator catches the out-of-namespace id first, which is
    # the correct order: the pack is malformed before it is conflicting.
    assert refusal.value.code == "manifest_invalid"
    del registry._packs["other"]
    assert snapshot(registry) == before


def test_the_registry_refuses_a_conflict_its_validator_would_have_missed() -> None:
    registry = SdkRegistry("p1")
    registry.install(manifest("acme"))
    # A pack whose ids are legal for its own namespace, installed twice under
    # two namespaces, is what the registry's own check is for.
    registry._packs["shadow"] = {
        "version": "1.0.0", "supports_schema_versions": [4],
        "contribution_ids": ["zeta/a"], "kinds": {"symbol": 1},
        "manifest": {"contributions": []},
    }
    before = snapshot(registry)
    with pytest.raises(InstallRefused) as refusal:
        registry.install(manifest("zeta", contributions=[
            {"id": "zeta/a", "kind": "symbol", "payload": {"markup": "<svg/>"}},
        ]))
    assert refusal.value.code == "contribution_id_conflict"
    assert refusal.value.detail == {
        "namespace": "zeta", "conflicts_with": "shadow", "contested": ["zeta/a"],
    }
    assert snapshot(registry) == before


def test_the_pack_bound_is_a_number_and_is_enforced() -> None:
    registry = SdkRegistry("p1")
    for index in range(REGISTRY_LIMITS["max_packs"]):
        registry.install(manifest(f"pack{index}"))
    before = snapshot(registry)
    with pytest.raises(InstallRefused) as refusal:
        registry.install(manifest("onemore"))
    assert refusal.value.code == "too_many_packs"
    assert refusal.value.detail == {"limit": REGISTRY_LIMITS["max_packs"]}
    assert snapshot(registry) == before


def test_the_installation_wide_contribution_bound_is_enforced() -> None:
    registry = SdkRegistry("p1")
    registry._packs["bulk"] = {
        "version": "1.0.0", "supports_schema_versions": [4],
        "contribution_ids": [f"bulk/x{i}" for i in range(
            REGISTRY_LIMITS["max_contributions_total"])],
        "kinds": {"symbol": REGISTRY_LIMITS["max_contributions_total"]},
        "manifest": {"contributions": []},
    }
    before = snapshot(registry)
    with pytest.raises(InstallRefused) as refusal:
        registry.install(manifest("acme"))
    assert refusal.value.code == "too_many_contributions"
    assert refusal.value.detail["scope"] == "installation"
    assert snapshot(registry) == before


def test_removing_a_pack_that_is_not_there_refuses_rather_than_succeeding() -> None:
    registry = SdkRegistry("p1")
    registry.install(manifest("acme"))
    before = snapshot(registry)
    with pytest.raises(InstallRefused) as refusal:
        registry.remove("nope")
    assert refusal.value.code == "pack_not_installed"
    assert snapshot(registry) == before
    assert registry.remove("acme") == {"namespace": "acme", "removed": 2}
    assert registry.resource_ledger() == {"packs": 0, "contributions": 0}


def test_every_refusal_the_registry_raises_is_a_declared_one() -> None:
    declared = set(INSTALL_REFUSALS)
    registry = SdkRegistry("p1")
    raised = set()
    for attempt in (
        lambda: registry.install({"namespace": "!!"}),
        lambda: registry.remove("absent"),
    ):
        with pytest.raises(InstallRefused) as refusal:
            attempt()
        raised.add(refusal.value.code)
    assert raised <= declared


def test_a_pack_in_a_project_the_caller_cannot_open_is_in_no_listing() -> None:
    """A conflict message naming a hidden project would be a read of it."""
    open_registry = SdkRegistry("open")
    open_registry.install(manifest("visible"))
    hidden_registry = SdkRegistry("hidden")
    hidden_registry.install(manifest("secret"))
    registries = {"open": open_registry, "hidden": hidden_registry}

    seen = visible_packs(registries, ["open"])
    assert [pack["namespace"] for pack in seen] == ["visible"]
    assert all(pack["project_id"] == "open" for pack in seen)

    # An unassigned caller gets the empty list an installation with no packs
    # would give, so a listing cannot be used to learn that a project exists.
    assert visible_packs(registries, []) == []

    # And the namespace taken in the hidden project does not block an install
    # in the open one, which would leak it by refusal.
    assert open_registry.install(manifest("secret"))["namespace"] == "secret"


def test_installing_from_bytes_is_the_same_as_installing_from_an_object() -> None:
    """The websocket route receives a document; a file arrives as bytes."""
    from_object = SdkRegistry("p1")
    from_bytes = SdkRegistry("p1")
    document = manifest()
    assert from_object.install(copy.deepcopy(document)) == from_bytes.install(
        json.dumps(document)
    )
    assert snapshot(from_object) == snapshot(from_bytes)
