import { test } from "node:test";
import assert from "node:assert/strict";
import { readPanel } from "../src/v100/panel-read.mjs";

test("panel reads share pending work, but do not cache completed answers", async () => {
  let finish;
  let calls = 0;
  const owner = { _hass: { callWS: () => { calls++; return new Promise(resolve => { finish = resolve; }); } } };
  const first = readPanel(owner, "alarms/list", { project_id: "a" });
  assert.equal(readPanel(owner, "alarms/list", { project_id: "a" }), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish({ states: [] });
  await first;
  const next = readPanel(owner, "alarms/list", { project_id: "a" });
  await Promise.resolve();
  assert.equal(calls, 2);
  finish({ states: ["new"] });
  assert.deepEqual(await next, { states: ["new"] });
});

test("a timed out read releases the slot and late completion cannot replace a retry", async () => {
  let finish;
  const owner = { _hass: { callWS: () => new Promise(resolve => { finish = resolve; }) } };
  await assert.rejects(readPanel(owner, "history/series", {}, { timeoutMs: 5 }), /timed out/);
  const late = finish;
  const retry = readPanel(owner, "history/series", {});
  await Promise.resolve();
  late({ old: true });
  assert.equal(readPanel(owner, "history/series", {}), retry);
  finish({ fresh: true });
  assert.deepEqual(await retry, { fresh: true });
});

test("project and transport changes never reuse an older pending read", async () => {
  const owner = { _hass: { callWS: async request => request.project_id } };
  const first = readPanel(owner, "alarms/list", { project_id: "a" });
  const second = readPanel(owner, "alarms/list", { project_id: "b" });
  assert.notEqual(first, second);
  assert.deepEqual(await Promise.all([first, second]), ["a", "b"]);
  owner._hass.callWS = async () => "new connection";
  assert.equal(await readPanel(owner, "alarms/list", { project_id: "a" }), "new connection");
});
