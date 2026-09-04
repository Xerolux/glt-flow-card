# Installation

Home Assistant 2024.8.0 or newer is required. Before every release, the exactly
staged dashboard card and Companion ZIP are installed and verified on immutably
pinned minimum/current HA lanes.

## What is publicly available through HACS

This repository is installed as a HACS **Dashboard** custom repository. HACS
then installs the card, not the Python Companion automatically. The release
additionally ships `glt-flow-card-companion.zip` for manual installation. The
HACS **Integration** shape checked in the build is a local
integration-category stage; it is not a separately published HACS integration
repository.

## HACS dashboard card

1. HACS → **Custom repositories**.
2. Add `https://github.com/Xerolux/glt-flow-card` as a **Dashboard**.
3. Install **GLT Flow Card** and reload the browser / Home Assistant.

Afterwards `custom:glt-flow-card` can be selected in the Lovelace card editor.
The visual designer appears directly inside Home Assistant.

## Manual

Copy `dist/glt-flow-card.js` to `/config/www/glt-flow-card.js` and register
`/local/glt-flow-card.js` as a JavaScript module resource.

## Straight from the Companion (from 1.1.0)

The Companion ships the card in `custom_components/glt_flow_card/www/` and
serves it after setup at

`http://<home-assistant>/glt_flow_card/www/glt-flow-card.js`

Register this URL as a JavaScript module resource when the card was not
installed through the HACS dashboard or `/config/www` — for example after an
integration-category installation (see below). It is served without long cache
headers; appending `?v=<version>` to the resource URL forces a browser reload
after a Companion update.

## When only errors appear: card unusable despite Companion

HACS installs a repository in exactly **one** category. If the repository was
added as an **Integration**, you only get the Python Companion: the backend
runs (projects, alarms and controls work server-side), but there is no card
file and no Lovelace resource — `custom:glt-flow-card` then reports *Custom
element doesn't exist*. Remedies, in this order:

1. HACS → Custom repositories: add the repository as a **Dashboard**
   (instead of Integration) and install it, or
2. register the Companion URL from the previous section as a resource, or
3. copy `dist/glt-flow-card.js` to `/config/www/` manually.

## GLT Flow Card Companion 1.0

The Companion is recommended for productive GLT features: server-side roles
(viewer, operator, engineer, administrator), trusted evidence, project
versions, exclusive connection-bound edit leases, configured controls, alarm
lifecycle, time schedules, work orders and reports. Remote Home Assistant is
declared but fails closed until phase 9.

The release workflow builds `glt-flow-card-companion.zip` for this purpose.
Alternatively, copy the folder `custom_components/glt_flow_card` to
`/config/custom_components/`. After a restart, the integration is set up via
the config flow under **Settings → Devices & Services → Add Integration → GLT
Flow Card Companion**.

The earlier YAML variant remains available for advanced options such as remote
sites:

```yaml
glt_flow_card:
  remote_sites:
    - id: office
      name: Office
      url: https://ha.example.org
      token: !secret glt_remote_token
      verify_ssl: true
```

> HACS treats a custom repository as exactly one category. That is why the card
> remains the HACS **Dashboard** repository; the Companion ships in the same
> project and release but is not copied to `custom_components` automatically by
> a dashboard installation.

Without the Companion, local visualisation and browser-local projects keep
working. A purely local project is its own, clearly labelled mode; a shared
project never silently becomes a local one. Authoritative shared project
changes, migration/apply/rollback, leases, membership management, configured
controls and evidence are never downgraded to browser-local storage or direct
service calls: when the authority is missing, the shared view is read-only.

On upgrade, a stored lock TTL value is clamped into the lease window of
60–900 seconds (default 300 s), persisted legacy locks are discarded instead of
being turned into leases, and old audit rows remain as `legacy_untrusted`.

## Release evidence and safety boundary

The release job downloads only the previously verified artefacts, checks their
SHA-256 identities and never rebuilds. Minimum and current lanes install the
same card and the same Companion ZIP, verify setup, upgrade, reload, unload and
re-setup as well as the cleaned-up resources. The test environment uses
isolated fixtures and performs no physical plant write. The 100/500/2,000-object
fixtures prove bounded correctness only; they are not a capacity
certification.
