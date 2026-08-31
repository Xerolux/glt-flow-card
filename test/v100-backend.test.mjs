import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const backend = await readFile(new URL("../custom_components/glt_flow_card/__init__.py", import.meta.url), "utf8");
const flow = await readFile(new URL("../custom_components/glt_flow_card/config_flow.py", import.meta.url), "utf8");

test("Companion contains server-side production workflows", () => {
  for (const token of [
    "control/execute", "projects/lock", "revision_conflict", "alarms/ack", "alarms/shelve",
    "delay_seconds", "hysteresis", "notification", "run_schedules", "work_orders/save",
    "reports/run", "remote/states", "remote/control", "SAFE_SERVICE_DOMAINS", "Context(user_id=uid)"
  ]) assert.ok(backend.includes(token), `missing backend token ${token}`);
});

test("Companion is configurable from Home Assistant UI", () => {
  assert.ok(flow.includes("ConfigFlow"));
  assert.ok(flow.includes("OptionsFlow"));
  assert.ok(flow.includes("server_enforced"));
});
