# Phase 6 context — Alarms, Notifications & Schedules

**Requirements:** ALM-01, ALM-02, SCH-01
**Depends on:** Phase 5
**Mode:** mvp

## Phase Boundary

**In scope.** One restart-safe backend alarm lifecycle; notification and
escalation policies that target explicitly configured Home Assistant notify
services and record every attempt; weekly schedules with holidays, exceptions,
vacations, special days and operating periods, bound through supported Home
Assistant capabilities, with a preview that shows the effective value across
timezone and DST boundaries.

**Out of scope.** Trend and history reads (Phase 7 owns HIST-01). Remote sites
(Phase 9). Anything that sends a notification to a real recipient during a test
run — the standing constraint stands: no live Home Assistant writes.

## Implementation Decisions

### The backend owns the lifecycle, and the browser renders it

There are four derivations of "is this alarm active" in the product today, and
they disagree — the audit names them. Three derivations that disagree is worse
than one that is wrong: a single wrong answer is at least consistent, and an
operator can learn it. Four inconsistent answers cannot be learned at all.

So: the Companion evaluates, and every surface renders what it evaluated. This
is the same rule Phase 4 established for control lists and Phase 2 for
authority, and it is here for the same reason — a browser deciding for itself
works from a snapshot that can be minutes old.

The legacy evaluators are **retired reachable and inert**, the way Phase 5
retired the midpoint router, so a test proves the replacement rather than
proving the absence of something nothing checks.

### Suppression is consulted where the decision is made

Shelving today writes a field nothing reads. That is not a partial feature; it
is a feature that reports success and does nothing, which is worse than one
that is missing, because the operator believes the alarm is quiet.

Suppression — shelving, maintenance, acknowledgement — is therefore evaluated
at the point of decision, in one function, and the decision records *which*
suppression applied. An alarm that did not notify must be able to say why.

### A delay is "continuously active", not "quiet"

The current delay cancels and restarts on every intermediate change, so a
sensor oscillating faster than the delay never annunciates. That is the
opposite of what a delay is for: it exists to suppress a *transient*, not to
suppress a *persistent* fault that happens to be noisy.

The delay is therefore anchored to the first activation and not restarted by
subsequent active states.

### Failure is recorded, and it is visible

A notification and a schedule execution are both outward-facing effects, and
both currently discard their outcome twice — `blocking=False` throws the result
away and a bare `except` throws the exception away.

Every attempt gets a recorded result. A delivery failure never removes,
suppresses or downgrades the alarm: an alarm nobody could be told about is more
urgent than one they were told about, not less.

### The alarm philosophy is configuration, with conservative defaults

**Decided with the user, 2026-09-02.** Priorities, shelving limits, escalation
stages, recipients and retention are *site* decisions, not product decisions. A
plant's alarm philosophy belongs to the plant. Baking one in would be wrong for
every site that does not share it.

So the mechanism is built and the policy is configured. The defaults are
conservative and each is documented as a site decision:

| Setting | Default | Why this default |
|---|---|---|
| Shelving maximum | 7 days | Long enough for a planned outage, short enough that a forgotten shelf expires |
| Escalation targets | none | An unconfigured installation notifies nobody rather than guessing a recipient |
| Notify service allowlist | empty, explicit opt-in | Matches how schedules and controls already guard their service domains |
| Alarm history | bounded, oldest dropped | Retained state that grows without a bound is a leak with a friendly name |
| Escalation stages | none until configured | An escalation nobody asked for is a page at 3am nobody asked for |

An unconfigured installation is therefore quiet and safe, not silently
escalating to whatever service string a project document happened to carry.

### Schedules get a declared shape and a real surface

Schedules today are project config with no schema, no route, no authorization
boundary of their own and no audit of an edit. Every field the runner reads is
undeclared, so a `time` of `"tea"` is schema-valid.

Phase 6 closes the shape, adds the authorized routes, and audits execution and
failure. Holidays, exceptions, vacations, special days and operating periods
are *bindings* to supported Home Assistant capabilities where those exist —
this card does not reimplement a calendar.

### DST is a correctness question, not an edge case

Local wall-clock strings are compared directly today. Spring-forward silently
skips a schedule in the lost hour; fall-back is saved from double-firing only
incidentally, by a dedupe key that mixes local time into a UTC-stored value.

Both are ordinary in a heating plant: a night setback at 02:30 exists on most
sites in the country this card is written for. The preview must show the
effective value across the transition, and the runner must be right there
without relying on a dedupe key to hide it.

## Constraints Carried Forward

- No live Home Assistant writes, remote-site writes, physical-bus writes,
  plant or equipment calls, or credential handling. Notifications are tested
  against the controlled fake service the Phase-2 fixtures already provide.
- Browser role checks are UX only; every shared read, write, control and
  authoritative audit event requires server-side enforcement.
- Source of truth is the authored module *and* the generated artifact. Phase 5
  found retirements that existed only in files nobody ships; a Phase-6 claim
  about the card is checked against `dist/glt-flow-card.js`.
- No release is authorized.

## Known Risks

- **The second evaluator is load-bearing for existing users.** Retiring it
  changes what a card displays today. It is retired reachable and inert, and
  the exact-artifact tests assert the shipped bytes.
- **Restart behaviour is hard to test honestly.** The restart defect needs a
  test that actually restarts — an entity going `unavailable` and back — rather
  than one that asserts the guard exists.
- **An entity→alarm index is a cache.** A cache that misses a rebuild is a
  worse defect than the scan it replaces, so it is rebuilt from one place and
  the rebuild is asserted, not assumed.
