# 08-16 — Documentation and closure

**Status:** complete.

Two German wiki pages with sections in both READMEs.

`Assets-Maintenance.md` was **rewritten rather than extended**. The existing page
documented `due_date` and `service_interval_hours` as though they worked, and
implied a CMMS the requirements explicitly rule out. Both are now stated
plainly.

**The register was closed from commands**, each row from its own owner command
run at head, and rows sharing a command run per row.

**Two owner commands named files that did not exist** — the session tests had
been written inside the gate file and the scenario tests existed only as a manual
check. Both were written where the register says they live, rather than editing
the register to match what happened to exist. A register edited to match reality
is a register that proves nothing.

T8-25 stays `planned`, marked from its own run with its exact Docker failure
recorded rather than inferred from its parts — the error Phase 5's closure made
and Phase 6's corrected.
