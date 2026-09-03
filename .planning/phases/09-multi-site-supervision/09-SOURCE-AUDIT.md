---
phase: 09-multi-site-supervision
requirements: [SITE-01]
---

# Phase 9 Source Audit

Eighteen locatable defects in the remote-site path. Two of them are the phase's
shape: one is a **performance** defect the roadmap explicitly says cannot be
worked around, and one is a **security** defect in what the product will connect
to.

## Concurrency and failure isolation

**D1 — `remote_states` is sequential, per entity, with a 15-second timeout each.**

```python
for entity_id in entity_ids[:200]:
    async with session.get(f"{site['url']}/api/states/{entity_id}", timeout=15) as resp:
```

Two hundred entities against one unresponsive site is **fifty minutes** inside a
websocket handler. The roadmap says it in as many words: *"sequential per-entity
fan-out cannot satisfy the phase."* This is the headline, and unlike most
performance defects it is also an availability defect — the handler holds while
it happens.

It is also the wrong protocol. Home Assistant serves `/api/states` in one
request; the code asks for each entity separately.

**D2 — no total deadline.** Even bounded concurrency without one lets a slow site
determine how long the whole roll-up takes.

**D3 — no circuit breaker.** A site that is down is retried on every request, by
every client, forever. The cost of a dead site grows with the number of people
looking at it.

**D4 — one site's failure is every site's failure.** There is no per-site
isolation: `ws_remote_states` takes one `site_id`, and any composition across
sites is left to the caller, who has no way to express "these three answered and
that one did not".

**D5 — `entity_ids[:200]` truncates silently.** A caller asking for 300 gets 200
and is not told. The same shape as Phase 7's row cap before it was made to state
itself.

**D6 — a failed read is indistinguishable from an unavailable entity.**

```python
result[entity_id] = {"state": "unavailable", "error": resp.status}
```

`unavailable` is a real Home Assistant state. An entity that *is* unavailable at
the remote site and an entity we could not ask about produce the same word, and
the `error` key is the only difference — one nothing downstream reads. This is
Phase 7's whole subject arriving in a new place: **absent presented as
measured.**

**D7 — no freshness, latency or health.** The answer carries no indication of
when it was read or how long it took, so a cached-looking value from a site that
has been unreachable for an hour reads like a current one.

**D8 — no subscriptions.** SITE-01 asks for bounded concurrent subscriptions;
there are none, so every view is a poll.

## Destinations and credentials

**D9 — any URL is accepted.**

```python
self.remote_sites = {str(s.get("id")): deepcopy(s) for s in sites
                     if s.get("id") and s.get("url") and s.get("token")}
```

No scheme check, no host validation, no allowlist. `url` may be
`http://169.254.169.254/`, `http://localhost:8123/`, or any address inside the
site's network. The Companion then makes an authenticated request to it and
returns the body to the browser. That is a server-side request forgery primitive
with a credential attached, and the roadmap names it: *"validation blocks
arbitrary/private destinations outside policy."*

**D10 — `verify_ssl` is per-site and silently disables verification.**
`site.get("verify_ssl", True)` defaults correctly, and a site that sets it false
gets no warning, no audit entry and no indication in the UI that its traffic is
unauthenticated.

**D11 — the token is static and lives in YAML.** No renewal, no revocation, no
expiry. Rotating a token means editing a file and restarting.

**D12 — exception text goes to the browser.**

```python
except Exception as err:
    connection.send_error(msg["id"], "remote_failed", str(err))
```

`aiohttp` connection errors carry the host and port they failed to reach. An
unauthorized caller can therefore enumerate internal hostnames by triggering
failures, and a legitimate one sees infrastructure detail in a UI error.

## Authorization and audit

**D13 — `ws_remote_states` checks nothing.** It has no `_require_project_role`,
no capability check, and no project scoping: any caller who can reach the
websocket can read any entity of any configured site.

**D14 — `remote_control` checks only the service domain.**
`SAFE_SERVICE_DOMAINS` is a good check and it is the *only* one. The criterion
requires remote controls to reuse the same project, site and entity permissions
as local ones; a caller passes `project_id` and it is used for the role check but
never checked against the *site*, so an operator on project A can control site B.

**D15 — no remote audit.** Phase 4 established four separated command outcomes
and a trusted audit for local controls. A remote control produces neither: on
success the remote's JSON is returned, on any failure a generic `remote_failed`.
*Accepted*, *sent*, *confirmed* and *failed after dispatch* all collapse into
two.

**D16 — `ws_remote_list` returns every configured site to any caller.** The token
is stripped, which is right, but the url, name and every other field are not, and
there is no filtering by what the caller may see.

## Roll-ups and navigation

**D17 — no partial roll-up.** A portfolio figure computed from three sites when
one did not answer is a smaller number presented with the same confidence as a
complete one — Phase 7's D16, one network hop out.

**D18 — no site context in navigation.** Phase 4's breadcrumbs and deep links do
not carry a site, so a link to a remote object is either ambiguous or local.

## What is already sound

- `SAFE_SERVICE_DOMAINS` is enforced on the remote path.
- `ws_remote_list` strips the token before responding.
- The policy table already declares `remote.read` and `remote.control` with
  `remote/list` scoped `component`. The boundary is declared; the behaviour
  behind it is missing.
- Phase 8 gated `ws_remote_control` behind the simulation decision, so Phase 9
  **inherits** that gate rather than needing to add one.
