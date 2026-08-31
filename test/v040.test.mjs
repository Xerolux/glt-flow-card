import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const parts = await Promise.all([0,1,2,3,4,5].map((n) => readFile(new URL(`../src/v040-extension.part0${n}`, import.meta.url), "utf8")));
const source = parts.join("");

test("v0.4 engineering workspace source contains all major modules", () => {
  for (const token of [
    'EXT_VERSION = "0.4.0"',
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
