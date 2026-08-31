# External Integrations

**Analysis Date:** 2026-08-31

## APIs & External Services

**Home Assistant Frontend:**
- Live entity state - The card reads Home Assistant's injected `hass.states` collection in `dist/glt-flow-card.js` and platform source `src/v100/index.js`; no separate network client or credentials are required in the browser.
  - SDK/Client: Host-provided Lovelace `hass` object in `dist/glt-flow-card.js`.
  - Auth: Existing authenticated Home Assistant frontend session; no repository environment variable.
- Service execution - Equipment controls call Home Assistant services directly through `hass.callService`, or route through companion WebSocket command `glt_flow_card/control/execute` when server enforcement is enabled in `src/v100/index.js` and `custom_components/glt_flow_card/__init__.py`.
  - SDK/Client: Home Assistant frontend `callService` and Python `hass.services.async_call`.
  - Auth: Current Home Assistant user context, propagated to server-side calls in `custom_components/glt_flow_card/__init__.py`.
- Recorder/history retrieval - Replay and trends request Home Assistant History API data through `hass.callApi` in `dist/glt-flow-card.js`; data availability depends on the host's Recorder configuration documented in `README.md` and `docs/wiki/Trends-Reports.md`.
  - SDK/Client: Home Assistant frontend `callApi`.
  - Auth: Existing authenticated Home Assistant frontend session.
- Entity registry metadata - Operations panels query `config/entity_registry/get` through `hass.callWS` in `src/v100/index.js`.
  - SDK/Client: Home Assistant WebSocket API.
  - Auth: Existing Home Assistant WebSocket user/session.

**GLT Flow Card Companion:**
- Project, template, alarm, control, work-order, report, remote-site, and audit operations are exposed as Home Assistant WebSocket commands registered in `custom_components/glt_flow_card/__init__.py` and called by `src/v100/index.js` and the generated `dist/glt-flow-card.js`.
  - SDK/Client: Home Assistant `websocket_api` and frontend `hass.callWS`.
  - Auth: Home Assistant connection user; role resolution uses admin status and per-project designer/operator lists in `custom_components/glt_flow_card/__init__.py`.
- Alarm notifications dispatch to a configured Home Assistant service in `custom_components/glt_flow_card/__init__.py`, so any notification provider already installed in Home Assistant can be used without a provider-specific dependency here.
  - SDK/Client: `hass.services.async_call`.
  - Auth: Home Assistant internal service context; notification service/data are stored in project configuration.

**Remote Home Assistant Sites:**
- Remote entity states are read from `/api/states/{entity_id}` and remote controls are posted to `/api/services/{domain}/{service}` by the companion in `custom_components/glt_flow_card/__init__.py`.
  - SDK/Client: Home Assistant shared aiohttp client from `homeassistant.helpers.aiohttp_client.async_get_clientsession`.
  - Auth: Per-site long-lived bearer token in Home Assistant YAML `glt_flow_card.remote_sites[].token`; documentation uses `!secret glt_remote_token` in `docs/wiki/Companion-Backend.md` and `docs/wiki/Installation.md`.
- The browser receives remote-site metadata with the token removed by `ws_remote_list` in `custom_components/glt_flow_card/__init__.py`; keep remote calls behind the companion rather than placing bearer tokens in Lovelace or browser storage.

**GitHub Platform:**
- GitHub Pages hosts generated documentation and the online designer using `.github/workflows/docs.yml` and source builder `tools/build-site.mjs`.
  - SDK/Client: GitHub Actions `configure-pages`, `upload-pages-artifact`, and `deploy-pages` actions.
  - Auth: GitHub Actions OIDC and repository `GITHUB_TOKEN` permissions declared in `.github/workflows/docs.yml`.
- GitHub Wiki is synchronized from `docs/wiki/*.md` by `.github/workflows/docs.yml`.
  - SDK/Client: Git CLI against the repository wiki Git endpoint.
  - Auth: Workflow-provided `github.token` exposed only to the workflow as `GH_TOKEN` in `.github/workflows/docs.yml`.
- GitHub Releases publish the production card and companion archive on version tags through `.github/workflows/release.yml`.
  - SDK/Client: `softprops/action-gh-release@v2`.
  - Auth: Workflow `contents: write` permission in `.github/workflows/release.yml`.

## Data Storage

**Databases:**
- No standalone SQL/NoSQL database or ORM is used. Runtime state is delegated to browser storage, Home Assistant native storage, and Home Assistant Recorder/history as described in `docs/wiki/YAML-Projects.md`, `README.md`, and `custom_components/glt_flow_card/__init__.py`.
  - Connection: Not applicable; no database URL or environment variable exists in the repository.
  - Client: Home Assistant `Store` for companion data and host-provided History API for time series.

**File Storage:**
- Standalone card mode stores project-library state in browser `localStorage`; implementation is in `dist/glt-flow-card.js` and behavior is documented in `docs/wiki/YAML-Projects.md`.
- Companion mode persists projects, templates, audit entries, alarm state/history, work orders, report history, locks, and schedule-run markers through `Store(hass, 1, "glt_flow_card.projects")` in `custom_components/glt_flow_card/__init__.py`, which maps to Home Assistant's `.storage` subsystem.
- User-authored project bundles, YAML, CSV, and reports are downloaded client-side with browser Blob/download or print APIs in `src/v100/index.js` and `dist/glt-flow-card.js`; no cloud file-storage service is integrated.
- Static product assets are repository files under `dist/`, `docs/`, `examples/`, and `custom_components/glt_flow_card/www/`, published through HACS, GitHub Releases, and GitHub Pages.

**Caching:**
- No Redis, Memcached, CDN API, or application cache service is used.
- Browser-local project state acts as the offline/fallback persistence layer in `dist/glt-flow-card.js`; it is not a shared server cache.
- In-memory companion state (`GltStore.data`, remote-site configuration, alarm tasks, and listener handles) is held for the Home Assistant process lifetime in `custom_components/glt_flow_card/__init__.py` and persisted through Home Assistant `Store` where applicable.

## Authentication & Identity

**Auth Provider:**
- Home Assistant native authentication and WebSocket connection identity - No external identity provider is integrated.
  - Implementation: `custom_components/glt_flow_card/__init__.py` reads `connection.user.id`, `connection.user.name`, and `connection.user.is_admin`; project permissions map users to viewer, operator, or designer roles.
- Remote Home Assistant authentication uses per-site long-lived access tokens only in the companion backend configuration in `custom_components/glt_flow_card/__init__.py` and `docs/wiki/Companion-Backend.md`.
  - Implementation: HTTP `Authorization: Bearer ...` headers are added by the Home Assistant shared aiohttp session; `ws_remote_list` omits tokens from responses.
- Direct card fallback inherits the permissions of the currently logged-in Home Assistant frontend session via `hass.callService` in `src/v100/index.js`; server-enforced project roles require the companion.

## Monitoring & Observability

**Error Tracking:**
- None detected. There is no Sentry, OpenTelemetry, hosted error tracker, or analytics SDK in `package.json`, `custom_components/glt_flow_card/manifest.json`, or application sources.

**Logs:**
- Persistent operational audit events are stored by the companion in Home Assistant `Store` via `GltStore.add_audit` in `custom_components/glt_flow_card/__init__.py`; records include user identity and timestamps.
- Remote and WebSocket failures are returned to the calling Home Assistant frontend through WebSocket error responses in `custom_components/glt_flow_card/__init__.py`.
- Alarm notification and schedule-service exceptions are currently swallowed after failed Home Assistant service calls in `custom_components/glt_flow_card/__init__.py`; no dedicated Python logger is configured.
- CI visibility comes from GitHub Actions job logs in `.github/workflows/`; screenshot server logs are temporarily written under `/tmp` only in `.github/workflows/screenshots.yml`.

## CI/CD & Deployment

**Hosting:**
- Home Assistant/HACS serves the dashboard module identified by `hacs.json` from release artifact `dist/glt-flow-card.js`.
- Home Assistant hosts the optional companion copied from `custom_components/glt_flow_card/`; release packaging is defined in `.github/workflows/release.yml`.
- GitHub Pages hosts documentation and `docs/editor/`, generated by `tools/build-site.mjs` and deployed in `.github/workflows/docs.yml`.
- GitHub Wiki mirrors `docs/wiki/` through the wiki job in `.github/workflows/docs.yml`.

**CI Pipeline:**
- `.github/workflows/validate.yml` installs npm dependencies, syntax-checks `dist/glt-flow-card.js`, and runs all Node tests for pushes and pull requests.
- `.github/workflows/build-v1.yml` bundles ES2022 JavaScript, regenerates card/editor/docs artifacts, runs Node tests, validates companion Python syntax, verifies expected artifact markers, and may commit generated outputs.
- `.github/workflows/apply-v040.yml` assembles legacy source parts, bundles them with esbuild, updates generated artifacts, tests, builds docs, and may commit generated outputs.
- `.github/workflows/screenshots.yml` installs Playwright/Chromium, serves the generated site locally, captures current UI images, updates README showcases, and may commit them.
- `.github/workflows/release.yml` validates tag builds, packages `custom_components/glt_flow_card/`, and creates a GitHub Release.

## Environment Configuration

**Required env vars:**
- Application runtime: none detected in repository code. Home Assistant supplies authenticated runtime/session context to the card and companion through its APIs in `dist/glt-flow-card.js` and `custom_components/glt_flow_card/__init__.py`.
- CI-only `GH_TOKEN` is assigned from `${{ github.token }}` for wiki synchronization in `.github/workflows/docs.yml`; it is not an end-user setting.
- Remote-site values are YAML keys rather than environment variables: `id`, `name`, `url`, `token`, and optional `verify_ssl`, documented in `docs/wiki/Installation.md` and consumed by `custom_components/glt_flow_card/__init__.py`.

**Secrets location:**
- Store remote Home Assistant tokens in Home Assistant `secrets.yaml` and reference them with `!secret`, as prescribed by `docs/wiki/Companion-Backend.md` and `docs/wiki/Installation.md`; no secret file is committed or read by repository tooling.
- GitHub workflow credentials use GitHub-provided tokens and permission scopes in `.github/workflows/docs.yml` and `.github/workflows/release.yml`.
- Never place remote tokens in card YAML, `localStorage`, generated project bundles, or frontend source; the token-stripping boundary is implemented in `custom_components/glt_flow_card/__init__.py`.

## Webhooks & Callbacks

**Incoming:**
- No HTTP webhook endpoints are registered. The companion exposes authenticated Home Assistant WebSocket commands under the `glt_flow_card/*` namespace in `custom_components/glt_flow_card/__init__.py`.
- Home Assistant invokes lifecycle callbacks `async_setup`, `async_setup_entry`, and `async_unload_entry` in `custom_components/glt_flow_card/__init__.py`; these are integration hooks, not public webhooks.
- The companion subscribes internally to Home Assistant `state_changed` events and minute-boundary scheduling through `async_track_time_change` in `custom_components/glt_flow_card/__init__.py`.

**Outgoing:**
- No third-party webhook delivery is implemented.
- Alarm actions can call any configured Home Assistant notification/service endpoint via `hass.services.async_call` in `custom_components/glt_flow_card/__init__.py`; delivery beyond Home Assistant depends on integrations installed by the user.
- Remote Home Assistant REST calls are limited to state reads and service execution in `custom_components/glt_flow_card/__init__.py`; they are direct authenticated API requests rather than webhooks.

---

*Integration audit: 2026-08-31*
