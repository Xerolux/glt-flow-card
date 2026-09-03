# Phase 04 Research

**Conducted:** 2026-09-02
**Method:** Verified against the vendored Home Assistant **2026.2.3** in `.venv`, against the repository's own sources at `b69cd67`, and against the platform behavior the existing gates already exercise. Every claim below is marked with how it was established.

---

## 1. Home Assistant WebSocket subscriptions

**Verified in `.venv/lib/python3.13/site-packages/homeassistant/components/websocket_api/`.**

- `connection.subscriptions` is a plain `dict[Hashable, Callable[[], Any]]`
  (`connection.py:70`). Registering an unsubscribe callback under the message id is
  the whole contract; teardown iterates and calls every value (`connection.py:246`)
  and then clears (`connection.py:254`).
- `connection.send_event(msg_id, event)` (`connection.py:138`) is the push path, and
  `messages.event_message(iden, event)` (`messages.py:107`) is its envelope. There is
  no framework-level sequence number and no framework-level replay: **ordering and gap
  detection are the integration's responsibility.**
- `@websocket_command(schema)` extends `BASE_COMMAND_MESSAGE_SCHEMA`
  (`decorators.py:133`). A dict schema of length 1 disables validation entirely, which
  is why every route in this repository declares its full schema explicitly.

**Consequence for Phase 4.** The repository already owns the missing half:
`SubscriptionRegistry._next_sequence()` stamps every emission
(`policy_sessions.py:122,130`) and `sequence()` exposes the current value. A snapshot
must therefore be taken *with* the sequence it corresponds to, in the same critical
section that reads the data — otherwise a subscription event emitted between the read
and the stamp is silently lost, which is precisely the gap the phase must detect.

**Decision.** `views/subscribe` returns `{snapshot, sequence}` from one critical
section, then streams events each carrying its own sequence. The client holds
`expected = snapshot.sequence + 1` and treats `event.sequence != expected` as a gap.
This is not novel; it is the standard resumable-stream shape, and the registry already
supplies the counter.

---

## 2. Why the browser cannot compose the panel

**Established from the repository.** `policy.py:322` `capabilities_for` computes the
effective capability set as the union of the project role's capabilities and the
minimal HA-admin ceiling. `configured_controls.py` then resolves a control id to a
domain, service and target **from the verified current head**, and Phase 2's
`FORBIDDEN_REQUEST_FIELDS` rejects any caller attempt to supply them.

A browser holding a capability snapshot plus a profile *could* compute a plausible
control list. It would be wrong in at least three ways that matter:

1. The snapshot is a point-in-time read. `CAPABILITY_SNAPSHOT_SECONDS = 300` means it
   can be five minutes stale, and Phase 2 already proved revocation must take effect
   immediately.
2. A profile's declared control may not be resolvable against the current head — the
   entity may have been unmapped since. Only the server can tell.
3. The rate class and lease state also gate execution, and neither is in the profile.

**Decision.** `panels/get` composes server-side, and the response's control entries
carry `{control_id, label, kind, confirm_required}` and nothing else. A control the
caller cannot execute right now is omitted.

---

## 3. Deep links, and why a count is an oracle

**Established from Phase 2's enumeration work.** `test_policy_enumeration.py` already
proves lists, direct reads, counts, search, subscriptions, cursors, audit, controls
and remote paths do not enumerate hidden projects, and that all of them answer with
one `project_unavailable` shape.

Navigation adds two new oracles that Phase 2 did not face:

- **The address itself.** A deep link is a caller-supplied path into the hierarchy. If
  `not permitted` and `does not exist` differ in any observable — status, message,
  latency class, response size — the link becomes a probe.
- **The roll-up count.** "Site A: 3 alarms" tells an unauthorized caller that three
  alarm-bearing objects exist under Site A even if every one of them is hidden. This
  is subtler than a list leak and easier to ship by accident, because a count feels
  like a number rather than a disclosure.

**Decision.** Counts are computed over the authorized scope only, and an authorized
count of zero renders *nothing* rather than "0" — otherwise the presence of a rendered
zero distinguishes "you may see this subtree and it is empty" from "you may not see
this subtree", which is the same oracle one level up.

---

## 4. The History API and the "state is the URL" rule

**Established platform behavior, exercised by the existing card.**
`src/v040-extension.part06:120` already uses `history.pushState` plus a synthetic
`location-changed` event — the Home Assistant frontend convention for in-app
navigation.

Two properties matter here:

- `pushState` does not fire `popstate`; only user navigation does. A view that updates
  its own state *and* pushes must not also react to its own push.
- `popstate` fires with whatever state object was pushed. Trusting that object is a
  mistake: it was serialized by a page that may have held a different authority, and
  in a restored session it can be arbitrarily old.

**Decision.** The pushed state object carries the address string and nothing else.
`popstate` re-resolves that address through `navigation/resolve` rather than restoring
a cached view. This costs one round trip per Back press and is the only way Back can
be correct after a revocation.

---

## 5. Announcing without shouting

**Established from Phase 2's UI work**, which already ships live regions for authority
transitions.

The Phase-4 additions — outcome transitions and staleness transitions — fire more
often than authority transitions do, and a naive `aria-live="assertive"` region that
announces every dispatched→confirmed transition makes the kiosk layout unusable for a
screen-reader user.

**Decision.** `polite`, one region per concern (outcome, staleness), and the region
holds a *summary sentence*, not an event log. A rapid sequence of transitions
coalesces to the latest state rather than queueing.

---

## 6. Resync bounds

**Reasoned from the repository's own limits.** `MAX_SUBSCRIPTIONS_PER_CONNECTION = 8`
already bounds subscriptions. Nothing bounds how often a client may ask for a fresh
snapshot, and the resync path is triggered by conditions a hostile or merely buggy
client controls (it can drop and reconnect at will).

A snapshot is the most expensive read in the phase: it walks the authorized subtree,
resolves state for every node and reads provenance.

**Decision.** Snapshot requests get their own rate class in the Phase-2 rate limiter,
with at most one snapshot in flight per subscription and a minimum interval between
snapshots on the same subscription. A client that exceeds it receives `rate_limited` —
an existing declared error code — and the view stays `stale` rather than escalating.
Staying visibly stale is the correct failure: it is honest, and it is bounded.

---

## 7. What was *not* researched, and why

- **Recorder / history APIs.** HIST-01 in Phase 7 owns them. Researching them here
  would produce decisions Phase 7 must then either honor or contradict.
- **Alarm state machines.** Phase 6.
- **Remote site transport.** Phase 9; the routes are `state="deferred"` and navigation
  must treat a remote address as non-existent.

---

## Open questions carried into planning

| # | Question | Resolution path |
|---|---|---|
| A1 | Does the panel model need its own schema version, or is it a transient response shape? | Transient. It is derived from schema 3 and never persisted, so it needs a strict response contract but not a schema version. Settled in 04-05. |
| A2 | Should breadcrumbs show a non-openable ancestor at all? | Yes, as plain text, because hiding it would make the path ambiguous — but with no indication that a link was withheld. Settled in 04-07. |
| A3 | Where does the address serializer live so both runtimes agree? | Browser-side in `navigation.mjs` for construction; the server validates independently rather than trusting a parse. Two independent validations, no shared parser to disagree about. Settled in 04-07/04-09. |
| A4 | Does a resync lose operator input? | No. The Phase-2 candidate-preservation pattern applies. Settled in 04-12. |
| A5 | What happens to the legacy tap path's `navigate` action? | It stays, retargeted to the new address form; only the `call-service` / `perform-action` branches are retired. Settled in 04-13. |
| A6 | Is the trend region's unavailability a phase failure? | No — it is a declared state with the `RoleMatrixDisclosure` precedent, recorded in 04-CONTEXT as a flagged scope decision. Revisited in Phase 7. |
