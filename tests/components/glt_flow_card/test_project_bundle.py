"""Hostile archive behavior for safe GLT project bundles."""

from __future__ import annotations

import io
import json
import zipfile

import pytest

from custom_components.glt_flow_card.project_bundle import (
    BundleError,
    bundle_decision,
    read_project_bundle,
)
from custom_components.glt_flow_card.project_contract import canonicalize_json

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


def _archive(entries: list[tuple[zipfile.ZipInfo | str, bytes]]) -> bytes:
    output = io.BytesIO()
    replacements: list[tuple[bytes, bytes]] = []
    with zipfile.ZipFile(output, "w", allowZip64=False) as bundle:
        for name, data in entries:
            if isinstance(name, str) and ("\x00" in name or "\\" in name):
                hostile_name = name
                safe_name = name.replace("\x00", "X").replace("\\", "X")
                replacements.append((safe_name.encode(), hostile_name.encode()))
                name = safe_name
            bundle.writestr(name, data)
    raw = output.getvalue()
    for safe_name, hostile_name in replacements:
        raw = raw.replace(safe_name, hostile_name)
    return raw


def _assert_rejects(raw: bytes, code: str, path: str) -> None:
    exposed: list[str] = []
    with pytest.raises(BundleError) as caught:
        read_project_bundle(raw, on_extract=lambda name, _data: exposed.append(name))
    assert caught.value.code == code
    assert caught.value.path == path
    assert exposed == []


@pytest.mark.parametrize(
    ("name", "code"),
    [
        ("/etc/passwd", "bundle.path_absolute"),
        ("C:/Windows/win.ini", "bundle.path_absolute"),
        ("//server/share/file", "bundle.path_absolute"),
        ("assets/control\x00.svg", "bundle.path_control"),
        ("assets//pump.svg", "bundle.path_traversal"),
        ("assets/./pump.svg", "bundle.path_traversal"),
        ("assets/../project.json", "bundle.path_traversal"),
        ("assets\\pump.svg", "bundle.path_backslash"),
    ],
)
def test_rejects_path_aliases_before_extraction(name: str, code: str) -> None:
    _assert_rejects(_archive([(name, b"x")]), code, "/entries/0/path")


def test_rejects_symlink_duplicate_case_collision_and_prefix_overlap() -> None:
    symlink = zipfile.ZipInfo("assets/link.svg")
    symlink.create_system = 3
    symlink.external_attr = 0o120777 << 16
    _assert_rejects(_archive([(symlink, b"target")]), "bundle.entry_type", "/entries/0/type")
    _assert_rejects(_archive([("assets/a.svg", b"a"), ("assets/a.svg", b"b")]), "bundle.path_duplicate", "/entries/1/path")
    _assert_rejects(_archive([("assets/A.svg", b"a"), ("assets/a.svg", b"b")]), "bundle.case_collision", "/entries/1/path")
    _assert_rejects(_archive([("assets/a", b"a"), ("assets/a/file.svg", b"b")]), "bundle.entry_overlap", "/entries/1/path")


def test_rejects_encryption_method_count_and_ratio_limits() -> None:
    encrypted = bytearray(_archive([("project.json", b"x")]))
    encrypted[6] |= 1
    central = encrypted.index(b"PK\x01\x02")
    encrypted[central + 8] |= 1
    _assert_rejects(bytes(encrypted), "bundle.encrypted", "/entries/0/encrypted")

    method = bytearray(_archive([("project.json", b"x")]))
    method[8:10] = (12).to_bytes(2, "little")
    central = method.index(b"PK\x01\x02")
    method[central + 10:central + 12] = (12).to_bytes(2, "little")
    _assert_rejects(bytes(method), "bundle.compression_method", "/entries/0/compression")

    too_many = [(f"assets/{index}.bin", b"") for index in range(257)]
    _assert_rejects(_archive(too_many), "bundle.entry_count", "/archive/entries")

    ratio = bytearray(_archive([("assets/bomb.bin", b"x")]))
    ratio[22:26] = (101).to_bytes(4, "little")
    central = ratio.index(b"PK\x01\x02")
    ratio[central + 24:central + 28] = (101).to_bytes(4, "little")
    _assert_rejects(bytes(ratio), "bundle.compression_ratio", "/entries/0/compression_ratio")


def test_bundle_decision_is_stable_and_json_serializable() -> None:
    decision = bundle_decision(_archive([("../project.json", b"x")]))
    assert decision == {
        "outcome": "reject",
        "code": "bundle.path_traversal",
        "path": "/entries/0/path",
        "params": {"path": "../project.json"},
    }
    json.dumps(decision, ensure_ascii=False)


def test_rejects_noncanonical_manifest_before_any_member_is_exposed() -> None:
    manifest = {
        "format": "gltproject",
        "bundle_version": 1,
        "project": {
            "id": "bundle-project",
            "path": "project.json",
            "schema_version": 2,
            "sha256": "0" * 64,
            "size": 1,
        },
        "assets": [],
    }
    noncanonical = (canonicalize_json(manifest) + "\n").encode()
    _assert_rejects(
        _archive([("manifest.json", noncanonical), ("project.json", b"x")]),
        "bundle.manifest_mismatch",
        "/manifest",
    )
