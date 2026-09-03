/**
 * The shipped card asks for nothing through a browser dialog (CAD-01, T5-11).
 *
 * This guard exists because of what it found. Phase 4 retired the legacy
 * control paths in `src/v040-extension.part05` and `part06` — and those files
 * are not build inputs. They are the authored form of an extension that a
 * manual workflow bundles and applies, and it was never run, so every one of
 * those retirements existed only in a file nobody ships. The card in
 * `dist/glt-flow-card.js` still carried the original: a browser-side role
 * check, a `window.confirm` standing in for an authorization prompt, and a
 * call through to `hass.callService`.
 *
 * A test over the authored sources would have kept passing. So this one reads
 * the artifact.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const DIST = new URL("../dist/glt-flow-card.js", import.meta.url);
const COMPANION = new URL(
  "../custom_components/glt_flow_card/www/glt-flow-card.js", import.meta.url,
);

/** Not a member access, not a property name: a bare call to the global. */
const BARE_CALL = (name) => new RegExp(`[^\\w.$]${name}\\s*\\(`, "g");

const shipped = await readFile(DIST, "utf8");

test("the shipped bytes are the Companion's bytes", async () => {
  assert.equal(shipped, await readFile(COMPANION, "utf8"));
});

test("no shipped path opens a browser alert or confirmation", () => {
  for (const name of ["alert", "confirm"]) {
    const found = [...shipped.matchAll(BARE_CALL(name))].map((match) => (
      shipped.slice(Math.max(0, match.index - 60), match.index + 60).replace(/\s+/g, " ")
    ));
    assert.deepEqual(found, [], `dist/glt-flow-card.js still calls ${name}()`);
  }
});

test("the legacy tap and execute paths are inert, and still reachable", () => {
  // Reachable rather than deleted: a retired entry point that still exists is
  // one the effect ledger can prove does nothing. A deleted one moves the proof
  // somewhere nothing checks.
  assert.match(shipped, /_tapEntity/, "the legacy tap entry point was deleted rather than retired");
  assert.match(shipped, /legacy_tap_retired/, "the legacy tap path is not the retired one");
  assert.match(shipped, /legacy_execute_retired/, "the legacy execute path is not the retired one");

  // Neither retired path may reach a service call. The bodies are matched from
  // their audit reason to the end of the function they sit in.
  for (const marker of ["legacy_tap_retired", "legacy_execute_retired"]) {
    const at = shipped.indexOf(marker);
    assert.ok(at > 0, marker);
    const body = shipped.slice(at, at + 400);
    assert.ok(!body.includes("callService"), `${marker} still reaches callService`);
    assert.ok(!body.includes("originalTap"), `${marker} still calls through to the base tap`);
  }
});

test("a browser-side role check no longer gates a control", () => {
  // `canOperate` was three defects stacked: a role the browser decided, a
  // confirmation the browser owned, and a service call the browser made. The
  // name may survive in a comment; a call to it may not gate anything.
  const gating = [...shipped.matchAll(/if\s*\(\s*!\s*canOperate\s*\(/g)];
  assert.deepEqual(gating.map((match) => match.index).length, 0,
    "a browser-side role check still guards a path in the shipped card");
});
