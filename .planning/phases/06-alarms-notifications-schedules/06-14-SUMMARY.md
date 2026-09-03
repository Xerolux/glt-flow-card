# 06-14 Summary — Home Assistant bindings

**Status:** complete. 12 binding tests.

Capability is read **before** an affordance is offered — the defect shape Phase 4
closed for controls. `create`, `update` and `delete` are reported separately,
because a calendar can declare any subset.

The admin refusal is distinct from the capability refusal: "this calendar cannot
be written to" and "you may not write to it" need different answers from the
person reading them, and it is reported before the websocket call.

`binary_sensor.workday` binds read-only and says so. German public holidays are
per-Bundesland; a table shipped here would be wrong for half the country. There
is a test asserting this repository ships no such table.

The `CalendarEntityFeature` values are mirrored rather than imported, with a test
asserting they match — an import would make a silent renumbering invisible.
