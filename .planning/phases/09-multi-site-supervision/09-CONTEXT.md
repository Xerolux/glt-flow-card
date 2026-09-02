---
phase: 09-multi-site-supervision
requirements: [SITE-01]
---

# Phase 9 Context

## What this phase is about

Each phase has had a characteristic way of being wrong:

- Phase 6: an effect that fails silently.
- Phase 7: a number wrong in a plausible direction.
- Phase 8: a belief about the plant that is comforting and false.
- **Phase 9: an answer that is incomplete and does not say so.**

A portfolio view of five sites where one did not respond, rendered as a portfolio
view of five sites, is the defect. Every site-level failure has to survive
aggregation as a *stated* absence, because the whole value of a central
supervision view is that a person stops looking at five screens — and the moment
they do, an unnoticed missing site is a plant nobody is watching.

## Two defects decide the shape

**D1: the read is sequential.** Two hundred entities against an unresponsive site
is fifty minutes inside a websocket handler. The roadmap forbids working around
it — *"sequential per-entity fan-out cannot satisfy the phase"* — and it is right
to, because this is not only slow: a handler that holds for fifty minutes is an
availability defect, and the obvious mitigations (a shorter timeout, fewer
entities) make the answer *more* incomplete rather than faster.

The fix is structural: one request per site rather than per entity, bounded
concurrency across sites, and a total deadline that belongs to the *request*
rather than to any site within it.

**D9: any URL is accepted.** No scheme check, no host validation, no allowlist —
and the Companion then makes an authenticated request to it and returns the body
to the browser. That is a server-side request forgery primitive with a credential
attached, reachable from a YAML field.

The allowlist is **server-owned**, which in this product means the same thing it
meant in Phase 6 for notification targets and in Phase 8 for the simulation
gate: a destination is site configuration, never project data, and the third time
this rule appears is a sign it is the product's actual security model rather than
a per-phase precaution.

## Partial is a first-class answer

The temptation is to treat a partial result as an error, because errors are
simpler. That is wrong here in both directions:

- Failing the whole roll-up because one site is down makes four healthy sites
  invisible, which is worse than the missing one.
- Returning the four and calling it the portfolio is the defect.

So a roll-up carries **which sites answered, which did not, and why**, and any
aggregate it contains states its own completeness. This is Phase 7's coverage
rule with sites instead of samples, and it should reuse that vocabulary rather
than invent a parallel one.

## Credentials never reach the browser

The token exists in exactly one place — the Companion's configuration — and
appears in no response, no log line, no export and no error message. D12 is the
subtle half: `str(err)` from `aiohttp` carries the host and port it failed to
reach, so failures leak internal topology even when the token does not.

The rule is therefore about **error text** as much as about secrets: a remote
failure is reported as a closed set of reasons, and the underlying exception is
logged server-side rather than returned.

## Remote is not a second product

Every rule the local path enforces applies unchanged one hop out: the same
capabilities, the same project scoping, the same four command outcomes, the same
trusted audit, the same simulation gate. D14 and D15 exist because the remote
path was written as its own thing.

Phase 8 already gated `ws_remote_control` behind the simulation decision, so this
phase inherits that rather than adding it — which is what "enumerated, not
remembered" bought.

## Deliberately not in this phase

- **No remote engineering.** Reading state, reading history and operating
  authorized controls. Editing a remote site's project is not in SITE-01 and is
  not added here.
- **No credential storage redesign.** Tokens stay in the Companion's
  configuration. Renewal and revocation take effect predictably; where they are
  *stored* is out of scope.
- **No cross-site alarm correlation.** Phase 6 owns alarms; this phase carries
  site identity into the existing model rather than building a second one.
- **No measured capacity numbers.** Phase 10 owns budgets. This phase must make
  the shape of the cost boundable and state its bounds; the measured figures come
  later.

## Decisions carried in

- Server-side enforcement for everything shared; browser role checks are UX only.
- No live Home Assistant writes, remote-site writes, or credential handling in
  tests. **Every remote interaction in this phase's tests is a fixture**, and the
  effect ledger fails a test that reaches a real socket.
- No release is authorized.
