/**
 * The recorded JavaScript verdicts on SDK manifests are current (T5-12).
 *
 * The Python suite compares against `sdk-parity-corpus.json` because the Home
 * Assistant lanes have no `node` binary. That comparison is only worth anything
 * while the recording matches what JavaScript actually decides today, so this
 * regenerates the corpus and requires the committed file to be exactly it. A
 * rule changed in `sdk-manifest.mjs` without regenerating fails here, in the
 * Node suite, where a JavaScript change belongs.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MANIFEST_REFUSALS } from "../src/v100/sdk-manifest.mjs";
import {
  SDK_CORPUS_PATH, SDK_PARITY_CASES, generateSdkParityCorpus,
} from "../tools/generate-sdk-parity-corpus.mjs";

test("the committed SDK parity corpus is what JavaScript produces today", async () => {
  const committed = await readFile(SDK_CORPUS_PATH, "utf8");
  assert.equal(committed, generateSdkParityCorpus(),
    "stale corpus; regenerate with npm run generate:sdk:parity");
});

test("every case is recorded, and each name appears once", async () => {
  const corpus = JSON.parse(await readFile(SDK_CORPUS_PATH, "utf8"));
  const names = corpus.cases.map((entry) => entry.case);
  assert.deepEqual(names, SDK_PARITY_CASES.map(([name]) => name));
  assert.equal(new Set(names).size, names.length);
});

test("the corpus proves both directions", async () => {
  // A corpus of only refusals proves a validator that refuses everything.
  const corpus = JSON.parse(await readFile(SDK_CORPUS_PATH, "utf8"));
  const accepted = corpus.cases.filter((entry) => entry.valid);
  assert.ok(accepted.length >= 4, "nothing in the corpus is accepted");
  for (const entry of accepted) assert.deepEqual(entry.codes, [], entry.case);
  assert.ok(corpus.cases.filter((entry) => !entry.valid).length >= 20);
});

test("each hostile case is refused, and names itself among the reasons", async () => {
  const corpus = JSON.parse(await readFile(SDK_CORPUS_PATH, "utf8"));
  // The case names were chosen to be the code each is about, where a single
  // code is the point. Where the name describes a variant of one, it is mapped.
  const expected = {
    script_element_uppercase: "script_element",
    event_handler_mixed_case: "event_handler_attribute",
    external_reference_href: "external_reference",
    external_reference_url_token: "external_reference",
    external_reference_xlink: "external_reference",
    javascript_url_entity_encoded: "javascript_url",
    javascript_url_whitespace: "javascript_url",
    contribution_namespace_prefix_only: "contribution_outside_namespace",
    contribution_not_an_object: "contribution_payload_missing",
    schema_versions_boolean: "schema_versions_unsupported",
  };
  for (const entry of corpus.cases) {
    if (entry.valid) continue;
    const code = expected[entry.case] ?? entry.case;
    assert.ok(entry.codes.includes(code),
      `${entry.case} was refused as ${entry.codes.join(", ")}`);
  }
});

test("every code the corpus reaches is a declared refusal", async () => {
  const corpus = JSON.parse(await readFile(SDK_CORPUS_PATH, "utf8"));
  const declared = new Set(MANIFEST_REFUSALS);
  for (const entry of corpus.cases) {
    for (const code of entry.codes) {
      assert.ok(declared.has(code), `${entry.case} produced an undeclared code: ${code}`);
    }
  }
});
