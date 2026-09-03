# 07-04 — The history RED contracts

**Status:** complete. Four sentinels, each controlled RED for its own reason.

## What was written

| Sentinel | Threats | Reports missing |
|---|---|---|
| `test_history_routes.py` | T7-01 | declared routes, both policy tables, filter-not-deny, audit |
| `test_history_bounds.py` | T7-02 | three configured bounds, refusal or labelled downgrade |
| `test_series_coverage.py` | T7-03, T7-04, T7-05 | coverage, gaps, indeterminate binary samples |
| `test/replay-truth.test.mjs` | T7-06 | replay reading the record rather than the present |

## What the work found

**The gate's guard fired in the direction I could not test.** 07-01 added a
self-consistency check between `assert-red.mjs` and the gate's registry, and I
could only mutation-test one direction then. Registering the eleven identities
before wiring their commands produced eleven *"registered in assert-red.mjs but
has no command in this gate, so nothing runs it"* lines. The guard works, and it
was worth building: that is the failure that looks exactly like success.

**Naming an outcome is harder than naming a module, and it is the job.** The
first draft of the routes sentinel asserted `history_routes.filter_rows` exists.
That is the Phase-6 `schedule_audit` mistake exactly — a correct implementation
that filters inside the handler would fail a contract about where the filtering
lives. It asserts `ENUMERATION[route] == "filter"` instead: a property of the
declared boundary, not of the code that implements it.

Where a module genuinely must exist, `phase7_red.missing()` turns the absence
into a *gap* rather than letting the import abort collection. A sentinel that
fails at import tells `assert-red.mjs` the harness is broken, and the RED gate
correctly refuses to count that as controlled — so the honest report is "this
module does not exist yet", which is a specification, not an error.

**The bounds sentinel had to assert the absence of truncation.** Asserting that
an over-long window is refused is easy; the defect is that it might be silently
truncated instead, and a truncated window produces a chart of the wrong period
that looks exactly like a chart of the right one. So the sentinel names
`outcome: "truncate"` explicitly as a gap, rather than only checking for
`refuse`.

## Evidence at head

`node tools/phase7-red-gate.mjs` — 11 controlled RED, 0 implemented, 0 broken.
Each of the four reports exactly the module or behaviour its owning plan builds.
