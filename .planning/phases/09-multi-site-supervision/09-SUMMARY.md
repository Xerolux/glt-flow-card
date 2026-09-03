# Phase 9 — Failure-Isolated Multi-Site Supervision

**Status:** closed. 19 of 20 threats verified, each from its own owner command
run at head; T9-20 blocked by the environment and recorded with its exact
failure.

**Evidence at head:** 476 Node, 691 Python, 81 exact-dist browser tests,
`verify-docs-site` 25 sources / 41 byte-identical site files.

## What this phase was about

Phase 6's threats concerned effects that reach a human and fail silently. Phase
7's concerned numbers that are wrong in a plausible direction. Phase 8's
concerned beliefs about the plant that are wrong in a comforting direction.

**Phase 9's concern an answer that is incomplete and does not say so** — a
portfolio view of five sites where one did not respond, rendered as a portfolio
view of five sites.

The reason this is a safety question rather than a presentation one is the
reason anyone builds a central supervision screen at all: **so that a person
stops watching five screens.** In the moment they stop, an unnoticed missing
site is a plant nobody is watching. Every decision below follows from that one
sentence.

## The headline

**A silent site contributed zero.** Roll-ups summed what answered and presented
the result as the portfolio. Nothing in the figure said a site was missing, so a
number came out smaller and confident — the failure mode where a reader's
correct interpretation of the display is a wrong belief about the world.

Treating a partial result as an error, which is the tempting fix because errors
are simpler, is wrong in **both** directions. Failing the whole evaluation
because one site is down makes four healthy plants invisible, which is worse
than the missing one. Returning the four and calling it "the portfolio" is the
original defect.

So absence became a first-class answer. Every aggregate carries which sites
answered, which did not and why; an aggregate that cannot state its completeness
is refused rather than annotated, because an annotation is something a future
call site can forget to read.

**Unreachability stopped being an entity state.** A failed read wrote
`state: "unavailable"` per entity — a *real* Home Assistant state. An entity
genuinely unavailable at the remote site and one we could not ask produced the
same word, so a plant that had dropped off the network looked like a plant whose
sensors were down. An entity we could not ask has no reading; inventing one was
the defect.

## What else shipped

**The Companion was an SSRF tool with a credential attached.** Any URL was
accepted — no scheme check, no host check, no allowlist — and the Companion made
an *authenticated* request to it and returned the body to the browser, from a
configuration field.

The check has two halves and neither carries alone: a server-owned allowlist,
and a check of the **resolved address at connect time**, because an allowlisted
name can resolve publicly during validation and to `127.0.0.1` when connecting.
`169.254.169.254` is refused by name; an SSRF reaching cloud metadata returns
credentials for the whole account.

That destinations are site configuration and never project data is now the third
appearance of the same rule (notification targets, the simulation lock, remote
destinations), which makes it the product's security model rather than a
precaution.

**Fifty minutes inside a websocket handler.** Remote state was read one entity
at a time with a fifteen-second timeout, so two hundred entities against one
unresponsive site was an availability defect — and the obvious remedies
(shorter timeout, fewer entities) make the answer *less complete* rather than
faster. One request per site now, bounded concurrency across sites, and a
**total deadline that belongs to the request and is not divided among sites**:
someone waiting for a screen has a time budget that does not depend on how many
sites a colleague configured. Bounded concurrency without that deadline still
lets *n* sites times a timeout accumulate.

**Errors were a network map.** `str(err)` reached the browser, and connection
errors carry the host and port they failed to reach, so a caller could enumerate
internal topology by provoking failures. Failures are a closed set of reasons
now, and the credential half is *searched for* rather than asserted: a sentinel
token goes through every path including every error branch, and everything that
comes back is searched for it.

**Remote is not a second product.** `remote/states` checked nothing at all. Every
remote route now enforces the same capability and project scoping as its local
equivalent; site access is checked against the caller's projects, not merely a
role. Listings are filtered and *then* limited, because the other order turns a
limit into a counting oracle.

**A timeout is not a failure, and that matters more over a network.** A timeout
on a `POST` is the canonical case where the service may well have run. It is
`effect_unknown`, distinct from `failed`, and no surface offers a retry beside
it — repairing forward is a new, separately authorized command. Keeping
`connection_refused` and `unauthorized` as `failed` keeps the distinction worth
drawing: if everything were unknown, an operator could never be told a command
definitely did not run.

**A circuit breaker that was open in name only.** The first implementation
stamped `opened_at` only when it was `None`, so a failed probe never restarted
the cooldown and every subsequent request became a probe — precisely the
behaviour the breaker exists to prevent. Found by its own test.

## Defects found in the work rather than in the product

**A test corpus that was wrong about the internet.** The destination corpus used
`203.0.113.x` as its "public" address and Python classified it private. Python
was right — TEST-NET-3 is documentation space — and the fixture was wrong. The
temptation to "fix" the check instead is the shape worth recording; a row now
asserts that documentation ranges are not treated as public.

**A corpus that conflated two questions.** A single expectation column could not
express "allowed at validation, refused at connect", which is the exact
distinction the second half of the check exists to draw. Split into `expected`
and `expected_at_connect`.

**A runner that skipped tests silently.** The exact-dist runner carried a
hardcoded spec list, so new spec files were never run and the suite reported
success for them. It now compares against `test/e2e` on disk and throws on drift
in either direction, verified by mutation.

**A gate that only passed with out-of-band help.** The exact-dist step needed
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` set by hand wherever the container's Chromium
revision differs from the pinned one. A green that is a property of one shell is
not evidence, so the config resolves it: pinned revision preferred and used
silently, an installed sibling substituted only when the pinned one is absent
from disk, and the substitution printed.

**A test that exercised the wrong object.** One authority test passed a client
where Home Assistant's connection object was expected, proving nothing about the
route. Rewritten to exercise the route.

**Stale route declarations.** The policy prober flagged `state="deferred"`
routes, an unstable `not_permitted` expectation where the guard answers
`invalid_input`, and a missing `limit` parameter on `remote/list`. The prober
was right each time.

## Limits of what this phase proves

- No live Home Assistant, Recorder, remote site, fieldbus, plant target or
  notification recipient was contacted. Every remote interaction is a fixture,
  and a fixture that reaches a real socket **raises** rather than being
  recorded — by the time a ledger is read, the request has already left with a
  credential attached.
- The bounds are **shapes**, not measured capacity. Concurrency, per-site
  timeout, total deadline and subscription limits are declared and enforced;
  none of them is a throughput or latency claim. Phase 10 owns the budgets.
- The destination check is asserted against a fixture corpus, not against live
  DNS. How a specific network's resolver behaves is not evidence this phase
  produces.
- T9-20's lanes were not exercised, so nothing here claims the exact stage
  artifact installs on either pinned Home Assistant lane at this head.
- Cross-site alarm correlation does not exist. Phase 6 owns alarms; this phase
  carries site identity into them rather than building a second model.
- Credential storage was not redesigned. Tokens remain in the Companion's
  configuration.
