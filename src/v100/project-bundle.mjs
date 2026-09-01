/* Safe, bounded .gltproject archive preflight and opaque-byte import. */
import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js/index-native.js";

import { bundleManifest as validateBundleManifest } from "./generated/project-validators.mjs";
import { canonicalizeJson, evaluateProjectContract } from "./project-contract.mjs";
import { migrateProjectDocument } from "./project-migrations.mjs";

const LIMITS = Object.freeze({
  maxCompressedBytes: 33_554_432,
  maxEntries: 256,
  maxAssetBytes: 16_777_216,
  maxExpandedBytes: 134_217_728,
  maxCompressionRatio: 100,
  maxJsonBytes: 5_242_880,
  maxPathChars: 512,
});
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

export class BundleError extends Error {
  constructor(code, path, params = {}) {
    super(`${code} at ${path}`);
    this.name = "BundleError";
    this.code = code;
    this.path = path;
    this.params = Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  }

  toJSON() {
    return { code: this.code, path: this.path, params: this.params };
  }
}

function failure(code, path, params = {}) {
  throw new BundleError(code, path, params);
}

function bytesOf(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError("bundle input must be binary bytes");
}

function viewOf(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function u16(view, offset) {
  if (offset < 0 || offset + 2 > view.byteLength) failure("bundle.manifest_mismatch", "/archive", { reason: "truncated" });
  return view.getUint16(offset, true);
}

function u32(view, offset) {
  if (offset < 0 || offset + 4 > view.byteLength) failure("bundle.manifest_mismatch", "/archive", { reason: "truncated" });
  return view.getUint32(offset, true);
}

function decodeName(raw) {
  try {
    if (raw.every((byte) => byte < 0x80)) return decoder.decode(raw);
    return decoder.decode(raw);
  } catch {
    failure("bundle.path_control", "/archive", { reason: "invalid_filename_encoding" });
  }
}

function normalizePath(rawPath, index) {
  const path = String(rawPath);
  const pointer = `/entries/${index}/path`;
  if (/^[a-zA-Z]:/u.test(path) || path.startsWith("/") || path.startsWith("//")) {
    failure("bundle.path_absolute", pointer, { path });
  }
  if (path.includes("\\")) failure("bundle.path_backslash", pointer, { path });
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(path)) failure("bundle.path_control", pointer, { path });
  const normalized = path.normalize("NFC");
  const parts = normalized.split("/");
  if (!normalized || parts.some((part) => !part || part === "." || part === "..")) {
    failure("bundle.path_traversal", pointer, { path });
  }
  if (normalized.length > LIMITS.maxPathChars) {
    failure("bundle.path_traversal", pointer, { path, limit: LIMITS.maxPathChars });
  }
  return normalized;
}

function findEndRecord(bytes, view) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (u32(view, offset) !== 0x06054b50) continue;
    const commentLength = u16(view, offset + 20);
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  failure("bundle.manifest_mismatch", "/archive", { reason: "missing_end_record" });
}

function entryType(versionMadeBy, externalAttributes, name, index) {
  const platform = versionMadeBy >>> 8;
  const unixType = platform === 3 ? ((externalAttributes >>> 16) & 0xf000) : 0;
  const dosDirectory = (externalAttributes & 0x10) !== 0;
  if (name.endsWith("/") || dosDirectory || (unixType !== 0 && unixType !== 0x8000)) {
    failure("bundle.entry_type", `/entries/${index}/type`, { path: name, type: unixType || "directory" });
  }
}

function preflightCentralDirectory(input) {
  const bytes = bytesOf(input);
  if (bytes.length > LIMITS.maxCompressedBytes) {
    failure("bundle.compressed_bytes", "/archive/compressed_bytes", {
      actual: bytes.length, limit: LIMITS.maxCompressedBytes,
    });
  }
  const view = viewOf(bytes);
  const endOffset = findEndRecord(bytes, view);
  const disk = u16(view, endOffset + 4);
  const centralDisk = u16(view, endOffset + 6);
  const diskEntries = u16(view, endOffset + 8);
  const entryCount = u16(view, endOffset + 10);
  const centralSize = u32(view, endOffset + 12);
  const centralOffset = u32(view, endOffset + 16);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount || centralOffset + centralSize !== endOffset) {
    failure("bundle.manifest_mismatch", "/archive", { reason: "ambiguous_central_directory" });
  }
  if (entryCount > LIMITS.maxEntries) {
    failure("bundle.entry_count", "/archive/entries", { actual: entryCount, limit: LIMITS.maxEntries });
  }

  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (u32(view, cursor) !== 0x02014b50) {
      failure("bundle.manifest_mismatch", "/archive", { reason: "invalid_central_entry" });
    }
    const versionMadeBy = u16(view, cursor + 4);
    const flags = u16(view, cursor + 8);
    const method = u16(view, cursor + 10);
    const crc32 = u32(view, cursor + 16);
    const compressedSize = u32(view, cursor + 20);
    const uncompressedSize = u32(view, cursor + 24);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const externalAttributes = u32(view, cursor + 38);
    const localOffset = u32(view, cursor + 42);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > endOffset) failure("bundle.manifest_mismatch", "/archive", { reason: "truncated_central_entry" });
    const rawName = bytes.slice(cursor + 46, cursor + 46 + nameLength);
    const name = normalizePath(decodeName(rawName), index);
    entryType(versionMadeBy, externalAttributes, name, index);
    if ((flags & 1) !== 0) failure("bundle.encrypted", `/entries/${index}/encrypted`, { path: name });
    if (method !== 0 && method !== 8) {
      failure("bundle.compression_method", `/entries/${index}/compression`, { actual: method, allowed: [0, 8] });
    }
    entries.push({
      index, name, rawName, flags, method, crc32, compressedSize, uncompressedSize,
      localOffset, versionMadeBy, externalAttributes,
    });
    cursor = end;
  }
  if (cursor !== endOffset) failure("bundle.manifest_mismatch", "/archive", { reason: "trailing_central_data" });

  const names = new Map();
  const folded = new Map();
  for (const entry of entries) {
    if (names.has(entry.name)) failure("bundle.path_duplicate", `/entries/${entry.index}/path`, { path: entry.name });
    const caseKey = entry.name.toLowerCase();
    if (folded.has(caseKey)) failure("bundle.case_collision", `/entries/${entry.index}/path`, { path: entry.name });
    names.set(entry.name, entry.index);
    folded.set(caseKey, entry.index);
  }
  const byName = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  for (let index = 1; index < byName.length; index += 1) {
    if (byName[index].name.startsWith(`${byName[index - 1].name}/`)) {
      failure("bundle.entry_overlap", `/entries/${byName[index].index}/path`, {
        path: byName[index].name, prefix: byName[index - 1].name,
      });
    }
  }

  const expandedBytes = entries.reduce((total, entry) => total + entry.uncompressedSize, 0);
  const compressedBytes = entries.reduce((total, entry) => total + entry.compressedSize, 0);
  if (compressedBytes > LIMITS.maxCompressedBytes) {
    failure("bundle.compressed_bytes", "/archive/compressed_bytes", { actual: compressedBytes, limit: LIMITS.maxCompressedBytes });
  }
  if (expandedBytes > LIMITS.maxExpandedBytes) {
    failure("bundle.expanded_bytes", "/archive/expanded_bytes", { actual: expandedBytes, limit: LIMITS.maxExpandedBytes });
  }
  for (const entry of entries) {
    const pointer = `/entries/${entry.index}`;
    const maximum = entry.name === "manifest.json" || entry.name === "project.json"
      ? LIMITS.maxJsonBytes : LIMITS.maxAssetBytes;
    if (entry.uncompressedSize > maximum) {
      failure(entry.name === "manifest.json" || entry.name === "project.json" ? "bundle.expanded_bytes" : "bundle.asset_bytes", `${pointer}/uncompressed_size`, {
        actual: entry.uncompressedSize, limit: maximum,
      });
    }
    const ratio = entry.uncompressedSize / Math.max(1, entry.compressedSize);
    if (ratio > LIMITS.maxCompressionRatio) {
      failure("bundle.compression_ratio", `${pointer}/compression_ratio`, {
        actual: ratio, limit: LIMITS.maxCompressionRatio,
      });
    }
  }

  const intervals = [];
  for (const entry of entries) {
    const offset = entry.localOffset;
    if (offset >= centralOffset || u32(view, offset) !== 0x04034b50) {
      failure("bundle.entry_overlap", `/entries/${entry.index}/offset`, { offset });
    }
    const flags = u16(view, offset + 6);
    const method = u16(view, offset + 8);
    const localCrc = u32(view, offset + 14);
    const localCompressed = u32(view, offset + 18);
    const localExpanded = u32(view, offset + 22);
    const nameLength = u16(view, offset + 26);
    const extraLength = u16(view, offset + 28);
    const rawName = bytes.slice(offset + 30, offset + 30 + nameLength);
    const hasDescriptor = (flags & 8) !== 0;
    if (!hasDescriptor && localCrc !== entry.crc32) {
      failure("bundle.crc", `/entries/${entry.index}/crc32`, { path: entry.name });
    }
    const localMatches = BufferlessEqual(rawName, entry.rawName)
      && flags === entry.flags && method === entry.method
      && (hasDescriptor || (localCompressed === entry.compressedSize && localExpanded === entry.uncompressedSize));
    if (!localMatches) failure("bundle.entry_overlap", `/entries/${entry.index}/offset`, { offset, reason: "local_header_mismatch" });
    const dataStart = offset + 30 + nameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > centralOffset) failure("bundle.entry_overlap", `/entries/${entry.index}/offset`, { offset });
    intervals.push({ start: offset, end: dataEnd, index: entry.index });
  }
  intervals.sort((a, b) => a.start - b.start || a.index - b.index);
  if (intervals.length && intervals[0].start !== 0) {
    failure("bundle.entry_overlap", `/entries/${intervals[0].index}/offset`, { reason: "prepended_data" });
  }
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].start < intervals[index - 1].end) {
      failure("bundle.entry_overlap", `/entries/${intervals[index].index}/offset`, { offset: intervals[index].start });
    }
  }
  return { bytes, entries };
}

function BufferlessEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

async function sha256(bytes) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalDocument(bytes, path) {
  let text;
  let document;
  try {
    text = decoder.decode(bytes);
    document = JSON.parse(text);
  } catch {
    failure("bundle.manifest_mismatch", path, { reason: "invalid_json" });
  }
  let canonical;
  try {
    canonical = canonicalizeJson(document);
  } catch {
    failure("bundle.manifest_mismatch", path, { reason: "noncanonical_json" });
  }
  if (text !== canonical) failure("bundle.manifest_mismatch", path, { reason: "noncanonical_json" });
  return { document, canonical };
}

function manifestErrorPath(error) {
  let path = error?.instancePath || "";
  if (error?.keyword === "required") path += `/${error.params.missingProperty}`;
  return `/manifest${path}`;
}

function manifestProjectAssets(project) {
  return Array.isArray(project?.assets) ? project.assets : [];
}

async function verifiedContents(preflight) {
  const reader = new ZipReader(new Uint8ArrayReader(preflight.bytes), {
    strictness: "strict",
    useWebWorkers: false,
  });
  let zipEntries;
  try {
    zipEntries = await reader.getEntries({ strictness: "strict" });
    if (zipEntries.length !== preflight.entries.length) {
      failure("bundle.manifest_mismatch", "/archive", { reason: "entry_count_changed" });
    }
    const contents = new Map();
    for (const metadata of preflight.entries) {
      const zipEntry = zipEntries[metadata.index];
      let data;
      try {
        data = await zipEntry.getData(new Uint8ArrayWriter(), {
          checkSignature: true,
          checkAmbiguity: true,
          checkOverlappingEntry: true,
          useWebWorkers: false,
        });
      } catch (error) {
        const message = String(error?.message || error);
        if (/overlap|ambiguous/i.test(message)) {
          failure("bundle.entry_overlap", `/entries/${metadata.index}/offset`, { path: metadata.name });
        }
        failure("bundle.crc", `/entries/${metadata.index}/crc32`, { path: metadata.name });
      }
      if (data.length !== metadata.uncompressedSize) {
        failure("bundle.crc", `/entries/${metadata.index}/crc32`, { path: metadata.name });
      }
      contents.set(metadata.name, data);
    }
    return contents;
  } finally {
    await reader.close().catch(() => undefined);
  }
}

export async function readProjectBundleArchive(input, { onExtract } = {}) {
  const preflight = preflightCentralDirectory(input);
  const contents = await verifiedContents(preflight);
  const manifestBytes = contents.get("manifest.json");
  const projectBytes = contents.get("project.json");
  if (!manifestBytes || !projectBytes) {
    failure("bundle.manifest_mismatch", "/manifest", { reason: "required_member_missing" });
  }
  const { document: manifest } = canonicalDocument(manifestBytes, "/manifest");
  if (!validateBundleManifest(manifest)) {
    const first = validateBundleManifest.errors?.[0];
    failure("bundle.manifest_mismatch", manifestErrorPath(first), { keyword: first?.keyword || "schema" });
  }
  const { document: project, canonical: canonicalProject } = canonicalDocument(projectBytes, "/project");
  const projectEvidence = evaluateProjectContract(projectBytes);
  if (!projectEvidence.valid) {
    const first = projectEvidence.errors[0];
    failure(first.code, first.path, first.params);
  }
  if (projectEvidence.canonical !== canonicalProject) {
    failure("bundle.manifest_mismatch", "/project", { reason: "canonical_evidence_mismatch" });
  }
  if (manifest.project.id !== project.project?.id || manifest.project.schema_version !== projectEvidence.schema_version) {
    failure("bundle.manifest_mismatch", "/manifest/project/id", {
      manifest_project_id: manifest.project.id, project_id: project.project?.id,
    });
  }
  if (manifest.project.size !== projectBytes.length) {
    failure("bundle.manifest_mismatch", "/manifest/project/size", { actual: projectBytes.length, declared: manifest.project.size });
  }
  if (await sha256(projectBytes) !== manifest.project.sha256) {
    failure("bundle.hash", "/manifest/project/sha256", { path: "project.json" });
  }

  const archiveAssets = preflight.entries.filter((entry) => entry.name !== "manifest.json" && entry.name !== "project.json");
  const declaredByPath = new Map(manifest.assets.map((asset) => [asset.path, asset]));
  const projectAssets = manifestProjectAssets(project);
  const projectByPath = new Map(projectAssets.map((asset) => [asset.path, asset]));
  for (const [index, declared] of manifest.assets.entries()) {
    const metadata = preflight.entries.find((entry) => entry.name === declared.path);
    if (!metadata) failure("bundle.asset_missing", `/manifest/assets/${index}/path`, { path: declared.path });
    const projectAsset = projectByPath.get(declared.path);
    if (!projectAsset || projectAsset.id !== declared.id) {
      failure("bundle.manifest_mismatch", `/manifest/assets/${index}/id`, { path: declared.path });
    }
    const data = contents.get(declared.path);
    if (declared.size !== data.length) failure("bundle.manifest_mismatch", `/manifest/assets/${index}/size`, { path: declared.path });
    if (declared.compression !== (metadata.method === 0 ? "store" : "deflate")) {
      failure("bundle.manifest_mismatch", `/manifest/assets/${index}/compression`, { path: declared.path });
    }
    if (await sha256(data) !== declared.sha256) {
      failure("bundle.hash", `/manifest/assets/${index}/sha256`, { path: declared.path });
    }
    if (projectAsset.media_type !== undefined && projectAsset.media_type !== declared.media_type) {
      failure("bundle.manifest_mismatch", `/manifest/assets/${index}/media_type`, { path: declared.path });
    }
  }
  for (const metadata of archiveAssets) {
    if (!declaredByPath.has(metadata.name)) {
      failure("bundle.asset_unreferenced", `/entries/${metadata.index}/path`, { path: metadata.name });
    }
  }
  if (projectAssets.length !== manifest.assets.length) {
    failure("bundle.manifest_mismatch", "/manifest/assets", { reason: "project_asset_closure" });
  }

  const assets = manifest.assets.map((asset) => ({
    id: asset.id,
    path: asset.path,
    media_type: asset.media_type,
    sha256: asset.sha256,
    size: asset.size,
    compression: asset.compression,
    bytes: contents.get(asset.path).slice(),
  }));
  if (onExtract) {
    for (const metadata of preflight.entries) onExtract(metadata.name, contents.get(metadata.name).slice());
  }
  return {
    manifest: JSON.parse(canonicalizeJson(manifest)),
    project: JSON.parse(canonicalProject),
    project_bytes: projectBytes.slice(),
    assets,
    entries: preflight.entries.map((entry) => ({
      path: entry.name,
      compression: entry.method === 0 ? "store" : "deflate",
      compressed_size: entry.compressedSize,
      uncompressed_size: entry.uncompressedSize,
    })),
  };
}

export async function bundleDecision(input) {
  try {
    await readProjectBundleArchive(input);
    return { outcome: "accept", code: null, path: "/", params: {} };
  } catch (error) {
    if (!(error instanceof BundleError)) throw error;
    return { outcome: "reject", ...error.toJSON() };
  }
}

function binaryAssetBytes(value) {
  if (value instanceof Uint8Array) return value.slice();
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
  }
  throw new TypeError("asset bytes must be a Uint8Array or ArrayBuffer");
}

async function exportDocuments(rawProject, rawAssets) {
  const migrated = migrateProjectDocument(rawProject, { dryRun: true }).candidate;
  const projectAssets = Array.isArray(migrated.assets) ? migrated.assets : [];
  if (!Array.isArray(rawAssets)) throw new TypeError("assets must be an array");
  const sources = [];
  const sourceIds = new Set();
  const sourcePaths = new Set();
  for (const [index, rawAsset] of rawAssets.entries()) {
    if (!rawAsset || typeof rawAsset !== "object") throw new TypeError(`asset ${index} must be an object`);
    const id = String(rawAsset.id || "");
    const path = normalizePath(rawAsset.path, index + 2);
    const mediaType = String(rawAsset.media_type || "");
    const compression = rawAsset.compression || "store";
    if (!id || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(id)) {
      failure("bundle.manifest_mismatch", `/manifest/assets/${index}/id`, { id });
    }
    if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/u.test(mediaType) || mediaType.length > 128) {
      failure("bundle.manifest_mismatch", `/manifest/assets/${index}/media_type`, { media_type: mediaType });
    }
    if (compression !== "store" && compression !== "deflate") {
      failure("bundle.compression_method", `/manifest/assets/${index}/compression`, { actual: compression });
    }
    if (sourceIds.has(id) || sourcePaths.has(path)) {
      failure("bundle.path_duplicate", `/manifest/assets/${index}/path`, { path });
    }
    const bytes = binaryAssetBytes(rawAsset.bytes);
    if (bytes.length > LIMITS.maxAssetBytes) {
      failure("bundle.asset_bytes", `/manifest/assets/${index}/size`, { actual: bytes.length, limit: LIMITS.maxAssetBytes });
    }
    sourceIds.add(id);
    sourcePaths.add(path);
    sources.push({ id, path, media_type: mediaType, compression, bytes, sha256: await sha256(bytes), size: bytes.length });
  }
  sources.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const projectById = new Map(projectAssets.map((asset) => [asset?.id, asset]));
  if (projectAssets.length !== sources.length) {
    failure("bundle.manifest_mismatch", "/manifest/assets", { reason: "project_asset_closure" });
  }
  const enrichedAssets = sources.map((source, index) => {
    const projectAsset = projectById.get(source.id);
    if (!projectAsset || projectAsset.path !== source.path) {
      failure("bundle.manifest_mismatch", `/manifest/assets/${index}/id`, { id: source.id, path: source.path });
    }
    if (projectAsset.media_type !== undefined && projectAsset.media_type !== source.media_type) {
      failure("bundle.manifest_mismatch", `/manifest/assets/${index}/media_type`, { path: source.path });
    }
    return {
      ...projectAsset,
      id: source.id,
      path: source.path,
      media_type: source.media_type,
      sha256: source.sha256,
      size: source.size,
    };
  });
  const project = JSON.parse(canonicalizeJson({ ...migrated, assets: enrichedAssets }));
  const evidence = evaluateProjectContract(project);
  if (!evidence.valid) {
    const first = evidence.errors[0];
    failure(first.code, first.path, first.params);
  }
  const projectBytes = encoder.encode(evidence.canonical);
  const manifest = {
    format: "gltproject",
    bundle_version: 1,
    project: {
      id: project.project.id,
      path: "project.json",
      schema_version: evidence.schema_version,
      sha256: await sha256(projectBytes),
      size: projectBytes.length,
    },
    assets: sources.map(({ bytes, ...source }) => source),
  };
  if (!validateBundleManifest(manifest)) {
    const first = validateBundleManifest.errors?.[0];
    failure("bundle.manifest_mismatch", manifestErrorPath(first), { keyword: first?.keyword || "schema" });
  }
  return { manifest, manifestBytes: encoder.encode(canonicalizeJson(manifest)), project, projectBytes, sources };
}

export async function createProjectBundle(rawProject, assets = []) {
  const documents = await exportDocuments(rawProject, assets);
  const output = new Uint8ArrayWriter();
  const writer = new ZipWriter(output, {
    bufferedWrite: true,
    dataDescriptor: false,
    extendedTimestamp: false,
    keepOrder: true,
    level: 0,
    useUnicodeFileNames: true,
    useWebWorkers: false,
    zip64: false,
  });
  const fixed = {
    bufferedWrite: true,
    dataDescriptor: false,
    extendedTimestamp: false,
    lastModDate: new Date(Date.UTC(1980, 0, 1, 0, 0, 0)),
    versionMadeBy: 20,
    externalFileAttributes: 0,
    useWebWorkers: false,
  };
  try {
    await writer.add("manifest.json", new Uint8ArrayReader(documents.manifestBytes), { ...fixed, level: 0 });
    await writer.add("project.json", new Uint8ArrayReader(documents.projectBytes), { ...fixed, level: 0 });
    for (const source of documents.sources) {
      await writer.add(source.path, new Uint8ArrayReader(source.bytes), {
        ...fixed,
        level: source.compression === "store" ? 0 : 6,
      });
    }
    return await writer.close(new Uint8Array(), { zip64: false });
  } catch (error) {
    await writer.close().catch(() => undefined);
    throw error;
  }
}
