/**
 * Turn the catalog's published count into evidence (CAT-01, T5-01, T5-02).
 *
 * `symbolCatalogStats()` reported a number by measuring array lengths. That
 * proves the array's length. A catalog of 456 rows where every row draws
 * nothing reports 456 just as confidently, and so does one where six rows draw
 * the same picture — both of which were true here before the geometry became
 * data.
 *
 * So this renders every variant and digests what came out. The count is the
 * number of things that drew. Uniqueness is asserted on both axes separately,
 * because a cross product of two proven-distinct axes is a proven-distinct set
 * and nothing weaker is: claiming 456 hand-drawn symbols would be the
 * overclaim, and claiming 76 bases times 6 styles is the honest form of the
 * same number.
 *
 * `--check` regenerates and compares, so a stale manifest fails in the Node
 * suite instead of being trusted.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  BASE_SYMBOLS, DOMAINS, SYMBOL_VARIANTS, VISUAL_STYLES,
  baseGeometrySource, domainForCategory, renderVariant, styleTokenSource,
} from "../src/v100/catalog.mjs";

export const CATALOG_EVIDENCE_PATH = resolve(import.meta.dirname, "../catalog-evidence.json");

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fail(message) {
  process.stderr.write(`catalog evidence: ${message}\n`);
  process.exitCode = 1;
}

function build() {
  const problems = [];

  const baseSymbols = BASE_SYMBOLS.map((base) => {
    const domain = domainForCategory(base.category);
    if (!domain) problems.push(`base symbol ${base.id} sits in an unmapped category: ${base.category}`);
    return {
      id: base.id,
      category: base.category,
      domain,
      geometry_sha256: sha256(baseGeometrySource(base.id)),
      primitives: JSON.parse(baseGeometrySource(base.id)).length,
    };
  }).sort((a, b) => (a.id < b.id ? -1 : 1));

  const styles = VISUAL_STYLES.map((style) => ({
    id: style.id,
    token_sha256: sha256(styleTokenSource(style.id)),
  })).sort((a, b) => (a.id < b.id ? -1 : 1));

  // The count comes from here: one entry per variant that actually rendered
  // geometry. A variant whose body is empty is recorded with no digest, so it
  // shows up as a hole rather than silently inflating the total.
  const rendered = [];
  for (const variant of SYMBOL_VARIANTS) {
    const markup = renderVariant(variant.base_symbol, variant.style);
    const body = markup.replace(/^.*?<\/title>/su, "").replace(/<\/svg>$/u, "");
    rendered.push({
      id: variant.id,
      base_symbol: variant.base_symbol,
      style: variant.style,
      geometry_sha256: body.length > 0 ? sha256(markup) : "",
    });
  }
  rendered.sort((a, b) => (a.id < b.id ? -1 : 1));

  const empty = rendered.filter((entry) => !entry.geometry_sha256);
  for (const entry of empty) problems.push(`${entry.id} rendered no geometry`);

  const geometry = baseSymbols.map((entry) => entry.geometry_sha256);
  if (new Set(geometry).size !== geometry.length) {
    problems.push("two base symbols render identical geometry, so the cross product overstates");
  }
  const tokens = styles.map((entry) => entry.token_sha256);
  if (new Set(tokens).size !== tokens.length) {
    problems.push("two styles produce identical tokens, so they are not distinct variants");
  }
  const variantDigests = rendered.map((entry) => entry.geometry_sha256);
  if (new Set(variantDigests).size !== variantDigests.length) {
    problems.push("two variants rendered identical markup");
  }

  const domains = DOMAINS.map((domain) => ({
    id: domain.id,
    category: domain.category,
    base_symbols: baseSymbols.filter((entry) => entry.domain === domain.id).length,
    variants: rendered.filter((entry) => {
      const base = BASE_SYMBOLS.find((candidate) => candidate.id === entry.base_symbol);
      return domainForCategory(base?.category) === domain.id;
    }).length,
  }));
  for (const domain of domains) {
    if (domain.base_symbols === 0) problems.push(`domain ${domain.id} has no base symbols`);
  }

  return {
    evidence: {
      format: "glt-flow-card-catalog-evidence",
      report_version: 1,
      base_symbol_count: baseSymbols.length,
      style_count: styles.length,
      variant_count: rendered.filter((entry) => entry.geometry_sha256).length,
      domains,
      base_symbols: baseSymbols,
      styles,
      rendered,
    },
    problems,
  };
}

/**
 * The evidence as it must appear on disk, or the reasons it cannot be written.
 *
 * Exported so the Node suite regenerates in-process and compares, rather than
 * trusting a file whose freshness nothing checked.
 */
export function generateCatalogEvidence() {
  const { evidence, problems } = build();
  if (problems.length > 0) {
    const error = new Error(`catalog evidence cannot be generated:\n  ${problems.join("\n  ")}`);
    error.problems = problems;
    throw error;
  }
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

async function main() {
  let serialized;
  try {
    serialized = generateCatalogEvidence();
  } catch (error) {
    for (const problem of error.problems ?? [error.message]) fail(problem);
    process.exit(1);
  }
  const evidence = JSON.parse(serialized);

  if (process.argv.includes("--check")) {
    let current = null;
    try {
      current = await readFile(CATALOG_EVIDENCE_PATH, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (current !== serialized) {
      fail("catalog-evidence.json is stale; regenerate it with npm run generate:catalog:evidence");
      process.exit(1);
    }
    process.stdout.write(`catalog evidence current: ${evidence.variant_count} variants\n`);
    return;
  }
  await writeFile(CATALOG_EVIDENCE_PATH, serialized);
  process.stdout.write(
    `catalog evidence written: ${evidence.variant_count} variants `
    + `from ${evidence.base_symbol_count} base symbols in ${evidence.style_count} styles\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
