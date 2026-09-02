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
