import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../dist/glt-flow-card.js", import.meta.url), "utf8");

test("registers the Home Assistant card", () => {
  assert.match(source, /customElements\.define\(CARD_TYPE, GltFlowCard\)/);
  assert.match(source, /name: "GLT Flow Card"/);
});

test("contains requested GLT feature foundations", () => {
  for (const token of ["_fitCanvas", "_ensureHistory", "_renderTrendChart", "positions", "background_fit", "glt-pipe-animated"]) {
    assert.ok(source.includes(token), `missing ${token}`);
  }
});
