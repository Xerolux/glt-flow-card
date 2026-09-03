import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const parts = await Promise.all([0,1,2,3,4,5,6].map((n) => readFile(new URL(`../src/v040-extension.part0${n}`, import.meta.url), "utf8")));
const source = parts.join("");

/**
 * Each token identifies a module. Where a module was identified by the German
 * wording it renders, that is a weak proxy: it breaks the moment the string is
 * catalogued — which is what happened to "Automatisch verbinden" — and it would
 * equally pass on a mention in a comment. A catalog key is the stable identity,
 * so the auto-connect module is now named by the key it renders.
 */
test("v0.4 engineering workspace source contains all major modules", () => {
  for (const token of [
    'EXT_VERSION = "0.4.0"',
    "YAML importieren",
    "Projektbibliothek",
    "Vorlagen & Bauteil-Templates",
    "legacy.auto_connect",
    "Alarme & Meldungen",
    "Wartung & Assets",
    "Benutzer & Rechte",
    "Audit-Log",
    "Trend+",
    "glt_flow_card/${type}",
    "Objektbedienung öffnen",
    "standard_2d",
    "pid_dark",
    "deep GLT symbols"
  ]) assert.ok(source.includes(token), `missing ${token}`);
});

/**
 * The authored parts must at least be JavaScript.
 *
 * The token test above proves each module is *mentioned*. It passed for the
 * whole life of this file while the joined source did not parse at all:
 * `part06` carried `id&&card?._hass?.states?.[id]||null:null`, a ternary whose
 * `?` was read as optional chaining, so the seven parts could never have been
 * bundled even by the manual workflow that is supposed to bundle them. Nobody
 * noticed because nothing ever asked node to read them.
 *
 * A parse is a low bar. It is also the bar this source spent five phases below.
 */
test("the joined v0.4 source is parseable JavaScript", async () => {
  const directory = await mkdtemp(join(tmpdir(), "glt-v040-"));
  const file = join(directory, "joined.mjs");
  await writeFile(file, source, "utf8");
  await promisify(execFile)(process.execPath, ["--check", file]);
});
