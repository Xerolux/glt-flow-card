# Phase 4: Runtime Operations & Drill-Down - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning
**Mode:** Continuing the non-interactive full-delivery instruction that carried Phases 1, 2 and 3

<domain>
## Phase Boundary

This phase turns the validated model Phase 3 settled into something an operator can
actually work in. It builds the profile-driven object panel, the four separated
command outcomes, permission-filtered drill-down from portfolio to datapoint with
deep links and breadcrumbs, and reconnect/sequence-gap resynchronization that never
presents stale data as live.

It does **not** re-litigate authority. Phase 2 owns roles, capabilities, leases,
control resolution and the audit record; Phase 3 owns the hierarchy, provenance,
profiles, mapping and operational state. Phase 4 consumes all of it and adds no new
authority of its own. It does not build the CAD designer (Phase 5), alarm lifecycle
(Phase 6) or honest Recorder history (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### The panel model is composed on the server, not in the browser
- The browser must never decide which controls an operator may use. Phase 2 settled
  that browser role checks are UX only, and a panel that assembles its own control
  list from a profile plus a capability snapshot is exactly the browser-derived
  authority that rule exists to forbid.
- Therefore a new project-scoped route, `glt_flow_card/panels/get`, returns a
  composed panel model: the ordered regions, the resolved datapoint values, the
  operational state from Phase 3, the provenance summary, and **only** the control
  ids this principal may execute right now. A control the caller may not execute is
  absent from the response, not present-and-disabled.
- The panel model carries no domain, no service and no target. Phase 2 already
  resolves those server-side from the verified head, and a panel that echoed them
  would hand the browser a target to call directly.

### Authorization is per project, so restriction is per project
- **Correction made during execution.** The first operations corpus hid
  individual pieces of equipment inside one project, as though authorization
  were per-object. It is not: `AccessService.async_assign(project_id, user_id,
  role)` has no object granularity, so within a project membership is uniform.
  Building per-object ACLs here would duplicate an authority Phase 2 owns.
- The real boundary is the project, and the portfolio spans projects. The corpus
  is therefore two projects — one every principal may open, one only the
  engineer and admin may — and the enumeration threats bite there.
- Within an authorized project, roles differ by **capability**, not visibility:
  every member sees the same objects, and only a `control.execute` holder is
  offered a control.
- T4-04's count oracle moves with it, to where it actually bites: a portfolio
  total computed across every project and *then* filtered for display announces
  a fault in a project the caller is not a member of, even when the row itself
  is hidden. The restricted project holds the corpus's only fault so that any
  such total is visibly wrong.

### Navigation is a server-resolved address, not a client-side guess
- A deep link names a node in the Phase-3 hierarchy. Resolving it is an
  authorization decision, so `glt_flow_card/navigation/resolve` answers it. An
  unauthorized or non-existent target returns the one opaque
  `not_found_or_denied` shape Phase 2 established: a link the caller may not follow
  is indistinguishable from a link that does not exist.
- Breadcrumbs are built from the resolved ancestry the server returns, not by
  walking a locally cached tree. A cached tree can outlive the membership that
  admitted it, and a breadcrumb is a link.
- Aggregate counts (alarms in a subsystem, faults in a site) are computed server-side
  over the authorized scope only. A count is an enumeration oracle: "3 alarms" in a
  subtree the caller cannot open still tells them something exists there.

### Time and alarm context survive navigation
- The URL is the single source of navigation state: node address, selected time
  window and selected alarm. Component state that is not in the URL cannot be deep
  linked, and state duplicated in both drifts.
- Browser history uses `pushState` with a serialized address. Back and forward
  re-resolve through the server rather than replaying a cached view, because
  authority may have changed while the user was elsewhere.

### Command outcomes stay four distinct states
- Phase 2's `configured-control.mjs` already distinguishes accepted, dispatched,
  readback-confirmed, timed-out, denied, failed and result-unknown, and only
  `readback_confirmed` counts as success. Phase 4 surfaces those states; it does not
  collapse, re-derive or add to them.
- The panel proves, in exact-dist evidence, that the target and result it displays
  match the Companion's authoritative audit record for the same command id. A
  displayed outcome that the audit record does not support is the repudiation
  failure this phase must close.

### Reconnect resynchronizes; it never guesses
- The subscription registry already stamps a monotonic sequence. Phase 4 adds the
  client half: a snapshot carries the sequence it was taken at, each event carries
  its own, and a gap between them is detected rather than smoothed over.
- On a gap, on a reconnect, or on an authority change, the view marks itself stale
  and requests a fresh snapshot. It does not interpolate, and it does not require a
  page reload. Stale data is rendered as visibly stale, never as live.

### Trends and the Phase-7 boundary
- The roadmap lists "Recorder trends" in the object panel, and HIST-01 in Phase 7
  owns honest Recorder-backed history with coverage and provenance. Building a
  history data path here would duplicate that ownership, and the roadmap forbids
  duplicate ownership.
- **Decision, flagged for the user:** Phase 4 owns the trend *region contract* — its
  place in the panel, its capability gate and its declared states — and renders a
  declared `history_unavailable` state until Phase 7 supplies the data path. This is
  the same precedent Phase 2 set with `RoleMatrixDisclosure`: an unavailable region
  that says so beats a region that invents its content.
- The legacy base card's direct `hass.callApi("GET", "history/period/...")` is **not**
  carried into the new panel. It is unbounded, unfiltered and browser-authored; Phase
  7 replaces it. Phase 4 must not extend it.
- Hours and starts *are* delivered here: a profile declares them as datapoints and
  they arrive as ordinary live entity values, needing no Recorder read.

### The legacy operate path is retired, not wrapped
- `src/v040-extension.part06` still contains a `call-service` tap action guarded by a
  browser-side `canOperate(card)` check and a `confirm()` dialog. That is both a
  browser-invented permission and a direct privileged fallback — two of the four
  defects this phase is named for. Phase 4 retires the path the way Phase 2 retired
  `glt_flow_card/control/execute`: declared retired, failing closed with zero
  effects, with a test that proves no service call can be reached through it.

</decisions>

<constraints>
## Constraints Carried Forward

- No live Home Assistant writes, remote-site writes, physical-bus writes, plant or
  equipment service calls, or credential handling. Live control validation needs
  separate approval with exact bounded targets.
- No release is authorized.
- Browser role checks are UX only. Every shared read, write, control, remote call and
  authoritative audit event is enforced server-side.
- Edit authored modules and generators. An isolated change to
  `dist/glt-flow-card.js` or the Companion `www` copy is never complete.
- A Companion file imported at module scope must be added to all three packaging
  lists: `tools/stage-hacs-packages.mjs`, `tools/validate-hacs-staging.mjs` and
  `test/hacs-staging.test.mjs`. Phase 3 learned this from a red `ha-artifacts` run
  that every local gate had passed.
- Every new route must appear in `COMMAND_POLICIES`. The registration oracle requires
  declared routes to equal registered routes exactly, so a route added to one and not
  the other fails closed at import.
- Controlled RED requires a named sentinel, a literal `EXPECTED_RED[...]` marker and
  the matching effect ledger.

</constraints>

<risks>
## Known Risks

- **Panel composition is a new server surface with a wide blast radius.** It reads the
  project, the profile, the registries and the ACL in one call. It must filter before
  serialization, like every Phase-2 collection route, or it becomes the widest
  enumeration oracle in the product.
- **Deep links are shareable.** A URL pasted into a chat is opened by a different
  principal. Every resolve is a fresh authorization; nothing about a link may be
  trusted because it was once valid for someone else.
- **Sequence-gap handling is easy to get subtly wrong.** A view that resyncs on every
  event is a denial-of-service against its own backend; one that resyncs too rarely
  shows stale data as live. The bound belongs in the plan, not in a later fix.
- **The kiosk/leitstand layout has no pointer.** Keyboard-only reachability is not an
  accessibility nicety there; it is the only input path.
- **Four layouts times two languages times the outcome states is a large exact-dist
  matrix.** It needs to be enumerated in the validation map, not discovered while
  writing tests.

</risks>
