/**
 * The recorded JavaScript verdicts are current (T3-01, T3-12).
 *
 * The Python suite compares against `semantic-parity-corpus.json` because the
 * Home Assistant lanes have no `node` binary. That comparison is only worth
 * anything while the recording matches what JavaScript actually decides today,
 * so this test regenerates the corpus and requires the committed file to be
 * exactly it. A rule changed in `semantic-model.mjs` without regenerating fails
 * here, in the Node suite, where a JavaScript change belongs.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateSemanticParityCorpus } from "../tools/generate-semantic-parity-corpus.mjs";
import { REJECTED_SHAPES, SHAPE_NAMES } from "../tools/semantic-parity-shapes.mjs";

const CORPUS_URL = new URL(
  "../tests/components/glt_flow_card/fixtures/semantic-parity-corpus.json",
  import.meta.url,
);

test("the committed parity corpus is what JavaScript produces today", async () => {
  const committed = await readFile(CORPUS_URL, "utf8");
  assert.equal(
    committed,
    generateSemanticParityCorpus(),
    "stale corpus; run npm run generate:contract:parity",
  );
});

test("every rejected shape is recorded, and the valid base with it", async () => {
  const corpus = JSON.parse(await readFile(CORPUS_URL, "utf8"));
  const recorded = corpus.shapes.map((entry) => entry.shape);
  assert.deepEqual(recorded, [...SHAPE_NAMES]);
  for (const shape of REJECTED_SHAPES) {
    const entry = corpus.shapes.find((candidate) => candidate.shape === shape);
    assert.ok(entry.codes.length > 0, `${shape} must be rejected`);
  }
});

test("the valid base is accepted, so a corpus of only failures cannot pass", async () => {
  const corpus = JSON.parse(await readFile(CORPUS_URL, "utf8"));
  const valid = corpus.shapes.find((entry) => entry.shape === "valid");
  assert.deepEqual(valid.codes, []);
});

test("each shape has a distinct model digest", async () => {
  const corpus = JSON.parse(await readFile(CORPUS_URL, "utf8"));
  const digests = corpus.shapes.map((entry) => entry.model_digest);
  assert.equal(new Set(digests).size, digests.length);
});
