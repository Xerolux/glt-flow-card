---
phase: 09-multi-site-supervision
---

# Phase 9 Patterns

## A site answer is a measured value

Reuse Phase 7's shape rather than inventing a parallel one:

```
{value, coverage, gaps, source, resolved_at}   →   {states, sites_answered, sites_absent, source, read_at}
```

A roll-up carries which sites answered and which did not. Any aggregate it
contains states its own completeness, exactly as a period total states its
coverage. Phase 7 spent a phase establishing that a number must say what it is a
number of; a portfolio figure is a number.

## Absent is never `unavailable`

`unavailable` is a **real Home Assistant state**. An entity that is unavailable
at the remote site and an entity we could not ask about must not produce the same
word (D6). The second is `unreachable`, and it belongs to the *site*, not to the
entity — because the entity has no state we know of, and inventing one for it is
the defect.

## Bounds are three, and they are different questions

| Bound | Question it answers |
|---|---|
| Concurrency | how many sites are being asked at once |
| Per-site timeout | how long one site may take |
| **Total deadline** | how long the *request* may take |

The third is the one that is usually missing, and the one that matters: bounded
concurrency alone still lets *n* sites × timeout accumulate. The deadline belongs
to the request and is not divisible among sites.

## The circuit breaker states its state

Open, closed, half-open — and the answer says which. A site that is being skipped
because its breaker is open is **not** the same as a site that was asked and did
not answer, and a supervision view that shows them identically is lying about how
long the problem has existed.

A breaker also has to *close* again, which means a half-open probe, which means
the probe is itself a bounded cost.

## One request per site, filtered locally

`GET /api/states` returns everything in one round trip; the shipped code asks per
entity. Over a slow link the round trips *are* the cost. Filtering locally moves
work to the Companion, which is where the work belongs.

## Destinations are server-owned, and checked twice

An allowlist alone does not hold: a name that resolves publicly at validation
time may resolve to `127.0.0.1` at connection time. So:

1. the **host** must be on a server-owned allowlist, and
2. the **resolved address** must not be loopback, link-local, private or
   unique-local — checked against what is actually connected to.

169.254.169.254 is called out by name in the tests, because it is the cloud
metadata address and it is the reason this check is not theoretical.

## Failures are a closed set, and the exception is not in it

`str(err)` from `aiohttp` carries the host and port. A remote failure is reported
as one of a declared set of reasons; the underlying exception is logged
server-side. This is the same rule Phase 8 applied to dispatch refusals, for the
same reason: an error string is an interface, and an interface that varies with
the library version is not one.

## A timeout is `effect_unknown`, never `failed`

Phase 4's four outcomes matter *more* over a network, not less. A POST that timed
out may well have run. Reporting it as failed invites a retry, and a retry after
an unknown is how plant gets operated twice.
