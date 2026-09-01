import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { canonicalizeJson } from "../src/v100/project-contract.mjs";
import {
  bundleDecision,
  readProjectBundleArchive,
} from "../src/v100/project-bundle.mjs";

const encoder = new TextEncoder();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value & 0xffff);
  return bytes;
}

function u32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value >>> 0);
  return bytes;
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  const offsets = [];
  let offset = 0;
  for (const spec of entries) {
    const name = Buffer.from(spec.rawName || encoder.encode(spec.name));
    const data = Buffer.from(spec.data || []);
    const flags = spec.flags ?? 0x0800;
    const method = spec.method ?? 0;
    const signature = spec.crc ?? crc32(data);
    const compressedSize = spec.compressedSize ?? data.length;
    const uncompressedSize = spec.uncompressedSize ?? data.length;
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(flags), u16(method), u16(0), u16(0),
      u32(signature), u32(compressedSize), u32(uncompressedSize),
      u16(name.length), u16(0), name, data,
    ]);
    offsets.push(offset);
    locals.push(local);
    offset += local.length;
  }
  entries.forEach((spec, index) => {
    const name = Buffer.from(spec.rawName || encoder.encode(spec.name));
    const data = Buffer.from(spec.data || []);
    const flags = spec.flags ?? 0x0800;
    const method = spec.method ?? 0;
    const signature = spec.crc ?? crc32(data);
    const compressedSize = spec.compressedSize ?? data.length;
    const uncompressedSize = spec.uncompressedSize ?? data.length;
    centrals.push(Buffer.concat([
      u32(0x02014b50), u16(spec.versionMadeBy ?? 20), u16(20), u16(flags),
      u16(method), u16(0), u16(0), u32(signature), u32(compressedSize),
      u32(uncompressedSize), u16(name.length), u16(0), u16(0), u16(0),
      u16(0), u32(spec.externalAttributes ?? 0),
      u32(spec.localOffset ?? offsets[index]), name,
    ]));
  });
  const localBytes = Buffer.concat(locals);
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralBytes.length), u32(localBytes.length), u16(0),
  ]);
  return new Uint8Array(Buffer.concat([localBytes, centralBytes, end]));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonBytes(value) {
  return encoder.encode(canonicalizeJson(value));
}

function validProject(assets = []) {
  return {
    type: "custom:glt-flow-card",
    schema_version: 2,
    project: { id: "bundle-project", name: "Bundle Project", revision: 0 },
    assets: assets.map(({ bytes, compression, ...asset }) => asset),
    equipment: [],
    paths: [],
    datapoints: [],
    profiles: [],
    views: [],
  };
}

function validBundle({ assets = [], project = validProject(assets), manifestPatch = {} } = {}) {
  const projectBytes = jsonBytes(project);
  const manifest = {
    format: "gltproject",
    bundle_version: 1,
    project: {
      id: project.project.id,
      path: "project.json",
      schema_version: project.schema_version,
      sha256: sha256(projectBytes),
      size: projectBytes.length,
    },
    assets: assets.map((asset) => ({
      id: asset.id,
      path: asset.path,
      sha256: sha256(asset.bytes),
      size: asset.bytes.length,
      media_type: asset.media_type,
      compression: asset.compression || "store",
    })),
    ...manifestPatch,
  };
  return zip([
    { name: "manifest.json", data: jsonBytes(manifest) },
    { name: "project.json", data: projectBytes },
    ...assets.map((asset) => ({ name: asset.path, data: asset.bytes })),
  ]);
}

async function rejection(archive, code, path) {
  let extracts = 0;
  await assert.rejects(
    readProjectBundleArchive(archive, { onExtract: () => { extracts += 1; } }),
    (error) => error?.code === code && error?.path === path,
  );
  assert.equal(extracts, 0, "rejected archives must not expose or write a member");
}

test("rejects absolute, drive, UNC, control, empty, dot, traversal and backslash aliases before extraction", async () => {
  const cases = [
    ["/etc/passwd", "bundle.path_absolute"],
    ["C:/Windows/win.ini", "bundle.path_absolute"],
    ["//server/share/file", "bundle.path_absolute"],
    ["assets/control\u0000.svg", "bundle.path_control"],
    ["assets//pump.svg", "bundle.path_traversal"],
    ["assets/./pump.svg", "bundle.path_traversal"],
    ["assets/../project.json", "bundle.path_traversal"],
    ["assets\\pump.svg", "bundle.path_backslash"],
  ];
  for (const [name, code] of cases) {
    await rejection(zip([{ name, data: Uint8Array.of(1) }]), code, "/entries/0/path");
  }
});

test("rejects special entries, duplicates, case collisions and prefix overlaps before extraction", async () => {
  await rejection(zip([{
    name: "assets/link.svg",
    data: Uint8Array.of(1),
    versionMadeBy: (3 << 8) | 20,
    externalAttributes: 0xa1ff0000,
  }]), "bundle.entry_type", "/entries/0/type");
  await rejection(zip([
    { name: "assets/a.svg", data: Uint8Array.of(1) },
    { name: "assets/a.svg", data: Uint8Array.of(2) },
  ]), "bundle.path_duplicate", "/entries/1/path");
  await rejection(zip([
    { name: "assets/A.svg", data: Uint8Array.of(1) },
    { name: "assets/a.svg", data: Uint8Array.of(2) },
  ]), "bundle.case_collision", "/entries/1/path");
  await rejection(zip([
    { name: "assets/a", data: Uint8Array.of(1) },
    { name: "assets/a/file.svg", data: Uint8Array.of(2) },
  ]), "bundle.entry_overlap", "/entries/1/path");
});

test("rejects encryption, unsupported methods and overlapping local records before extraction", async () => {
  await rejection(zip([{
    name: "project.json", data: Uint8Array.of(1), flags: 0x0801,
  }]), "bundle.encrypted", "/entries/0/encrypted");
  await rejection(zip([{
    name: "project.json", data: Uint8Array.of(1), method: 12,
  }]), "bundle.compression_method", "/entries/0/compression");
  await rejection(zip([
    { name: "manifest.json", data: Uint8Array.of(1) },
    { name: "project.json", data: Uint8Array.of(1), localOffset: 0 },
  ]), "bundle.entry_overlap", "/entries/1/offset");
});

test("rejects canonical archive count, compressed, expanded, asset and ratio limits before extraction", async () => {
  const tooMany = Array.from({ length: 257 }, (_, index) => ({
    name: `assets/${index}.bin`, data: new Uint8Array(),
  }));
  await rejection(zip(tooMany), "bundle.entry_count", "/archive/entries");
  await rejection(new Uint8Array(33_554_433), "bundle.compressed_bytes", "/archive/compressed_bytes");
  await rejection(zip([{
    name: "assets/huge.bin", data: Uint8Array.of(1), uncompressedSize: 16_777_217,
  }]), "bundle.asset_bytes", "/entries/0/uncompressed_size");
  await rejection(zip([{
    name: "assets/bomb.bin", data: Uint8Array.of(1), compressedSize: 1, uncompressedSize: 101,
  }]), "bundle.compression_ratio", "/entries/0/compression_ratio");
  await rejection(zip(Array.from({ length: 9 }, (_, index) => ({
    name: `assets/${index}.bin`, data: Uint8Array.of(1), uncompressedSize: 16_777_216,
  }))), "bundle.expanded_bytes", "/archive/expanded_bytes");
});

test("rejects CRC, SHA-256, manifest identity and exact-member closure failures without exposure", async () => {
  const baseline = validBundle();
  const corrupted = baseline.slice();
  const projectName = Buffer.from("project.json");
  const firstProjectName = Buffer.from(corrupted).indexOf(projectName);
  const projectHeader = Buffer.from(corrupted).indexOf(projectName, firstProjectName + projectName.length);
  corrupted[projectHeader + projectName.length] ^= 1;
  await rejection(corrupted, "bundle.crc", "/entries/1/crc32");

  await rejection(validBundle({
    manifestPatch: {
      project: {
        id: "bundle-project", path: "project.json", schema_version: 2,
        sha256: "0".repeat(64), size: jsonBytes(validProject()).length,
      },
    },
  }), "bundle.hash", "/manifest/project/sha256");

  await rejection(validBundle({
    manifestPatch: {
      project: {
        id: "other-project", path: "project.json", schema_version: 2,
        sha256: sha256(jsonBytes(validProject())), size: jsonBytes(validProject()).length,
      },
    },
  }), "bundle.manifest_mismatch", "/manifest/project/id");

  const asset = {
    id: "pump-symbol", path: "assets/pump.svg", media_type: "image/svg+xml",
    bytes: encoder.encode("<svg/>") ,
  };
  const missing = validBundle({ assets: [asset] });
  const missingProject = validProject([asset]);
  const missingProjectBytes = jsonBytes(missingProject);
  const missingManifest = {
    format: "gltproject", bundle_version: 1,
    project: { id: "bundle-project", path: "project.json", schema_version: 2, sha256: sha256(missingProjectBytes), size: missingProjectBytes.length },
    assets: [{ id: asset.id, path: asset.path, sha256: sha256(asset.bytes), size: asset.bytes.length, media_type: asset.media_type, compression: "store" }],
  };
  void missing;
  await rejection(zip([
    { name: "manifest.json", data: jsonBytes(missingManifest) },
    { name: "project.json", data: missingProjectBytes },
  ]), "bundle.asset_missing", "/manifest/assets/0/path");
  const emptyProjectBytes = jsonBytes(validProject());
  const emptyManifest = {
    ...missingManifest,
    project: {
      ...missingManifest.project,
      sha256: sha256(emptyProjectBytes),
      size: emptyProjectBytes.length,
    },
    assets: [],
  };
  await rejection(zip([
    { name: "manifest.json", data: jsonBytes(emptyManifest) },
    { name: "project.json", data: emptyProjectBytes },
    { name: asset.path, data: asset.bytes },
  ]), "bundle.asset_unreferenced", "/entries/2/path");
});

test("JavaScript and Python return identical stable rejection decisions", async () => {
  const archives = [
    zip([{ name: "../project.json", data: Uint8Array.of(1) }]),
    zip([{ name: "assets/a", data: Uint8Array.of(1) }, { name: "assets/A", data: Uint8Array.of(2) }]),
    validBundle({ manifestPatch: { bundle_version: 2 } }),
  ];
  const requests = archives.map((archive, index) => JSON.stringify({
    id: String(index), raw_base64: Buffer.from(archive).toString("base64"),
  })).join("\n");
  const result = spawnSync("py", [
    "-3.13", "-m", "custom_components.glt_flow_card.project_bundle", "--json-lines",
  ], { input: `${requests}\n`, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const python = result.stdout.trim().split(/\r?\n/u).map((line) => JSON.parse(line).decision);
  const javascript = await Promise.all(archives.map((archive) => bundleDecision(archive)));
  assert.deepEqual(python, javascript);
});
