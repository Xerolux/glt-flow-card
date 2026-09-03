/**
 * Both runtimes resolve periods to identical canonical bytes (T7-08).
 *
 * The axis an engineer verifies and the window the report computes must be the
 * same window, or what was checked is not what ran.
 *
 * Bytes, not values, from the first commit rather than retrofitted. Phase 6's
 * parity work agreed on every value and disagreed on every byte because
 * `toISOString()` writes milliseconds and Python's `isoformat()` omits them at
 * zero, and 07-02 hit the same rock again within the hour with `0` against
 * `0.0`. Comparing values first and bytes later is how both of those happened.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { pythonCommand } from "../tools/python-launcher.mjs";

const RED_MARKER =
  "EXPECTED_RED[phase7-period-parity]: byte-identical period resolution across both runtimes is unavailable";
const EFFECT_PREFIX = "PHASE7_PARITY_EFFECTS ";

const CORPUS = JSON.parse(readFileSync(
  new URL("../tests/components/glt_flow_card/fixtures/period_corpus.json", import.meta.url),
  "utf8",
));

test("[expected-red:phase7-period-parity] both runtimes resolve periods identically", async () => {
  console.log(EFFECT_PREFIX + JSON.stringify({
    entries: CORPUS.entries.length, network: 0, service: 0,
  }));
  const gaps = [];

  let browser = null;
  try {
    browser = await import("../src/v100/period-resolution.mjs");
  } catch {
    gaps.push("src/v100/period-resolution.mjs does not exist");
  }

  let companion = null;
  const script = [
    "import json",
    "from custom_components.glt_flow_card import period_resolution",
    `corpus = json.loads(${JSON.stringify(JSON.stringify(CORPUS.entries))})`,
    "print(json.dumps([period_resolution.canonical(period_resolution.resolve(",
    "    e['spec'], now=e['now'], timezone=e['timezone'])) for e in corpus]))",
  ].join("\n");
  try {
    const [command, ...args] = pythonCommand().split(" ");
    companion = JSON.parse(execFileSync(command, [...args, "-c", script], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }));
  } catch {
    gaps.push("custom_components.glt_flow_card.period_resolution does not exist");
  }

  if (browser && companion) {
    const mine = CORPUS.entries.map((entry) => browser.canonical(
      browser.resolve(entry.spec, { now: entry.now, timezone: entry.timezone }),
    ));
    for (const [index, entry] of CORPUS.entries.entries()) {
      if (mine[index] !== companion[index]) {
        gaps.push(
          `${entry.probe}/${entry.spec}: browser ${mine[index]} != companion ${companion[index]}`,
        );
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps.slice(0, 12)) console.log(`  gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "byte-identical period resolution is unavailable");
});
