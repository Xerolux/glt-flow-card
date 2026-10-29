/**
 * The render signature answers one question: would a full re-render produce
 * the same screen?
 *
 * The defect this replaces rebuilt a two-thousand-object shadow DOM on every
 * published hass object — several per second on a busy bus — even when none of
 * the card's own entities moved. The signature must therefore be blind to
 * unrelated churn and deaf to nothing: every input the render reads (referenced
 * states, attributes, locale, user, theme darkness) moves the signature.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { renderSignature } from "../src/v100/render-signature.mjs";

function hassFixture() {
  return {
    locale: { language: "de" },
    themes: { darkMode: false },
    user: { id: "user-a", is_admin: true },
    states: {
      "sensor.flow": { state: "12.4", last_updated: "2026-10-29T07:00:00Z" },
      "sensor.tank": { state: "43", last_updated: "2026-10-29T07:00:00Z" },
      "sensor.unrelated": { state: "1", last_updated: "2026-10-29T07:00:00Z" },
    },
  };
}

const ENTITIES = ["sensor.flow", "sensor.tank"];

test("unrelated state churn does not move the signature", () => {
  const before = renderSignature(hassFixture(), ENTITIES);
  const after = hassFixture();
  after.states["sensor.unrelated"] = { state: "999", last_updated: "2026-10-29T07:09:00Z" };
  assert.equal(renderSignature(after, ENTITIES), before);
});

test("a referenced state value moves the signature", () => {
  const before = renderSignature(hassFixture(), ENTITIES);
  const after = hassFixture();
  after.states["sensor.flow"].state = "13.1";
  assert.notEqual(renderSignature(after, ENTITIES), before);
});

test("an attribute-only change moves the signature", () => {
  // `last_changed` would stand still here and present a stale unit as fresh;
  // the signature reads `last_updated`, which advances with the state object.
  const before = renderSignature(hassFixture(), ENTITIES);
  const after = hassFixture();
  after.states["sensor.tank"] = {
    state: "43",
    last_changed: "2026-10-29T07:00:00Z",
    last_updated: "2026-10-29T07:05:00Z",
    attributes: { unit_of_measurement: "°C" },
  };
  assert.notEqual(renderSignature(after, ENTITIES), before);
});

test("a referenced entity appearing or vanishing moves the signature", () => {
  const before = renderSignature(hassFixture(), ENTITIES);
  const appeared = hassFixture();
  appeared.states["sensor.new"] = { state: "5", last_updated: "2026-10-29T07:06:00Z" };
  assert.notEqual(renderSignature(appeared, [...ENTITIES, "sensor.new"]), before);
  assert.notEqual(renderSignature(appeared, ENTITIES), renderSignature(appeared, ["sensor.flow"]));
});

test("locale, user and theme darkness move the signature", () => {
  const before = renderSignature(hassFixture(), ENTITIES);
  const locale = hassFixture();
  locale.locale.language = "en";
  assert.notEqual(renderSignature(locale, ENTITIES), before);
  const user = hassFixture();
  user.user = { id: "user-b", is_admin: false };
  assert.notEqual(renderSignature(user, ENTITIES), before);
  const theme = hassFixture();
  theme.themes.darkMode = true;
  assert.notEqual(renderSignature(theme, ENTITIES), before);
});

test("an absent hass is a stable signature, and entity order is irrelevant", () => {
  assert.equal(renderSignature(null, ENTITIES), renderSignature(undefined, ["sensor.other"]));
  assert.equal(
    renderSignature(hassFixture(), ENTITIES),
    renderSignature(hassFixture(), [...ENTITIES].reverse()),
  );
});
