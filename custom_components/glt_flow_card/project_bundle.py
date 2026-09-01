"""Bounded `.gltproject` preflight and opaque-byte import for the Companion."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import shutil
import stat
import struct
import sys
import tempfile
import unicodedata
import zipfile
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from . import project_contract
from .project_contract import canonicalize_json, evaluate_project_contract
from .project_migrations import migrate_project_document

_MAX_COMPRESSED_BYTES = 33_554_432
_MAX_ENTRIES = 256
_MAX_ASSET_BYTES = 16_777_216
_MAX_EXPANDED_BYTES = 134_217_728
_MAX_COMPRESSION_RATIO = 100
_MAX_JSON_BYTES = 5_242_880
_MAX_PATH_CHARS = 512
_MANIFEST_VALIDATOR = Draft202012Validator(
    project_contract._ALL_SCHEMAS[3], registry=project_contract._REGISTRY
)


class BundleError(ValueError):
    """Stable archive rejection with a cross-runtime code and pointer."""

    def __init__(self, code: str, path: str, params: Mapping[str, Any] | None = None) -> None:
        super().__init__(f"{code} at {path}")
        self.code = code
        self.path = path
        self.params = dict(sorted((params or {}).items()))

    def as_dict(self) -> dict[str, Any]:
        return {"code": self.code, "path": self.path, "params": self.params}


def _fail(code: str, path: str, params: Mapping[str, Any] | None = None) -> None:
    raise BundleError(code, path, params)


def _u16(raw: bytes, offset: int) -> int:
    if offset < 0 or offset + 2 > len(raw):
        _fail("bundle.manifest_mismatch", "/archive", {"reason": "truncated"})
    return struct.unpack_from("<H", raw, offset)[0]


def _u32(raw: bytes, offset: int) -> int:
    if offset < 0 or offset + 4 > len(raw):
        _fail("bundle.manifest_mismatch", "/archive", {"reason": "truncated"})
    return struct.unpack_from("<I", raw, offset)[0]


def _decode_name(raw_name: bytes) -> str:
    try:
        if all(value < 0x80 for value in raw_name):
            return raw_name.decode("ascii")
        return raw_name.decode("utf-8")
    except UnicodeDecodeError:
        _fail("bundle.path_control", "/archive", {"reason": "invalid_filename_encoding"})


def _normalize_path(raw_path: str, index: int) -> str:
    path = str(raw_path)
    pointer = f"/entries/{index}/path"
    if path.startswith("/") or (len(path) >= 2 and path[0].isalpha() and path[1] == ":"):
        _fail("bundle.path_absolute", pointer, {"path": path})
    if "\\" in path:
        _fail("bundle.path_backslash", pointer, {"path": path})
    if any(ord(char) < 32 or 127 <= ord(char) <= 159 for char in path):
        _fail("bundle.path_control", pointer, {"path": path})
    normalized = unicodedata.normalize("NFC", path)
    parts = normalized.split("/")
    if not normalized or any(part in ("", ".", "..") for part in parts):
        _fail("bundle.path_traversal", pointer, {"path": path})
    if len(normalized) > _MAX_PATH_CHARS:
        _fail("bundle.path_traversal", pointer, {"path": path, "limit": _MAX_PATH_CHARS})
    return normalized


def _find_end_record(raw: bytes) -> int:
    minimum = max(0, len(raw) - 65_557)
    for offset in range(len(raw) - 22, minimum - 1, -1):
        if _u32(raw, offset) != 0x06054B50:
            continue
        if offset + 22 + _u16(raw, offset + 20) == len(raw):
            return offset
    _fail("bundle.manifest_mismatch", "/archive", {"reason": "missing_end_record"})


def _entry_type(version_made_by: int, external_attributes: int, name: str, index: int) -> None:
    platform = version_made_by >> 8
    unix_type = stat.S_IFMT(external_attributes >> 16) if platform == 3 else 0
    dos_directory = bool(external_attributes & 0x10)
    if name.endswith("/") or dos_directory or unix_type not in (0, stat.S_IFREG):
        _fail(
            "bundle.entry_type",
            f"/entries/{index}/type",
            {"path": name, "type": unix_type or "directory"},
        )


def _preflight_central_directory(raw_input: bytes | bytearray | memoryview) -> dict[str, Any]:
    raw = bytes(raw_input)
    if len(raw) > _MAX_COMPRESSED_BYTES:
        _fail(
            "bundle.compressed_bytes",
            "/archive/compressed_bytes",
            {"actual": len(raw), "limit": _MAX_COMPRESSED_BYTES},
        )
    end_offset = _find_end_record(raw)
    disk = _u16(raw, end_offset + 4)
    central_disk = _u16(raw, end_offset + 6)
    disk_entries = _u16(raw, end_offset + 8)
    entry_count = _u16(raw, end_offset + 10)
    central_size = _u32(raw, end_offset + 12)
    central_offset = _u32(raw, end_offset + 16)
    if (
        disk != 0
        or central_disk != 0
        or disk_entries != entry_count
        or central_offset + central_size != end_offset
    ):
        _fail(
            "bundle.manifest_mismatch",
            "/archive",
            {"reason": "ambiguous_central_directory"},
        )
    if entry_count > _MAX_ENTRIES:
        _fail(
            "bundle.entry_count",
            "/archive/entries",
            {"actual": entry_count, "limit": _MAX_ENTRIES},
        )

    entries: list[dict[str, Any]] = []
    cursor = central_offset
    for index in range(entry_count):
        if _u32(raw, cursor) != 0x02014B50:
            _fail("bundle.manifest_mismatch", "/archive", {"reason": "invalid_central_entry"})
        version_made_by = _u16(raw, cursor + 4)
        flags = _u16(raw, cursor + 8)
        method = _u16(raw, cursor + 10)
        crc32 = _u32(raw, cursor + 16)
        compressed_size = _u32(raw, cursor + 20)
        uncompressed_size = _u32(raw, cursor + 24)
        name_length = _u16(raw, cursor + 28)
        extra_length = _u16(raw, cursor + 30)
        comment_length = _u16(raw, cursor + 32)
        external_attributes = _u32(raw, cursor + 38)
        local_offset = _u32(raw, cursor + 42)
        end = cursor + 46 + name_length + extra_length + comment_length
        if end > end_offset:
            _fail("bundle.manifest_mismatch", "/archive", {"reason": "truncated_central_entry"})
        raw_name = raw[cursor + 46 : cursor + 46 + name_length]
        name = _normalize_path(_decode_name(raw_name), index)
        _entry_type(version_made_by, external_attributes, name, index)
        if flags & 1:
            _fail("bundle.encrypted", f"/entries/{index}/encrypted", {"path": name})
        if method not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            _fail(
                "bundle.compression_method",
                f"/entries/{index}/compression",
                {"actual": method, "allowed": [0, 8]},
            )
        entries.append(
            {
                "index": index,
                "name": name,
                "raw_name": raw_name,
                "flags": flags,
                "method": method,
                "crc32": crc32,
                "compressed_size": compressed_size,
                "uncompressed_size": uncompressed_size,
                "local_offset": local_offset,
            }
        )
        cursor = end
    if cursor != end_offset:
        _fail("bundle.manifest_mismatch", "/archive", {"reason": "trailing_central_data"})

    names: set[str] = set()
    folded: set[str] = set()
    for entry in entries:
        if entry["name"] in names:
            _fail(
                "bundle.path_duplicate",
                f'/entries/{entry["index"]}/path',
                {"path": entry["name"]},
            )
        case_key = entry["name"].lower()
        if case_key in folded:
            _fail(
                "bundle.case_collision",
                f'/entries/{entry["index"]}/path',
                {"path": entry["name"]},
            )
        names.add(entry["name"])
        folded.add(case_key)
    by_name = sorted(entries, key=lambda entry: entry["name"])
    for previous, current in zip(by_name, by_name[1:], strict=False):
        if current["name"].startswith(f'{previous["name"]}/'):
            _fail(
                "bundle.entry_overlap",
                f'/entries/{current["index"]}/path',
                {"path": current["name"], "prefix": previous["name"]},
            )

    expanded_bytes = sum(entry["uncompressed_size"] for entry in entries)
    compressed_bytes = sum(entry["compressed_size"] for entry in entries)
    if compressed_bytes > _MAX_COMPRESSED_BYTES:
        _fail(
            "bundle.compressed_bytes",
            "/archive/compressed_bytes",
            {"actual": compressed_bytes, "limit": _MAX_COMPRESSED_BYTES},
        )
    if expanded_bytes > _MAX_EXPANDED_BYTES:
        _fail(
            "bundle.expanded_bytes",
            "/archive/expanded_bytes",
            {"actual": expanded_bytes, "limit": _MAX_EXPANDED_BYTES},
        )
    for entry in entries:
        pointer = f'/entries/{entry["index"]}'
        is_json = entry["name"] in ("manifest.json", "project.json")
        maximum = _MAX_JSON_BYTES if is_json else _MAX_ASSET_BYTES
        if entry["uncompressed_size"] > maximum:
            _fail(
                "bundle.expanded_bytes" if is_json else "bundle.asset_bytes",
                f"{pointer}/uncompressed_size",
                {"actual": entry["uncompressed_size"], "limit": maximum},
            )
        ratio = entry["uncompressed_size"] / max(1, entry["compressed_size"])
        if ratio > _MAX_COMPRESSION_RATIO:
            _fail(
                "bundle.compression_ratio",
                f"{pointer}/compression_ratio",
                {"actual": ratio, "limit": _MAX_COMPRESSION_RATIO},
            )

    intervals: list[dict[str, int]] = []
    for entry in entries:
        offset = entry["local_offset"]
        if offset >= central_offset or _u32(raw, offset) != 0x04034B50:
            _fail("bundle.entry_overlap", f'/entries/{entry["index"]}/offset', {"offset": offset})
        flags = _u16(raw, offset + 6)
        method = _u16(raw, offset + 8)
        local_crc = _u32(raw, offset + 14)
        local_compressed = _u32(raw, offset + 18)
        local_expanded = _u32(raw, offset + 22)
        name_length = _u16(raw, offset + 26)
        extra_length = _u16(raw, offset + 28)
        raw_name = raw[offset + 30 : offset + 30 + name_length]
        descriptor = bool(flags & 8)
        if not descriptor and local_crc != entry["crc32"]:
            _fail(
                "bundle.crc",
                f'/entries/{entry["index"]}/crc32',
                {"path": entry["name"]},
            )
        matches = (
            raw_name == entry["raw_name"]
            and flags == entry["flags"]
            and method == entry["method"]
            and (
                descriptor
                or (
                    local_compressed == entry["compressed_size"]
                    and local_expanded == entry["uncompressed_size"]
                )
            )
        )
        if not matches:
            _fail(
                "bundle.entry_overlap",
                f'/entries/{entry["index"]}/offset',
                {"offset": offset, "reason": "local_header_mismatch"},
            )
        data_start = offset + 30 + name_length + extra_length
        data_end = data_start + entry["compressed_size"]
        if data_end > central_offset:
            _fail("bundle.entry_overlap", f'/entries/{entry["index"]}/offset', {"offset": offset})
        intervals.append({"start": offset, "end": data_end, "index": entry["index"]})
    intervals.sort(key=lambda item: (item["start"], item["index"]))
    if intervals and intervals[0]["start"] != 0:
        _fail(
            "bundle.entry_overlap",
            f'/entries/{intervals[0]["index"]}/offset',
            {"reason": "prepended_data"},
        )
    for previous, current in zip(intervals, intervals[1:], strict=False):
        if current["start"] < previous["end"]:
            _fail(
                "bundle.entry_overlap",
                f'/entries/{current["index"]}/offset',
                {"offset": current["start"]},
            )
    return {"raw": raw, "entries": entries}


def _canonical_document(raw: bytes, path: str) -> tuple[dict[str, Any], str]:
    try:
        text = raw.decode("utf-8")
        document = json.loads(text)
    except (UnicodeDecodeError, json.JSONDecodeError):
        _fail("bundle.manifest_mismatch", path, {"reason": "invalid_json"})
    try:
        canonical = canonicalize_json(document)
    except (TypeError, UnicodeEncodeError):
        _fail("bundle.manifest_mismatch", path, {"reason": "noncanonical_json"})
    if text != canonical:
        _fail("bundle.manifest_mismatch", path, {"reason": "noncanonical_json"})
    return document, canonical


def _manifest_error_path(error: Any) -> str:
    parts = list(error.absolute_path)
    if error.validator == "required":
        missing = next((key for key in error.validator_value if key not in error.instance), "unknown")
        parts.append(missing)
    suffix = "".join(f"/{part}" for part in parts)
    return f"/manifest{suffix}"


def _verified_contents(preflight: Mapping[str, Any]) -> dict[str, bytes]:
    contents: dict[str, bytes] = {}
    try:
        with zipfile.ZipFile(io.BytesIO(preflight["raw"]), "r", metadata_encoding="cp437") as bundle:
            infos = bundle.infolist()
            if len(infos) != len(preflight["entries"]):
                _fail("bundle.manifest_mismatch", "/archive", {"reason": "entry_count_changed"})
            for metadata, info in zip(preflight["entries"], infos, strict=True):
                try:
                    with bundle.open(info, "r") as member:
                        data = member.read(metadata["uncompressed_size"] + 1)
                except (zipfile.BadZipFile, RuntimeError, NotImplementedError):
                    _fail(
                        "bundle.crc",
                        f'/entries/{metadata["index"]}/crc32',
                        {"path": metadata["name"]},
                    )
                if len(data) != metadata["uncompressed_size"]:
                    _fail(
                        "bundle.crc",
                        f'/entries/{metadata["index"]}/crc32',
                        {"path": metadata["name"]},
                    )
                contents[metadata["name"]] = data
    except BundleError:
        raise
    except (zipfile.BadZipFile, ValueError, NotImplementedError):
        _fail("bundle.manifest_mismatch", "/archive", {"reason": "invalid_zip"})
    return contents


def read_project_bundle(
    raw_input: bytes | bytearray | memoryview,
    *,
    on_extract: Callable[[str, bytes], Any] | None = None,
) -> dict[str, Any]:
    """Validate the complete archive before returning or exposing any member bytes."""

    preflight = _preflight_central_directory(raw_input)
    contents = _verified_contents(preflight)
    manifest_bytes = contents.get("manifest.json")
    project_bytes = contents.get("project.json")
    if manifest_bytes is None or project_bytes is None:
        _fail("bundle.manifest_mismatch", "/manifest", {"reason": "required_member_missing"})
    manifest, _ = _canonical_document(manifest_bytes, "/manifest")
    manifest_errors = sorted(_MANIFEST_VALIDATOR.iter_errors(manifest), key=lambda error: list(error.absolute_path))
    if manifest_errors:
        first = manifest_errors[0]
        _fail("bundle.manifest_mismatch", _manifest_error_path(first), {"keyword": first.validator or "schema"})
    project, canonical_project = _canonical_document(project_bytes, "/project")
    project_evidence = evaluate_project_contract(project_bytes)
    if not project_evidence["valid"]:
        first = project_evidence["errors"][0]
        _fail(first["code"], first["path"], first["params"])
    if project_evidence["canonical"] != canonical_project:
        _fail("bundle.manifest_mismatch", "/project", {"reason": "canonical_evidence_mismatch"})
    if (
        manifest["project"]["id"] != project.get("project", {}).get("id")
        or manifest["project"]["schema_version"] != project_evidence["schema_version"]
    ):
        _fail(
            "bundle.manifest_mismatch",
            "/manifest/project/id",
            {
                "manifest_project_id": manifest["project"]["id"],
                "project_id": project.get("project", {}).get("id"),
            },
        )
    if manifest["project"]["size"] != len(project_bytes):
        _fail(
            "bundle.manifest_mismatch",
            "/manifest/project/size",
            {"actual": len(project_bytes), "declared": manifest["project"]["size"]},
        )
    if hashlib.sha256(project_bytes).hexdigest() != manifest["project"]["sha256"]:
        _fail("bundle.hash", "/manifest/project/sha256", {"path": "project.json"})

    archive_assets = [
        entry for entry in preflight["entries"] if entry["name"] not in ("manifest.json", "project.json")
    ]
    declared_by_path = {asset["path"]: asset for asset in manifest["assets"]}
    project_assets = project.get("assets", []) if isinstance(project.get("assets"), list) else []
    project_by_path = {asset.get("path"): asset for asset in project_assets if isinstance(asset, dict)}
    for index, declared in enumerate(manifest["assets"]):
        metadata = next((entry for entry in preflight["entries"] if entry["name"] == declared["path"]), None)
        if metadata is None:
            _fail("bundle.asset_missing", f"/manifest/assets/{index}/path", {"path": declared["path"]})
        project_asset = project_by_path.get(declared["path"])
        if not project_asset or project_asset.get("id") != declared["id"]:
            _fail("bundle.manifest_mismatch", f"/manifest/assets/{index}/id", {"path": declared["path"]})
        data = contents[declared["path"]]
        if declared["size"] != len(data):
            _fail("bundle.manifest_mismatch", f"/manifest/assets/{index}/size", {"path": declared["path"]})
        compression = "store" if metadata["method"] == zipfile.ZIP_STORED else "deflate"
        if declared["compression"] != compression:
            _fail("bundle.manifest_mismatch", f"/manifest/assets/{index}/compression", {"path": declared["path"]})
        if hashlib.sha256(data).hexdigest() != declared["sha256"]:
            _fail("bundle.hash", f"/manifest/assets/{index}/sha256", {"path": declared["path"]})
        if project_asset.get("media_type") is not None and project_asset["media_type"] != declared["media_type"]:
            _fail("bundle.manifest_mismatch", f"/manifest/assets/{index}/media_type", {"path": declared["path"]})
    for metadata in archive_assets:
        if metadata["name"] not in declared_by_path:
            _fail(
                "bundle.asset_unreferenced",
                f'/entries/{metadata["index"]}/path',
                {"path": metadata["name"]},
            )
    if len(project_assets) != len(manifest["assets"]):
        _fail("bundle.manifest_mismatch", "/manifest/assets", {"reason": "project_asset_closure"})

    assets = [
        {
            "id": asset["id"],
            "path": asset["path"],
            "media_type": asset["media_type"],
            "sha256": asset["sha256"],
            "size": asset["size"],
            "compression": asset["compression"],
            "bytes": bytes(contents[asset["path"]]),
        }
        for asset in manifest["assets"]
    ]
    if on_extract is not None:
        for metadata in preflight["entries"]:
            on_extract(metadata["name"], bytes(contents[metadata["name"]]))
    return {
        "manifest": json.loads(canonicalize_json(manifest)),
        "project": json.loads(canonical_project),
        "project_bytes": bytes(project_bytes),
        "assets": assets,
        "entries": [
            {
                "path": entry["name"],
                "compression": "store" if entry["method"] == 0 else "deflate",
                "compressed_size": entry["compressed_size"],
                "uncompressed_size": entry["uncompressed_size"],
            }
            for entry in preflight["entries"]
        ],
    }


def bundle_decision(raw_input: bytes | bytearray | memoryview) -> dict[str, Any]:
    """Return the stable cross-runtime accept/reject decision without asset bytes."""

    try:
        read_project_bundle(raw_input)
        return {"outcome": "accept", "code": None, "path": "/", "params": {}}
    except BundleError as error:
        return {"outcome": "reject", **error.as_dict()}


def extract_project_bundle(
    raw_input: bytes | bytearray | memoryview,
    transaction_parent: str | Path,
) -> dict[str, Any]:
    """Preflight fully, then write into one new contained transaction directory."""

    restored = read_project_bundle(raw_input)
    parent = Path(transaction_parent).resolve(strict=True)
    if not parent.is_dir():
        raise ValueError("transaction parent must be a directory")
    transaction = Path(tempfile.mkdtemp(prefix=".gltproject-", dir=parent)).resolve(strict=True)
    try:
        members = [
            ("manifest.json", canonicalize_json(restored["manifest"]).encode("utf-8")),
            ("project.json", restored["project_bytes"]),
            *((asset["path"], asset["bytes"]) for asset in restored["assets"]),
        ]
        for name, data in members:
            destination = (transaction / Path(*name.split("/"))).resolve(strict=False)
            if transaction not in destination.parents:
                _fail("bundle.path_traversal", "/transaction", {"path": name})
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open("xb") as member:
                member.write(data)
        return {**restored, "transaction_directory": transaction}
    except Exception:
        shutil.rmtree(transaction)
        raise


def _asset_bytes(value: Any) -> bytes:
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value)
    raise TypeError("asset bytes must be bytes-like")


def _export_documents(raw_project: Any, raw_assets: list[Mapping[str, Any]]) -> dict[str, Any]:
    migrated = migrate_project_document(raw_project, dry_run=True)["candidate"]
    project_assets = migrated.get("assets", []) if isinstance(migrated.get("assets"), list) else []
    if not isinstance(raw_assets, list):
        raise TypeError("assets must be an array")
    sources: list[dict[str, Any]] = []
    source_ids: set[str] = set()
    source_paths: set[str] = set()
    for index, raw_asset in enumerate(raw_assets):
        if not isinstance(raw_asset, Mapping):
            raise TypeError(f"asset {index} must be an object")
        asset_id = str(raw_asset.get("id") or "")
        path = _normalize_path(str(raw_asset.get("path") or ""), index + 2)
        media_type = str(raw_asset.get("media_type") or "")
        compression = raw_asset.get("compression", "store")
        if not asset_id or len(asset_id) > 128 or not all(
            char.isascii() and (char.isalnum() or char in "._:-") for char in asset_id
        ):
            _fail("bundle.manifest_mismatch", f"/manifest/assets/{index}/id", {"id": asset_id})
        media_parts = media_type.split("/")
        allowed_media_chars = set("abcdefghijklmnopqrstuvwxyz0123456789.+-")
        if (
            len(media_parts) != 2
            or not all(part and set(part) <= allowed_media_chars for part in media_parts)
            or len(media_type) > 128
        ):
            _fail(
                "bundle.manifest_mismatch",
                f"/manifest/assets/{index}/media_type",
                {"media_type": media_type},
            )
        if compression not in ("store", "deflate"):
            _fail(
                "bundle.compression_method",
                f"/manifest/assets/{index}/compression",
                {"actual": compression},
            )
        if asset_id in source_ids or path in source_paths:
            _fail("bundle.path_duplicate", f"/manifest/assets/{index}/path", {"path": path})
        data = _asset_bytes(raw_asset.get("bytes"))
        if len(data) > _MAX_ASSET_BYTES:
            _fail(
                "bundle.asset_bytes",
                f"/manifest/assets/{index}/size",
                {"actual": len(data), "limit": _MAX_ASSET_BYTES},
            )
        source_ids.add(asset_id)
        source_paths.add(path)
        sources.append(
            {
                "id": asset_id,
                "path": path,
                "media_type": media_type,
                "compression": compression,
                "bytes": data,
                "sha256": hashlib.sha256(data).hexdigest(),
                "size": len(data),
            }
        )
    sources.sort(key=lambda source: source["path"])
    project_by_id = {
        asset.get("id"): asset for asset in project_assets if isinstance(asset, Mapping)
    }
    if len(project_assets) != len(sources):
        _fail("bundle.manifest_mismatch", "/manifest/assets", {"reason": "project_asset_closure"})
    enriched_assets: list[dict[str, Any]] = []
    for index, source in enumerate(sources):
        project_asset = project_by_id.get(source["id"])
        if not project_asset or project_asset.get("path") != source["path"]:
            _fail(
                "bundle.manifest_mismatch",
                f"/manifest/assets/{index}/id",
                {"id": source["id"], "path": source["path"]},
            )
        if project_asset.get("media_type") is not None and project_asset["media_type"] != source["media_type"]:
            _fail(
                "bundle.manifest_mismatch",
                f"/manifest/assets/{index}/media_type",
                {"path": source["path"]},
            )
        enriched_assets.append(
            {
                **project_asset,
                "id": source["id"],
                "path": source["path"],
                "media_type": source["media_type"],
                "sha256": source["sha256"],
                "size": source["size"],
            }
        )
    project = json.loads(canonicalize_json({**migrated, "assets": enriched_assets}))
    evidence = evaluate_project_contract(project)
    if not evidence["valid"]:
        first = evidence["errors"][0]
        _fail(first["code"], first["path"], first["params"])
    project_bytes = evidence["canonical"].encode("utf-8")
    manifest = {
        "format": "gltproject",
        "bundle_version": 1,
        "project": {
            "id": project["project"]["id"],
            "path": "project.json",
            "schema_version": evidence["schema_version"],
            "sha256": hashlib.sha256(project_bytes).hexdigest(),
            "size": len(project_bytes),
        },
        "assets": [
            {key: value for key, value in source.items() if key != "bytes"}
            for source in sources
        ],
    }
    manifest_errors = list(_MANIFEST_VALIDATOR.iter_errors(manifest))
    if manifest_errors:
        first = sorted(manifest_errors, key=lambda error: list(error.absolute_path))[0]
        _fail("bundle.manifest_mismatch", _manifest_error_path(first), {"keyword": first.validator or "schema"})
    return {
        "manifest": manifest,
        "manifest_bytes": canonicalize_json(manifest).encode("utf-8"),
        "project": project,
        "project_bytes": project_bytes,
        "sources": sources,
    }


def _zip_info(path: str, compression: int) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(path, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = compression
    info.create_system = 0
    info.create_version = 20
    info.extract_version = 20
    info.external_attr = 0
    info.internal_attr = 0
    info.comment = b""
    info.extra = b""
    return info


def write_project_bundle(raw_project: Any, assets: list[Mapping[str, Any]] | None = None) -> bytes:
    """Create a deterministic bundle without parsing or inspecting asset contents."""

    documents = _export_documents(raw_project, assets or [])
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", allowZip64=False) as bundle:
        bundle.writestr(_zip_info("manifest.json", zipfile.ZIP_STORED), documents["manifest_bytes"])
        bundle.writestr(_zip_info("project.json", zipfile.ZIP_STORED), documents["project_bytes"])
        for source in documents["sources"]:
            compression = zipfile.ZIP_STORED if source["compression"] == "store" else zipfile.ZIP_DEFLATED
            bundle.writestr(
                _zip_info(source["path"], compression),
                source["bytes"],
                compress_type=compression,
                compresslevel=None if compression == zipfile.ZIP_STORED else 6,
            )
    return output.getvalue()


def _json_lines() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    for line in sys.stdin:
        if not line.strip():
            continue
        request = json.loads(line)
        action = request.get("action", "decision")
        if action == "write":
            assets = [
                {
                    **{key: value for key, value in asset.items() if key != "bytes_base64"},
                    "bytes": base64.b64decode(asset["bytes_base64"], validate=True),
                }
                for asset in request.get("assets", [])
            ]
            archive = write_project_bundle(request["project"], assets)
            response = {
                "id": request["id"],
                "archive_base64": base64.b64encode(archive).decode("ascii"),
            }
        else:
            raw = base64.b64decode(request["raw_base64"], validate=True)
            if action == "read":
                result = read_project_bundle(raw)
                response = {
                    "id": request["id"],
                    "result": {
                        "manifest": result["manifest"],
                        "project": result["project"],
                        "project_base64": base64.b64encode(result["project_bytes"]).decode("ascii"),
                        "assets": [
                            {
                                **{key: value for key, value in asset.items() if key != "bytes"},
                                "bytes_base64": base64.b64encode(asset["bytes"]).decode("ascii"),
                            }
                            for asset in result["assets"]
                        ],
                        "entries": result["entries"],
                    },
                }
            else:
                response = {"id": request["id"], "decision": bundle_decision(raw)}
        print(json.dumps(response, ensure_ascii=False, separators=(",", ":")), flush=True)


if __name__ == "__main__" and "--json-lines" in sys.argv:
    _json_lines()
