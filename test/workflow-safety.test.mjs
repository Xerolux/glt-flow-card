/**
 * No workflow can push a downgrade to the default branch (close-out review).
 *
 * `apply-v040.yml` bundles `src/v040-extension.part*`, hands the result to
 * `tools/apply-v040.mjs` — which sets `package.json` to **0.4.0** and rewrites
 * `dist/glt-flow-card.js`, both READMEs, the changelog and the smoke test —
 * and then commits and pushes to `main`. The product is 1.1.
 *
 * It fired on any push to `main` that touched those parts. It did not corrupt
 * anything only because `apply-v040.mjs` looks for a `0.3.0`/`0.4.0` version
 * anchor, finds `1.0.0`, and throws first. A thrown exception is not a safety
 * property: it holds until somebody edits that one string.
 *
 * These assertions are about the *trigger*, because that is the part that
 * decides whether a person chose to run it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOWS = path.join(ROOT, ".github/workflows");

/** The `on:` block, up to the next top-level key. */
function triggerBlock(source) {
  const start = source.search(/^on:/mu);
  assert.notEqual(start, -1, "no `on:` block");
  const rest = source.slice(start + 3);
  const end = rest.search(/^\S/mu);
  return end === -1 ? rest : rest.slice(0, end);
}

test("apply-v040 cannot be triggered by a push", async () => {
  const source = await readFile(path.join(WORKFLOWS, "apply-v040.yml"), "utf8");
  const on = triggerBlock(source);
  assert.ok(!/\bpush\b/u.test(on),
    "apply-v040 is push-triggered again. It downgrades package.json to 0.4.0 and "
    + "pushes to main; only a person invoking it deliberately may start it.");
  assert.ok(/workflow_dispatch/u.test(on),
    "apply-v040 has no trigger at all. It is meant to stay reachable — it is the "
    + "only thing that knows how to bundle the seven v0.4 parts.");
});

test("the guard reads the trigger, not the whole file", async () => {
  // Vacuity guard. The file's own comment explains the push trigger at length,
  // so a naive grep for "push" over the source would fail on the explanation
  // rather than on the trigger, and would keep failing after a correct fix.
  const source = await readFile(path.join(WORKFLOWS, "apply-v040.yml"), "utf8");
  assert.ok(/push/u.test(source), "the explanatory comment is gone");
  assert.ok(!/\bpush\b/u.test(triggerBlock(source)), "but the trigger is clean");
});

test("every workflow that can write to the repository says what starts it", async () => {
  // A `contents: write` workflow started by a push is how a bot commit reaches
  // main without anybody deciding. Each one here is deliberate and named.
  const expected = new Map([
    ["apply-v040.yml", "workflow_dispatch"],
    ["screenshots.yml", "push"],
    ["docs.yml", "push"],
  ]);
  for (const [file, how] of expected) {
    const source = await readFile(path.join(WORKFLOWS, file), "utf8");
    assert.ok(new RegExp(`\\b${how}\\b`, "u").test(triggerBlock(source)),
      `${file} no longer declares ${how}; re-read what it writes before changing it`);
  }
});
