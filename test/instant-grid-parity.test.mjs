/**
 * Both runtimes produce identical bucket grids (07-21).
 *
 * The grid is what an answer is measured against, so a browser that draws one
 * grid while the Companion measures coverage against another would show a
 * complete chart over an incomplete month. Phase 7 already proved the *window*
 * agrees; this proves the divisions inside it do too.
 *
 * Bytes, not values, for the reason `period-parity.test.mjs` records: two
 * earlier parity efforts agreed on every value and disagreed on every byte.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import test from "node:test";

import { pythonCommand } from "../tools/python-launcher.mjs";
import { bucketFor, canonicalGrid, expectedInstants, BUCKET_STEPS, SPECS } from "../src/v100/period-resolution.mjs";

const EFFECT_PREFIX = "PHASE7_GRID_EFFECTS ";

const CORPUS = JSON.parse(readFileSync(
  new URL("../tests/components/glt_flow_card/fixtures/instant_grid_corpus.json", import.meta.url),
  "utf8",
));

test("both runtimes produce byte-identical bucket grids", () => {
  console.log(EFFECT_PREFIX + JSON.stringify({
    cases: CORPUS.cases.length, network: 0, recorderQueries: 0, service: 0,
  }));

  const script = [
    "import json",
    "from custom_components.glt_flow_card import period_resolution as pr",
    `corpus = json.loads(${JSON.stringify(JSON.stringify(CORPUS.cases))})`,
    "print(json.dumps([pr.canonical_grid(c['spec'], pr.expected_instants(",
    "    c['spec'], now=c['now'], timezone=c['timezone'])) for c in corpus]))",
  ].join("\n");

  // The corpus exceeds the Windows command-line length limit, so the script
  // travels through a file instead of a -c argument on every platform.
  const scriptRoot = mkdtempSync(path.join(os.tmpdir(), "glt-instant-grid-"));
  const scriptPath = path.join(scriptRoot, "grid.py");
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  writeFileSync(scriptPath, [
    "import json, sys",
    // A script file puts its own directory on sys.path instead of the cwd,
    // so the repo root has to be named for the Companion import to resolve.
    `sys.path.insert(0, ${JSON.stringify(repoRoot)})`,
    script,
  ].join("\n"), "utf8");
  let companionOutput;
  try {
    const [command, ...args] = pythonCommand().split(" ");
    companionOutput = execFileSync(command, [...args, scriptPath], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUTF8: "1" },
    });
  } finally {
    rmSync(scriptRoot, { recursive: true, force: true });
  }
  const companion = JSON.parse(companionOutput);

  const divergences = [];
  for (const [index, entry] of CORPUS.cases.entries()) {
    const mine = canonicalGrid(
      entry.spec,
      expectedInstants(entry.spec, { now: entry.now, timezone: entry.timezone }),
    );
    if (mine !== companion[index]) {
      divergences.push(`${entry.spec}@${entry.timezone}: browser ${mine} != companion ${companion[index]}`);
    }
    if (mine !== entry.canonical) {
      divergences.push(`${entry.spec}@${entry.timezone}: browser diverges from the committed corpus`);
    }
  }
  assert.deepEqual(divergences, [], divergences.join("\n"));
});

test("the browser's bucket table mirrors the Companion's exactly", () => {
  // Mirrored rather than imported, so a step changed on one side has to be
  // changed on the other. A silent divergence here would move the grid without
  // moving the window, which is the hardest kind of wrong number to see.
  const script = [
    "import json",
    "from custom_components.glt_flow_card import period_resolution as pr",
    "print(json.dumps(pr.BUCKET_STEPS, sort_keys=True))",
  ].join("\n");
  const [command, ...args] = pythonCommand().split(" ");
  const companion = JSON.parse(execFileSync(command, [...args, "-c", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }));
  assert.deepEqual(
    Object.fromEntries(Object.keys(BUCKET_STEPS).sort().map((k) => [k, BUCKET_STEPS[k]])),
    companion,
    "the two bucket tables disagree",
  );
  assert.deepEqual(
    Object.keys(BUCKET_STEPS).sort(),
    Object.keys(SPECS).sort(),
    "a named period has no bucket step, or a step names no period",
  );
});

test("an unknown period is refused rather than bucketed as a day", () => {
  assert.throws(() => bucketFor("sometimes"), /unknown_period/);
  assert.throws(
    () => expectedInstants("sometimes", { now: "2027-06-01T00:00:00+00:00", timezone: "UTC" }),
    /unknown_period/,
  );
});
