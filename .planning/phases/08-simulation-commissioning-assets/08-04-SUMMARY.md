# 08-04 — Scenarios as pure functions

**Status:** complete. Closes T8-07 and T8-08.

Home Assistant offers an integration no virtual clock. The design that
constraint forced is better than a clock would have been:

- **reproducible by construction** — tick *n* yields the same state on any
  machine, at any time, in any order;
- **evaluable without waiting** — a ten-hour rehearsal is a test that runs in
  milliseconds;
- **evaluable for entities that do not exist yet**, which SIM-01 explicitly
  requires and no clock-based design could give, because nothing is read from
  the state machine to produce the answer.

The single-tick ramp is the degenerate case and where an off-by-one lives:
dividing by `ticks - 1` is the natural formula and divides by zero. A one-tick
ramp holds its start value, and the corpus contains that case.

Past the end a scenario **holds** rather than becoming undefined. "What does the
plant do after the rehearsal ends" needs an answer, and `None` would render as a
blank that reads as zero.

Values are validated at authoring time against the slot's declared unit and
device class, with both sides named — the shipped path stored the input box's
string verbatim.
