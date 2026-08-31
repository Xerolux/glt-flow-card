import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../dist/glt-flow-card.js", import.meta.url), "utf8");

test("v0.4 engineering workspace is bundled", () => {
  for (const token of [
    'VERSION = "0.4.0"',
    "GLT Flow Card v0.4 extensions",
    "YAML importieren",
    "Projektbibliothek",
    "Vorlagen & Bauteil-Templates",
    "Automatisch verbinden",
    "Alarme & Meldungen",
    "Wartung & Assets",
    "Benutzer & Rechte",
    "Audit-Log",
    "Trend+",
    "glt_flow_card/projects/list"
  ]) assert.ok(source.includes(token), `missing ${token}`);
});
