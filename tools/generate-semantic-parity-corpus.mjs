/**
 * Record the JavaScript verdict for every shared semantic-model shape.
 *
 * The Home Assistant artifact lanes run a Python-only container: there is no
 * `node` binary on PATH and no `src/` in the workspace, so the Python suite
 * cannot shell out to JavaScript to prove the two runtimes agree. It reads this
 * corpus instead.
 *
 * Parity is still proven end to end, in two halves that cannot both be wrong:
 *   - `test/semantic-parity-corpus.test.mjs` fails if this file is not exactly
 *     what the current `semantic-model.mjs` produces, so the JavaScript half is
 *     always current.
 *   - `tests/components/glt_flow_card/test_semantic_model.py` builds each model
 *     independently in Python and fails unless its canonical digest *and* its
 *     verdict match the recorded ones, so the Python half agrees on the input
 *     as well as on the answer.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digestCanonicalJson } from "../src/v100/project-contract.mjs";
import { validateSemanticModel, BOUNDS } from "../src/v100/semantic-model.mjs";
import { DECLARED_BOUNDS, SHAPE_NAMES, SHAPE_PARAMETERS, mutate } from "./semantic-parity-shapes.mjs";

const ROOT = new URL("../", import.meta.url);
const OUTPUT_URL = new URL(
  "tests/components/glt_flow_card/fixtures/semantic-parity-corpus.json",
  ROOT,
);

export function generateSemanticParityCorpus() {
  // The shapes module declares the bounds standalone so the RED sentinel can
  // import it without a static dependency on the module under test. This is
  // the one place that holds both, so it is the one place that can catch a
  // divergence between them.
  for (const [key, value] of Object.entries(DECLARED_BOUNDS)) {
    if (BOUNDS[key] !== value) {
      throw new Error(
        `semantic-parity-shapes.mjs declares ${key}=${value}, but the model says ${BOUNDS[key]}`,
      );
    }
  }
  const shapes = SHAPE_NAMES.map((shape) => {
    const model = mutate(shape);
    return {
      shape,
      model_digest: digestCanonicalJson(model).digest,
      node_count: model.nodes.length,
      codes: validateSemanticModel(model).map((entry) => entry.code).sort(),
    };
  });
  return `${JSON.stringify({
    // Regenerate with: npm run generate:contract:parity
    generator: "tools/generate-semantic-parity-corpus.mjs",
    bounds: BOUNDS,
    parameters: SHAPE_PARAMETERS,
    shapes,
  }, null, 2)}\n`;
}

async function main() {
  const expected = generateSemanticParityCorpus();
  if (process.argv.includes("--check")) {
    let actual = "";
    try {
      actual = await readFile(OUTPUT_URL, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (actual !== expected) {
      throw new Error(
        "the semantic parity corpus is stale; run npm run generate:contract:parity",
      );
    }
    return;
  }
  await writeFile(OUTPUT_URL, expected, "utf8");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
