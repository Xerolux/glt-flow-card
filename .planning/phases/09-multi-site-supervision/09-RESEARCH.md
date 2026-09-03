---
phase: 09-multi-site-supervision
---

# Phase 9 Research

Measured rather than recalled, on the four questions where a wrong assumption
would be expensive.

## 1. What Home Assistant's REST API actually offers

`GET /api/states` returns **every** state in one response.
`GET /api/states/<entity_id>` returns one. The shipped code uses the second in a
loop, which is not merely a slow way to do the first — it is a different number
of round trips, and round trips are what a slow link makes expensive.

`POST /api/services/<domain>/<service>` returns the states it changed, which is a
usable *readback* and is the material Phase 4's `confirmed` outcome needs. The
shipped code discards it.

There is no batch-states endpoint taking a list, so the honest options are one
request for everything and filter locally, or *n* requests. For a supervision
view that reads many entities per site, one request per site is correct.

## 2. What a WebSocket subscription would cost

Home Assistant's websocket API supports `subscribe_events` with
`event_type: state_changed`, which delivers **every** state change on the remote
instance. For a supervision view of twenty entities on a site with two thousand,
that is a hundredfold amplification.

`subscribe_entities` exists and takes an entity list, delivering compressed
deltas. It is the right primitive, and it is the one that makes bounded
subscriptions meaningful rather than nominal.

Either way, a subscription is a *held* resource: an unbounded number of them is
the defect the phase's bound exists to prevent, and the bound must be on
concurrent subscriptions per site **and** in total.

## 3. What "private destination" means precisely

The check cannot be a regex on the URL. `http://foo.example/` may resolve to
`127.0.0.1`, and a name that resolves publicly at validation time may resolve
privately later — DNS rebinding is exactly this.

So the rule has two parts, and both are needed:

- **An allowlist of hosts**, server-owned, so the set of destinations is a
  decision rather than a consequence.
- **A resolved-address check at connection time**, refusing loopback,
  link-local (169.254.0.0/16, notably the cloud metadata address),
  private ranges and unique-local IPv6 — checked against the address actually
  connected to, not the one a name resolved to a moment earlier.

The second is what makes the first hold under rebinding, and neither alone is
sufficient.

## 4. What the four command outcomes mean remotely

Phase 4 established *accepted*, *sent*, *confirmed* and *failed after dispatch*,
and the distinction that matters is between "we do not know whether it happened"
and "it did not happen". Over a network that distinction becomes **more**
important, not less: a timeout on a POST is the canonical case where the service
may well have run.

So a remote timeout is `effect_unknown`, never `failed`. Reporting it as failed
invites a retry, and a retry after an unknown is how plant gets operated twice.
