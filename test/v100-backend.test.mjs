import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const backend = await readFile(new URL("../custom_components/glt_flow_card/__init__.py", import.meta.url), "utf8");
const flow = await readFile(new URL("../custom_components/glt_flow_card/config_flow.py", import.meta.url), "utf8");
const constants = await readFile(new URL("../custom_components/glt_flow_card/const.py", import.meta.url), "utf8");

test("Companion contains server-side production workflows", () => {
  // `delay_seconds`, `hysteresis`, `notification` and `run_schedules` used to be
  // in this list. They are deleted rather than left passing beside the
  // behavioural tests: Phase 6's success criterion 5 names this exact check as
  // the thing to replace, and a keyword check that survives next to a real one
  // still reports success when the behaviour breaks and the word remains.
  //
  // What replaced them, and where the behaviour is now asserted:
  //
  //   delay_seconds   test_alarm_lifecycle.py -- two alarms on one entity with
  //                   different delays, each waiting its own
  //   hysteresis      test_alarm_lifecycle.py -- a walk across the band, plus a
  //                   stateless walk shown to differ
  //   notification    test_notification_delivery.py -- recorded outcome,
  //                   allowlist, and an alarm that survives a failed delivery
  //   run_schedules   test_schedule_dst.py -- both DST transitions, with the
  //                   dedupe cache disabled
  //
  // The tokens left here are route names and identifiers whose *presence* is
  // the claim; none of them stands in for a behaviour.
  for (const token of [
    "control/execute", "projects/lock", "revision_conflict", "alarms/ack", "alarms/shelve",
    "schedules/save", "schedules/preview", "work_orders/save",
    "reports/run", "remote/states", "remote/control", "SAFE_SERVICE_DOMAINS", "Context(user_id=uid)"
  ]) assert.ok(backend.includes(token), `missing backend token ${token}`);
});

test("Companion is configurable from Home Assistant UI", () => {
  assert.ok(flow.includes("ConfigFlow"));
  assert.ok(flow.includes("OptionsFlow"));
  assert.ok(flow.includes("normalize_options(user_input, strict=True)"));
  assert.ok(flow.includes("OPTION_SPECS"));
  for (const option of ["default_lock_ttl", "max_versions", "max_audit"]) {
    assert.ok(constants.includes(`\"${option}\"`), `missing effective option ${option}`);
  }
  assert.ok(backend.includes("entry.add_update_listener(_async_options_updated)"));
  assert.ok(backend.includes("hass.config_entries.async_reload(entry.entry_id)"));
  assert.ok(!flow.includes("server_enforced"), "inert server_enforced option must stay removed");
});
