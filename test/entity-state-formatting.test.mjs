import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function card() {
  const elements = new Map();
  const context = vm.createContext({
    window: { customCards: [] },
    HTMLElement: class {},
    customElements: { define: (name, value) => elements.set(name, value), get: (name) => elements.get(name) },
    console: { info() {}, warn() {} },
    document: {},
  });
  vm.runInContext(readFileSync(new URL("../src/generated-bases/glt-flow-card.base.js", import.meta.url), "utf8"), context);
  const instance = Object.create(elements.get("glt-flow-card").prototype);
  instance._hass = { states: { "sensor.mode": { entity_id: "sensor.mode", state: "timed_program", attributes: { description: "raw text" } } } };
  return instance;
}

test("non-numeric live states use Home Assistant's configured translations", () => {
  const instance = card();
  instance._hass.formatEntityState = (state) => state.state === "timed_program" ? "Zeitprogramm" : state.state;
  assert.equal(instance._display("sensor.mode"), "Zeitprogramm");
});

test("attribute text is not replaced with the formatted entity state", () => {
  const instance = card();
  instance._hass.formatEntityState = () => "Zeitprogramm";
  assert.equal(instance._display({ entity: "sensor.mode", attribute: "description" }), "raw text");
});

test("replay formats the historical state rather than today's live mode", () => {
  const instance = card();
  instance._replayActive = true;
  instance._replayTime = new Date("2026-10-01T12:00:00Z");
  instance._history = new Map([["sensor.mode", [{ last_changed: "2026-10-01T11:00:00Z", state: "off", attributes: {} }]]]);
  instance._hass.formatEntityState = (state) => state.state === "off" ? "Aus" : "Zeitprogramm";
  assert.equal(instance._display("sensor.mode"), "Aus");
});

test("standalone and unavailable states retain their existing fallbacks", () => {
  const instance = card();
  assert.equal(instance._display("sensor.mode"), "timed_program");
  instance._hass.states["sensor.mode"].state = "unavailable";
  instance._hass.formatEntityState = () => "incorrect";
  assert.equal(instance._display("sensor.mode"), "–");
});
