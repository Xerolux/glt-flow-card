/**
 * The published catalog count is evidence, not arithmetic (T5-01, T5-02).
 *
 * `symbolCatalogStats()` already reports a number today, by measuring array
 * lengths. That proves the array's length. A catalog of 336 rows where every
 * row renders as nothing would report 336 just as confidently, which is exactly
 * the unproven claim the roadmap names as a defect.
 *
 * So the count comes from rendering, and uniqueness is asserted on both axes by
 * digest: base geometry must differ per base symbol, style tokens must differ
 * per style. A cross product of two proven-distinct axes is a proven distinct
 * set; claiming 336 hand-drawn symbols would be the overclaim.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const EVIDENCE_URL = new URL("../catalog-evidence.json", import.meta.url);

const RED_MARKER = "EXPECTED_RED[phase5-catalog]: generated catalog evidence is unavailable";
const EFFECT_PREFIX = "PHASE5_CATALOG_EFFECTS ";

/** CAT-01's floor. The evidence may report more; it may not report fewer. */
const MINIMUM_VARIANTS = 300;

/** Domains CAT-01 names. Fire and electrical are the ones the audit found thin. */
const REQUIRED_DOMAINS = ["heating", "hydraulics", "air", "refrigeration", "electrical", "fire"];

function emitEffects(extra = {}) {
  console.log(EFFECT_PREFIX + JSON.stringify({
    network: 0, localStorage: 0, callService: 0, ...extra,
  }));
}

async function loadEvidence() {
  try {
    return JSON.parse(await readFile(EVIDENCE_URL, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

test("the floor is the requirement's, not a number chosen to pass", () => {
  assert.equal(MINIMUM_VARIANTS, 300);
  assert.equal(new Set(REQUIRED_DOMAINS).size, REQUIRED_DOMAINS.length);
});

test("[expected-red:phase5-catalog] the catalog count is proven by rendering", async () => {
  emitEffects({ minimum: MINIMUM_VARIANTS });
  const gaps = [];
  const evidence = await loadEvidence();

  if (!evidence) {
    gaps.push("catalog-evidence.json does not exist");
  } else {
    if (typeof evidence.variant_count !== "number") {
      gaps.push("the evidence carries no rendered variant count");
    } else if (evidence.variant_count < MINIMUM_VARIANTS) {
      gaps.push(`the proven count is ${evidence.variant_count}, below the required ${MINIMUM_VARIANTS}`);
    }

    // The count must come from rendering. An evidence file that merely copies
    // an array length has learned nothing that symbolCatalogStats did not.
    if (!Array.isArray(evidence.rendered) || evidence.rendered.length !== evidence.variant_count) {
      gaps.push("the count is not backed by one rendered entry per variant");
    }

    const geometry = (evidence.base_symbols ?? []).map((entry) => entry.geometry_sha256);
    if (geometry.length === 0) {
      gaps.push("no per-base geometry digests were recorded");
    } else if (new Set(geometry).size !== geometry.length) {
      gaps.push("two base symbols render identical geometry, so the cross product overstates");
    }

    const styles = (evidence.styles ?? []).map((entry) => entry.token_sha256);
    if (styles.length === 0) {
      gaps.push("no per-style token digests were recorded");
    } else if (new Set(styles).size !== styles.length) {
      gaps.push("two styles produce identical tokens, so they are not distinct variants");
    }

    // An empty rendering counts as nothing. A symbol that draws no geometry is
    // exactly the row this evidence exists to catch.
    const empty = (evidence.rendered ?? []).filter((entry) => !entry.geometry_sha256);
    if (empty.length > 0) gaps.push(`${empty.length} variants rendered nothing`);

    const domains = new Set((evidence.domains ?? []).map((entry) => entry.id));
    const missing = REQUIRED_DOMAINS.filter((domain) => !domains.has(domain));
    if (missing.length > 0) gaps.push(`domains absent from the catalog: ${missing.join(", ")}`);
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  catalog gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "generated catalog evidence is unavailable");
});

// -- Beyond the sentinel ----------------------------------------------------
// The sentinel reads a file. These make the file's freshness a checked
// property, and tie the number the card shows to the number the evidence
// proves — otherwise the evidence describes a catalog nobody ships.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { BASE_SYMBOLS, VISUAL_STYLES, renderVariant } from "../src/v100/catalog.mjs";
import { symbolCatalogStats } from "../src/v100/core.mjs";
import {
  CATALOG_EVIDENCE_PATH, generateCatalogEvidence,
} from "../tools/generate-catalog-evidence.mjs";

test("the committed evidence is what the catalog renders today", async () => {
  const committed = await readFile(EVIDENCE_URL, "utf8");
  assert.equal(committed, generateCatalogEvidence(),
    "stale evidence; regenerate with npm run generate:catalog:evidence");
});

test("a stale manifest fails --check, proven by seeding one", async () => {
  const original = await readFile(CATALOG_EVIDENCE_PATH, "utf8");
  const seeded = JSON.parse(original);
  seeded.variant_count += 1;
  try {
    await writeFile(CATALOG_EVIDENCE_PATH, `${JSON.stringify(seeded, null, 2)}\n`);
    const result = spawnSync(process.execPath,
      ["tools/generate-catalog-evidence.mjs", "--check"],
      { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
    assert.notEqual(result.status, 0, "a stale manifest passed --check");
    assert.match(result.stderr, /stale/);
  } finally {
    await writeFile(CATALOG_EVIDENCE_PATH, original);
  }
  const result = spawnSync(process.execPath,
    ["tools/generate-catalog-evidence.mjs", "--check"],
    { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("the count the card reports is the count the evidence proves", async () => {
  const evidence = JSON.parse(await readFile(EVIDENCE_URL, "utf8"));
  const stats = symbolCatalogStats();
  assert.equal(stats.variants, evidence.variant_count);
  assert.equal(stats.base_symbols, evidence.base_symbol_count);
  assert.equal(stats.styles, evidence.style_count);
});

test("every base symbol draws, and the ones that used to draw nothing draw now", () => {
  const silent = BASE_SYMBOLS.filter((base) => (
    !renderVariant(base.id, VISUAL_STYLES[0].id).includes("</title><")
  ));
  assert.deepEqual(silent.map((base) => base.id), []);
  // These three had no branch in the shipped renderer at all, and the catalog
  // counted them anyway. They are named here so a regression is legible.
  for (const id of ["ahu", "wallbox", "room_sensor"]) {
    assert.ok(renderVariant(id, "clean").length > 120, `${id} draws nothing`);
  }
});

test("the domains CAT-01 names each carry base symbols of their own", async () => {
  const evidence = JSON.parse(await readFile(EVIDENCE_URL, "utf8"));
  for (const id of REQUIRED_DOMAINS) {
    const domain = evidence.domains.find((entry) => entry.id === id);
    assert.ok(domain, `domain absent: ${id}`);
    assert.ok(domain.base_symbols > 0, `domain ${id} has no base symbols`);
    assert.equal(domain.variants, domain.base_symbols * evidence.style_count);
  }
  // Fire and electrical were the thin ones. Six styles over an absent domain
  // leave it absent, so these had to arrive as base geometry.
  for (const id of ["fire", "electrical"]) {
    assert.ok(evidence.domains.find((entry) => entry.id === id).base_symbols >= 10);
  }
});

test("a symbol rendered in one style is not the same bytes as in another", () => {
  const rendered = VISUAL_STYLES.map((style) => renderVariant("boiler", style.id));
  assert.equal(new Set(rendered).size, rendered.length);
});

test("the documented catalog count is the one the evidence proves", async () => {
  // Documentation drifts silently. Every place the number appears is bound to
  // the generated manifest here, so a symbol added without regenerating fails
  // in the Node suite rather than shipping a README that overstates.
  const evidence = JSON.parse(await readFile(EVIDENCE_URL, "utf8"));
  const documents = [
    "../README.md", "../README.de.md", "../docs/wiki/Symbols-Routing.md",
  ];
  for (const relative of documents) {
    const text = await readFile(new URL(relative, import.meta.url), "utf8");
    const counts = [...text.matchAll(/\*\*(\d+)\s+(?:variants|Varianten)\*\*/gu)]
      .map((match) => Number(match[1]));
    assert.ok(counts.length > 0, `${relative} states no catalog count`);
    for (const count of counts) {
      assert.equal(count, evidence.variant_count, `${relative} overstates the catalog`);
    }
    const bases = [...text.matchAll(/\*\*(\d+)\s+(?:base symbols|Basissymbolen)\*\*/gu)]
      .map((match) => Number(match[1]));
    for (const count of bases) {
      assert.equal(count, evidence.base_symbol_count, `${relative} misstates the base count`);
    }
  }
});

test("the extension documentation states the foreclosure, not only the guarantee", async () => {
  // "No contributed code executes" is the guarantee. On its own it reads as a
  // feature. What an integrator needs is what it costs them, so both languages
  // have to name it.
  for (const [relative, marker] of [
    ["../README.md", "forecloses"],
    ["../README.de.md", "ausschließt"],
    ["../docs/wiki/Extensions.md", "Was das ausschließt"],
  ]) {
    const text = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.ok(text.includes(marker), `${relative} does not state what the SDK forecloses`);
  }
});

test("no document still describes the retired router or the editor dialogs", async () => {
  const stale = [
    [/Beim Verschieben der Bauteile wird die Route neu berechnet\./u, "the full-sweep reroute"],
    [/mehr als 50 Komponenten/iu, "the pre-Phase-5 catalog size"],
    [/more than 50 components/iu, "the pre-Phase-5 catalog size"],
  ];
  for (const relative of ["../README.md", "../README.de.md",
    "../docs/wiki/Symbols-Routing.md", "../docs/wiki/Designer.md"]) {
    const text = await readFile(new URL(relative, import.meta.url), "utf8");
    for (const [pattern, what] of stale) {
      assert.ok(!pattern.test(text), `${relative} still describes ${what}`);
    }
  }
});
