# Companion backend · Platform 1.0

The optional custom component `glt_flow_card` is the GLT Flow Card's
server-side operations and persistence layer. The dashboard card keeps working
without the backend; for productive operation the Companion is recommended.

For shared projects the Companion is the authoritative boundary. On
preview/apply/rollback the browser sends only the bound preview identity, the
expected revision, stable change ids and explicit confirmation. The server
re-reads the head, validates and migrates anew, recomputes diff and dependency
closure and writes journal-backed. Without the required Companion authority
there is no privileged standalone fallback.

## Features

- persistent projects, versions and templates in Home Assistant storage;
- separate content and access revisions, and exclusive connection-bound edit
  leases (60–900 s, default 300 s) instead of persisted locks;
- server-side role checks against the fixed set
  **viewer / operator / engineer / administrator**;
- configured controls: the caller names only a control id, the revision and
  the declared input — domain, service and target are resolved by the server
  from the verified project state;
- alarm lifecycle with hysteresis, delay, acknowledgement/comment, shelving,
  history and notification service;
- server-side weekly schedules;
- work orders and report snapshots;
- remote Home Assistant state/control proxy: declared, but until phase 9
  fail-closed (`feature_unavailable`);
- separate stores for server-generated trusted evidence and for browser
  telemetry permanently marked untrusted.

## Setup

After copying `custom_components/glt_flow_card` and restarting, **GLT Flow
Card Companion** can be added under **Settings → Devices & Services** through
the config flow. The options flow configures, among other things, server
enforcement and lock/storage limits.

The release ZIP is installed as the exact stage artifact on immutably pinned
minimum/current HA lanes. The tests verify setup, upgrade, reload, unload and
re-setup, listener/task/manager/store resources, options rollback and
allowlist-based diagnostics. The local HACS integration-category stage is
packaging evidence, not a statement about a public Companion repository.

For remote sites YAML can be used in addition:

```yaml
glt_flow_card:
  remote_sites:
    - id: office
      name: Office
      url: https://ha.example.org
      token: !secret glt_remote_token
```

## Authority in phase 2

The browser may use a permissions snapshot to decide what it displays; it
thereby never decides what is allowed. Every shared request is re-authorised
at the WebSocket boundary before any handler runs, and every change re-checks
the whole authority chain inside the commit lock.

Roles live exclusively in the Companion's access list. Project JSON, imported
packages, browser storage, URL parameters and form fields never carry a role
or permission. Home Assistant administrator status grants no content
authority, only reading and repairing memberships, so an installation cannot
lock itself out.

An invisible and a non-existent project answer identically. A conflict
preserves the draft in memory and offers refresh, merge preview, retry with a
fresh lease or explicit discard — no overwrite, no forcing.

On upgrade, persisted legacy locks are discarded instead of being turned into
leases, old audit rows are marked `legacy_untrusted` instead of deleted, and a
legacy `permissions` block on the active state may pre-seed membership once
and conservatively — never as administrator and never from an imported draft.

## Security

With `security.server_enforced: true` the browser surface is not the
permission boundary: the Companion re-checks role and allowed service domain.
Critical field-bus and safety logic remains the responsibility of Home
Assistant and the underlying automation and field layer.

The phase-1 and phase-2 evidence tests project, authority and release security
in isolation. They perform no physical plant write, contact no remote site,
handle no credentials and certify no capacity for 100, 500 or 2,000 objects.

## Privacy

Project, alarm, audit and maintenance data stay local in your own Home
Assistant. Remote tokens are configured only in the backend and never shipped
to the browser.
