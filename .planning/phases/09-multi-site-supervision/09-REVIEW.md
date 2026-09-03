---
phase: 09-multi-site-supervision
reviewed: 2026-09-03
head: b9727ed
depth: standard
reviewer: close-out review pass
method: read at head, plus an AST sweep of every outbound call site
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
fixed_in_this_pass: 1
status: issues_found_and_fixed
---

# Phase 09: Code Review Report

**Scope.** `site_destinations.py`, `remote_fanout.py`, `site_health.py`,
`site_rollup.py`, `site_subscriptions.py`, `site_vocabulary.py`, and the
`remote/*` routes.

## Summary

No security defect found. The SSRF surface — the phase's most dangerous — is
handled correctly, and four vocabulary decisions get right the things that are
easy to get wrong over a network.

**T9-04, DNS rebinding.** `check_before_connecting` re-checks the host against
the allowlist *and* re-resolves it, refusing an address that is not routable. It
is called immediately before connecting, "for the same reason Phase 8's dispatch
gate reads simulation state at the point of dispatch: a check performed earlier
is a check about an earlier world." Both outbound sites call it. `is_global` is
used as the predicate rather than a hand-rolled private-range list, with the
TEST-NET-3 surprise noted where a reader will meet it.

**T9-13, a failed read is not `unavailable`.** A site that did not answer is
`unreachable`, which is *not* a Home Assistant state. `unavailable` is one, so
using it would make "we could not ask" indistinguishable from "the entity
reported unavailable".

**T9-06 / T9-07, failures do not enumerate.** `REMOTE_FAILURES` is a closed
vocabulary of eight codes. The reasoning is recorded: `str(err)` from `aiohttp`
carries the host and port it failed to reach, so a caller could map internal
topology by triggering failures — and an error string is an *interface*, which
one that changes with a library version is not.

**T9-12, a timeout is not a failure.** `effect_unknown` is a distinct outcome
from `failed`, and the module says why the distinction matters *more* over a
network: a timeout on a POST is the canonical case where the service may well
have run, and reporting it as failed invites a retry — which is how plant gets
operated twice.

## Warning

### WR-01: The destination check was memory-shaped — FIXED

**Files:** `tests/components/glt_flow_card/test_outbound_destination_guard.py` (new)

The check is called at both outbound sites at head. Nothing made that a
property of the product rather than of who wrote those two functions. Phase 8
refused exactly this shape for service calls — *"a gate applied where somebody
remembered to apply it has the shape of somebody's memory"* — and built an AST
sweep with an empty exemption list. The destination check, which guards a
*credentialed* outbound request, had no equivalent.

**Fixed.** The new guard walks the Companion, finds every function that builds
an aiohttp session and then makes an outbound call, and requires
`check_before_connecting` in the same function. Keying on the **session
builder** rather than the bare method name is what keeps `get` from flagging
every dictionary lookup in the component.

It additionally asserts that every session states `verify_ssl` explicitly
(T9-05). The default is safe and an omission is still refused, because the next
reader cannot tell an omission that inherited a safe default from one that meant
to turn verification off and picked the wrong helper.

Three guards against vacuity: the walk must find something ("a guard that
examines nothing passes over everything"), the exemption dict is empty, and a
sample function shaped like the defect is checked to be one the guard would
catch. Mutation-checked — removing the `remote_control` re-check turns it red,
naming the function and the methods it makes.

## Evidence

| Command | Result |
|---|---|
| `pytest` over the eight Phase-9 owner modules | 79 passed |
| `pytest` full Companion suite | 719 passed, 1 deselected |
| `npm run verify:release` | PASS, staged package identity over 76 files |
| destination guard with the `remote_control` re-check removed | red, naming the function |

## Verdict

**Issues found and fixed.** The warning was not a live vulnerability — it was
the absence of the thing that keeps one from appearing. T9-20 stays `planned`:
its owner needs a Docker engine this container does not have, and `09-THREATS.md`
records the exact failure.
