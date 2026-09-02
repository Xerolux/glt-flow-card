---
phase: 09-multi-site-supervision
status: verified
asvs_level: 1
asvs_version: 5.0.0
requirements: [SITE-01]
---

# Phase 09 Threat Register

Phase 6's threats concerned effects that fail silently, Phase 7's numbers wrong
in a plausible direction, Phase 8's beliefs that are comforting and false.
**Phase 9's concern an answer that is incomplete and does not say so** — a
portfolio view of five sites where one did not respond, rendered as a portfolio
view of five sites.

No test may contact a live Home Assistant, Recorder, remote site, fieldbus,
plant target or notification recipient. Every remote interaction here is a
fixture, and the effect ledger fails a test that reaches a real socket.

## ASVS L1 Mapping

| ASVS L1 area | Phase-9 rows |
|---|---|
| V1 Architecture | T9-01, T9-02, T9-12 |
| V4 Access control | T9-08, T9-09, T9-10 |
| V5 Validation | T9-03, T9-04, T9-05 |
| V7 Error handling and logging | T9-06, T9-07, T9-11 |
| V8 Data protection | T9-05, T9-06, T9-16 |
| V11 Business logic | T9-13, T9-14, T9-15, T9-17 |

## Canonical Threats

| ID | Category | Threat and the guarantee that closes it | Plan | Owner command | Status |
|---|---|---|---|---|---|
| T9-01 | Denial | Remote state is read one entity at a time with a per-entity timeout, so two hundred entities against one unresponsive site is fifty minutes inside a websocket handler. One request per site, bounded concurrency across sites, and a total deadline owned by the request. | 09-05 | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_fanout.py -q -x` | ✅ verified |
| T9-02 | Denial | Bounded concurrency without a total deadline still lets n sites times a timeout accumulate. The deadline belongs to the request, is not divisible among sites, and a request that hits it returns what it has with the rest stated absent. | 09-05 | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_fanout.py -q -x` | ✅ verified |
| T9-03 | Elevation / SSRF | Any URL is accepted, so the Companion makes an authenticated request to an arbitrary address and returns the body to the browser. Destinations are a server-owned allowlist, and the request is refused before it is made. | 09-03 | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_destinations.py -q -x` | ✅ verified |
| T9-04 | Elevation / SSRF | An allowlisted host resolves to a private address, so the allowlist holds at validation time and not at connection time. The resolved address is checked against loopback, link-local, private and unique-local ranges, including the cloud metadata address. | 09-03 | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_destinations.py -q -x` | ✅ verified |
| T9-05 | Data protection | A site silently disables certificate verification, so its traffic is unauthenticated and nothing says so. Verification off is refused unless explicitly declared per site, recorded, and stated in every answer that site produces. | 09-03 | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_destinations.py -q -x` | ✅ verified |
| T9-06 | Information disclosure | Exception text reaches the browser, and connection errors carry the host and port they failed to reach, so failures enumerate internal topology. Failures are a closed set of reasons; the exception is logged server-side and never returned. | 09-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_failures.py -q -x` | ✅ verified |
| T9-07 | Information disclosure | A credential appears in a response, a log line, an export or an error. The token exists only in the Companion's configuration, and a test asserts it appears in no output of any remote path. | 09-06 | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_failures.py -q -x` | ✅ verified |
| T9-08 | Elevation | `remote/states` checks nothing, so any websocket caller reads any entity of any configured site. Every remote route enforces the same capability and project scoping as its local equivalent. | 09-07 | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_authority.py -q -x` | ✅ verified |
| T9-09 | Elevation | A remote control checks only the service domain, so an operator authorized on one project can operate a site belonging to another. Site access is checked against the caller's projects, not merely against a role. | 09-07 | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_authority.py -q -x` | ✅ verified |
| T9-10 | Information disclosure | `remote/list` returns every configured site to any caller, so site names and URLs are readable by someone with no access to them. The listing is filtered to what the caller may see, and the limit is applied after filtering. | 09-07 | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_authority.py -q -x` | ✅ verified |
| T9-11 | Repudiation | A remote control produces no audit on success or failure, and every failure collapses into one generic code. Remote controls carry the same four separated outcomes and the same trusted audit as local ones. | 09-08 | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_authority.py -q -x` | ✅ verified |
| T9-12 | Safety | A remote timeout is reported as failed, inviting a retry — and a retry after an unknown is how plant gets operated twice. A timeout is `effect_unknown`, distinct from `failed`, and the surface offers no retry beside it. | 09-08 | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_authority.py -q -x` | ✅ verified |
| T9-13 | Integrity | A read that failed produces `state: "unavailable"`, which is a real Home Assistant state, so an entity we could not ask about is indistinguishable from one that is genuinely unavailable. Unreachability belongs to the site and is never written as an entity state. | 09-04 | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_health.py -q -x` | ✅ verified |
| T9-14 | Integrity | A portfolio roll-up computed while one site was silent is presented as complete. Every roll-up states which sites answered, which did not and why, and every aggregate states its own completeness. | 09-09 | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_rollup.py -q -x` | ✅ verified |
| T9-15 | Denial | A site that is down is retried by every client on every request, so the cost of a dead site grows with the number of people looking at it. A circuit breaker opens, states that it is open, and closes again through a bounded probe. | 09-04 | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_health.py -q -x` | ✅ verified |
| T9-16 | Denial | Subscriptions are unbounded, or a subscription to a remote instance delivers every state change on it. Subscriptions are bounded per site and in total, and subscribe to named entities rather than to all events. | 09-10 | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_subscriptions.py -q -x` | ✅ verified |
| T9-17 | Integrity | An entity list is truncated silently, so a caller asking for three hundred entities receives two hundred and is not told. A truncated answer says it was truncated and states the limit. | 09-05 | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_fanout.py -q -x` | ✅ verified |
| T9-18 | Spoofing / Accessibility | A site's freshness, latency and circuit state are not shown, so a value read an hour ago from a site that has been unreachable since reads like a current one. Every remote value carries its age and its site's health, as text and shape rather than colour. | 09-11 | `node tools/run-exact-dist-playwright.mjs --grep=phase-9-sites` | ✅ verified |
| T9-19 | Elevation / Injection | A site name or a remote entity's attributes, authored elsewhere, are rendered as markup. Remote text is set as text content and never interpolated into markup, asserted structurally in the shipped artifact. | 09-11 | `node tools/run-exact-dist-playwright.mjs --grep=phase-9-sites` | ✅ verified |
| T9-20 | Tampering / Supply chain | Authored source, generated card, Companion copy, HACS stage/ZIP, HA lanes, docs or release evidence diverge; or a test reaches a live socket, a real remote site, or exceeds a declared bound. Build once, compare exact bytes, install the exact stage, fail on any unintended effect. | 09-12 | `npm run test:phase9:release` | ⏳ planned |

## Evidence Status

Every row begins `planned`. No row may be marked `verified` from planning alone,
nor from its parts passing separately, nor from a sibling row that names the same
command.

Two rules carried forward from every closure since Phase 6 apply here:

**A row is marked from its own owner command, run at head.** Where two rows name
the same command, the command is run for each row.

**An artifact grep is not evidence that a surface works.** Any row whose evidence
is a grep over `dist/` needs a second assertion that renders the surface and
reads the value.

T9-20 is expected to stay `planned` for the same reason T8-25, T7-23, T6-21,
T5-16, T4-14, T3-14 and T2-16 did: its owner is the composed release leaf, which
needs a Docker engine this container does not have.

## Closure Record

Closed 2026-09-02 at head. Every row above was marked from **its own** run of its
own owner command; where five rows name `test_remote_authority.py`, that command
was run five times. The build was refreshed and the HACS packages restaged first,
so every run is against the current artifact rather than a stale one.

The interpreter is resolved through `tools/python-launcher.mjs`, which is how the
declared `py -3.13` command is spelled on a Linux lane; it resolved to
`.venv/bin/python` and the launcher refuses anything that is not Python 3.13.

| Command | Rows | Result |
|---|---|---|
| `test_remote_fanout.py` | T9-01, T9-02, T9-17 | 15 passed (×3) |
| `test_site_destinations.py` | T9-03, T9-04, T9-05 | 15 passed (×3) |
| `test_remote_failures.py` | T9-06, T9-07 | 10 passed (×2) |
| `test_remote_authority.py` | T9-08, T9-09, T9-10, T9-11, T9-12 | 8 passed (×5) |
| `test_site_health.py` | T9-13, T9-15 | 9 passed (×2) |
| `test_site_rollup.py` | T9-14 | 10 passed |
| `test_site_subscriptions.py` | T9-16 | 9 passed |
| `run-exact-dist-playwright.mjs --grep=phase-9-sites` | T9-18, T9-19 | 9 passed (×2), effect ledger filesystem-only |

**T9-20 stays `planned`, with its exact failure rather than its likely cause.**
`npm run test:phase9:release` passed `validate:hacs-staging` and then failed in
`test:ha-artifacts`:

```
failed to connect to the docker API at unix:///var/run/docker.sock; check if the
path is correct and if the daemon is running: dial unix /var/run/docker.sock:
connect: no such file or directory
FAIL minimum probe HA 2024.10.0: docker info --format
{{.ServerVersion}}/{{.OSType}}/{{.Architecture}} failed with status 1
...
Error: no supported Home Assistant lane passed within 12 bounded candidates
    at resolveLanePlan (tools/resolve-ha-lanes.mjs:210:11)
```

This container has no Docker engine, so the composed release leaf cannot run
here — the same limitation recorded for T8-25, T7-23, T6-21, T5-16, T4-14, T3-14
and T2-16. It is raised rather than taken: the row is not marked from its parts
passing separately, and the phase is not claimed to have release evidence.

### The phase gate, run at head

`npm run test:phase9`, with no environment help:

```
PASS acyclic command graph reaching test:phase9:release exactly once
PASS F9-01 Canonical build from authored modules
PASS F9-02 Node regression suites
PASS F9-03 Companion suite
PASS F9-04 Exact-dist browser suites
PASS F9-05 Complete sources and deterministic documentation site
FAIL F9-06 Phase-8 gate
```

**F9-04 passing without `PLAYWRIGHT_CHROMIUM_EXECUTABLE` is new.** Phase 7
recorded that its F7-04 failed because the container's Chromium revision
differs from the pinned one and the override had to be set by hand. That is now
resolved in `playwright.config.mjs` rather than in a shell.

**F9-06 fails at the recursion floor, for a limit recorded since Phase 6.** The
Phase-8 gate runs the Phase-7 gate and so on down to the Phase-1 gate, whose
first step is F-01:

```
> node tools/verify-provenance.mjs --online
Provenance verification failed: source metadata for @playwright/test request returned HTTP 403
```

All five third-party repository provenance sources answer 403 with "GitHub
access to this repository is not enabled for this session";
`api.github.com/rate_limit` answers 200, so this is a repository-scope limit
rather than a network one. Attaching five third-party repositories with
credentials to satisfy a provenance check would be a disproportionate permission
change and was not made.

This means **no phase gate from 2 upward has ever completed its recursion in
this environment**, and every phase closure since has rested on its own F-rows
plus each threat row's own at-head run. That is stated here rather than left to
be inferred from a green that does not exist.

### Limitations of this closure

- No live Home Assistant, Recorder, remote site, fieldbus, plant target or
  notification recipient was contacted. Every remote interaction is a fixture.
- The multi-site bounds are **shapes**, not measured capacity numbers. Phase 10
  owns the budgets; nothing here is a throughput or latency claim.
- The destination check is asserted against a fixture corpus, not against live
  DNS. A real resolver's behaviour on a specific network is not evidence this
  phase produces.
- T9-20's lanes were not exercised, so no claim is made about the exact stage
  artifact installing on either pinned Home Assistant lane at this head.

## Effect Ledger Obligation

Every Phase-9 test emits a `PHASE9_*_EFFECTS` line carrying `socket`, `service`,
`remote` and `network`, all of which must be zero unless the test names them. A
test that proves a bound while opening a real socket has proven nothing about the
product and something alarming about the test.

## Blocking Rule

A live socket, a credential in any output, an unvalidated destination, a partial
roll-up presented as complete, a timeout reported as a failure, or a non-zero
unintended effect blocks release.
