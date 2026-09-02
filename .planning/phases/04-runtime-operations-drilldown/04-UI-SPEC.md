# Phase 04 UI Contract

The contract the exact generated artifact must satisfy. Written before implementation
so the exact-dist tests assert a specification rather than describing whatever got
built.

## Custom elements

| Element | Responsibility |
|---|---|
| `glt-flow-card-object-panel` | Renders one server-composed panel model. Owns no authority logic: it renders the regions it is given, in the order it is given them. |
| `glt-flow-card-breadcrumbs` | Renders the resolved ancestry as links, preserving time and alarm context in each address. |
| `glt-flow-card-drilldown-list` | Renders the authorized children of the current node with their Phase-3 state badges and authorized counts. |
| `glt-flow-card-outcome-strip` | Renders the current command outcome state and its trusted-audit reference. Never renders a retry affordance for an unknown-effect state. |
| `glt-flow-card-view-staleness` | The persistent staleness indicator: live, resyncing, stale, or unavailable, with the reason. |

All five extend the Phase-2/3 surfaces rather than replacing them.
`glt-flow-card-authority-bar`, `glt-flow-card-control-confirm`,
`glt-flow-card-state-badge` and `glt-flow-card-provenance-card` are reused as-is.

## Panel regions

The panel model is an ordered list of regions. The kinds are a closed set:

| Kind | Content | Empty behavior |
|---|---|---|
| `identity` | Name, semantic path, profile and version | Never empty |
| `state` | The Phase-3 resolved operational state, with symbol and label | Never empty |
| `values` | Profile-declared datapoints with unit and value | Renders "no values declared" |
| `runtime` | Hours and starts, when the profile declares them as datapoints | Omitted when undeclared |
| `quality` | Provenance and communication health from Phase 3 | Never empty |
| `alarms` | Authorized alarms for this object | Renders "no alarms" |
| `controls` | The controls this principal may execute, now | Renders "no controls available to you" |
| `trend` | The Phase-7 region | Renders the declared `history_unavailable` state |

A region the server did not send is not rendered. The browser never synthesizes one.

## The controls region

- A control the caller may not execute is **absent**. There is no disabled control and
  no "you need role X" hint: both are enumeration.
- Selecting a control opens Phase 2's `glt-flow-card-control-confirm`. The confirm
  dialog names the object and the control label; it never displays a domain, service
  or entity target, because the panel model does not carry them.
- The region is entirely absent, with a single explanatory line, when the principal
  holds no `control.execute` capability on this project.

## Outcome presentation

| State | Presentation | Affordance |
|---|---|---|
| `accepted` | "Accepted — awaiting dispatch", neutral | Cancel, while cancellable |
| `dispatched` | "Sent — awaiting confirmation", neutral, with elapsed time | None |
| `readback_confirmed` | "Confirmed", the only success styling in the product | Dismiss |
| `timed_out` | "No confirmation — effect unknown", warning | Show current state; open trusted audit |
| `result_unknown` | "Effect unknown", warning | Show current state; open trusted audit |
| `failed_after_dispatch` | "Failed after dispatch — effect unknown", warning | Show current state; open trusted audit |
| `failed_before_dispatch` | "Failed — not sent", error | None |
| `cancelled_before_dispatch` | "Cancelled — not sent", neutral | None |
| `denied` | "Not permitted", error | None |

No state offers a retry button. Phase 2 settled that there is no retry entry point:
repairing forward is a new, separately authorized command.

Every outcome row carries the command correlation id, and the exact-dist evidence
compares the rendered target and result against the audit record for that id.

## Staleness

`glt-flow-card-view-staleness` is persistent, like Phase 2's authority bar. It is never
hidden, because a hidden staleness indicator is indistinguishable from a fresh view.

| State | Meaning | Data presentation |
|---|---|---|
| `live` | Subscribed, sequence contiguous | Normal |
| `resyncing` | A snapshot is in flight | Dimmed, non-interactive, previous values still labelled with their age |
| `stale` | Gap or reconnect, no snapshot yet | Dimmed, non-interactive, explicit "last updated" timestamp |
| `unavailable` | Authority lost or runtime unloaded | Read-only, reason shown, from the Phase-2 reducer's reason set |

Transitions are announced in a live region. No transition requires a page reload.

## Navigation

- The address appears in the URL and nowhere else as a source of truth.
- Breadcrumbs render the server-resolved ancestry. A level the caller cannot open is
  not rendered as a disabled crumb; it is rendered as plain non-link text with no
  indication that a link was withheld.
- Browser Back and Forward re-resolve through the server. A cached view is never
  replayed.
- A deep link that resolves to `not_found_or_denied` renders one neutral page: "This
  view is not available." The same page, byte for byte, for a deleted node and for an
  unauthorized one.
- Counts next to a child are the authorized counts. Where the authorized count is
  zero, no count is rendered — a rendered "0" and an absent count must not be
  distinguishable from outside.

## Accessibility and localization

- Every interactive element is reachable and operable by keyboard, with a visible
  focus ring that survives forced-colors mode.
- Every state is conveyed by symbol *and* text, never by color alone. The symbols come
  from the Phase-3 per-state `SYMBOLS` table, which is already distinct per state.
- The panel is a labelled region; the outcome strip and staleness indicator are live
  regions with polite announcements.
- German and English are complete. A missing key is a build failure, not a fallback to
  the other language.
- The kiosk layout has no pointer. The complete workflow — open panel, execute a
  control, read its outcome, drill down, return — is traversable by keyboard alone,
  and this is asserted as a single continuous scenario rather than element by element.
- 320px width and 200% zoom lose no function; wide content scrolls inside its own
  container rather than the page.

## Forbidden in the generated artifact

- Any `hass.callService` reachable from a panel, tap action or navigation affordance.
- Any `hass.callApi` from the new surfaces.
- Any browser-side derivation of a role, capability or control list.
- Any `window.confirm` or `alert` standing in for authorization.
- Any local or session storage of project content, tokens or lease bearers.

Each of these is asserted by the exact-dist effect ledger, not by source inspection.
