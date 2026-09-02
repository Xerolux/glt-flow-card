---
phase: 09-multi-site-supervision
status: planned
requirements: [SITE-01]
---

# Phase 09 Validation Map

The gate parses the table below. Six columns, and the threat cell carries every
threat the row's command proves.

## Requirement coverage

| Requirement | Threats | What is proven | Kind | Command | Status |
|---|---|---|---|---|---|
| SITE-01 | T9-03, T9-04, T9-05 | Destinations are a server-owned allowlist, the resolved address is checked at connection time against loopback, link-local, private and unique-local ranges including the cloud metadata address, and disabled certificate verification is refused unless declared and is stated in every answer | Companion policy | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_destinations.py -q -x` | ⏳ planned |
| SITE-01 | T9-01, T9-02, T9-17 | One request per site with bounded concurrency and a total deadline owned by the request; a request that hits the deadline returns what it has with the rest stated absent, and a truncated entity list says it was truncated | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_fanout.py -q -x` | ⏳ planned |
| SITE-01 | T9-13, T9-15 | Unreachability belongs to the site and is never written as an entity state, and a circuit breaker opens, states that it is open, and closes through a bounded probe | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_health.py -q -x` | ⏳ planned |
| SITE-01 | T9-06, T9-07 | Remote failures are a closed set of reasons with the exception logged server-side, and no credential appears in any response, log, export or error | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_failures.py -q -x` | ⏳ planned |
| SITE-01 | T9-08, T9-09, T9-10, T9-11, T9-12 | Every remote route enforces the same capability and project scoping as its local equivalent, site listings are filtered before they are limited, remote controls carry the same four separated outcomes and trusted audit, and a timeout is effect_unknown rather than failed | Companion policy | `py -3.13 -m pytest tests/components/glt_flow_card/test_remote_authority.py -q -x` | ⏳ planned |
| SITE-01 | T9-14 | Every roll-up states which sites answered, which did not and why, and every aggregate states its own completeness | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_rollup.py -q -x` | ⏳ planned |
| SITE-01 | T9-16 | Subscriptions are bounded per site and in total, and name their entities rather than subscribing to every state change on the remote instance | Companion behaviour | `py -3.13 -m pytest tests/components/glt_flow_card/test_site_subscriptions.py -q -x` | ⏳ planned |
| SITE-01 | T9-18, T9-19 | Every remote value carries its age and its site's health as text and shape rather than colour, and remote text reaches the DOM as text while still reaching the reader | Browser artifact | `node tools/run-exact-dist-playwright.mjs --grep=phase-9-sites` | ⏳ planned |
| SITE-01 | T9-20 | Authored source, generated card, Companion copy, HACS stage and ZIP, HA lanes, docs and release evidence agree byte for byte, installed as the exact stage | Release evidence | `npm run test:phase9:release` | ⏳ planned |
