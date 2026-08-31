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


test("drag and drop editor foundations", () => {
  for (const token of ["class GltFlowCardEditor", "data-pk", "_drop(e,c)", "_undo()", "_redo()", "data-hi", "Eigenes Bild / SVG"]) {
    assert.ok(source.includes(token), `missing editor token ${token}`);
  }
});


test("Neo 2030 designer, native entities and YAML export", () => {
  for (const token of ["VERSION = \"1.0.0\"", "SYMBOL_LIBRARY", "ha-entity-picker", "configToYaml", "glt-style-neo2030", "classic_scada", "data-preview", "YAML kopieren"]) {
    assert.ok(source.includes(token), `missing ${token}`);
  }
});
