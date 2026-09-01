---
phase: 2
slug: authoritative-policy-controls-collaboration
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-01
sources:
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/02-authoritative-policy-controls-collaboration/02-CONTEXT.md
  - .planning/phases/01-trusted-contract-release-foundation/01-UI-SPEC.md
  - src/v100/project-safety.js
  - src/v100/project-safety-i18n.mjs
  - test/e2e/project-safety.spec.mjs
  - test/e2e/fixtures/fake-ha.mjs
---

# Phase 2 — UI Design Contract

> Visual, interaction, security-state, and accessibility contract for authoritative capabilities, configured controls, trusted audit evidence, exclusive engineering leases, and conflict-safe shared editing. Phase 2 extends the existing Project safety surface; it does not redesign the product or implement the richer Phase-4 object panel.

---

## Design Intent

Phase 2 makes server authority continuously understandable without turning the engineering workspace into a security console. A user must always be able to answer four questions before acting:

1. Is this a shared authoritative project or a separate local-only project?
2. What server-owned role and capabilities apply to me now?
3. Do I hold the valid lease and revision required for this mutation?
4. What did the Companion accept, dispatch, confirm, deny, time out, or fail?

The UI MUST be **honest before convenient**. It may use a capability snapshot to choose visible affordances, but it never treats browser state as authorization. Every shared action is re-authorized by the Companion. Authority loss, lease expiry, a role change, a revision conflict, or missing trusted evidence immediately replaces optimistic controls with an explicit read-only or recovery state.

### Locked product language

- Preserve the existing three-column designer, compact toolbar, themes, and the single **Project safety** / **Projektsicherheit** entry adjacent to Projects.
- Preserve the five existing top-level tabs in this exact order: **Overview**, **Validate**, **Migrate & compare**, **Bundles**, **Evidence**. Do not add a sixth tab or another permanent toolbar action.
- Add a persistent `AuthorityStateBar` between the Phase-1 scope banner and the tab list. It shows shared/local mode, Companion freshness, the user's server-owned role, lease state, and revision state.
- Extend **Overview** with Shared authority, My access, Collaboration, and Control policy summary cards. The Shared authority card opens the in-dialog access-management work surface only when the server exposes the administration capability.
- Extend **Migrate & compare** with the engineering lease bar, candidate preservation, two-session conflict view, and merge preview. All Phase-1 validation, backup, and diff prerequisites remain in force.
- Extend **Evidence** with separate **Trusted audit** / **Vertrauenswürdiges Auditprotokoll** and **Client telemetry (untrusted)** / **Client-Telemetrie (nicht vertrauenswürdig)** sections. They are never merged into one timeline or given the same status styling.
- Configured control affordances remain where the product already exposes them. Phase 2 supplies one reusable authorization/confirmation/result primitive; Phase 4 owns the rich equipment object panel.
- Membership and role assignments are server-owned. Project JSON, imported bundles, browser storage, URL parameters, and form fields never define the acting user's role or capability set.
- A shared project never silently changes into local mode. Local-only engineering is a separate explicit choice and remains labeled on every screen.

### Principal-state hierarchy

Each view has one dominant focal point:

| Principal state | Focal point | Required subordinate information |
|-----------------|-------------|----------------------------------|
| Ready to read | Project name plus **Shared — read-only** or **Local-only** mode | Role, capability freshness, current revision |
| Ready to edit | **Editing lease active** status plus expiry | Expected revision, lease purpose, release action |
| Acquiring or renewing | Lease progress status | Candidate retained, cancel/retry where safe |
| Conflict | **Save blocked — newer revision exists** | Base/current/candidate revisions, preserved-candidate statement, recovery actions |
| Control pending | Current authoritative control state | Control name, normalized target summary, correlation ID |
| Authority lost | Persistent **Shared project is read-only** alert | Safe reason, candidate retained, retry capability refresh |
| Error | Specific failed stage and safe invariant | Recovery action, bounded details, audit correlation if available |

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Existing native Web Components, Shadow DOM, and Home Assistant frontend primitives; no shadcn |
| Preset | Existing GLT Neo 2030 dark and Clean/Operations Light themes |
| Component library | None; extend existing `.glt-safe-*`, `.glt-v1-*`, and designer patterns |
| Icon library | Existing inline SVG/status vocabulary and Home Assistant-hosted icons already in use; no new dependency |
| Font | `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Code/data font | `ui-monospace, SFMono-Regular, Consolas, monospace` for IDs, revisions, capability codes, correlation IDs, cursors, and timestamps |

No React, Vite, Tailwind, Radix, shadcn, or external registry is introduced. Authored modules under `src/v100/` remain the design source; `dist/`, Companion `www`, and editor copies are generated outputs.

### Shape and elevation

| Element | Contract |
|---------|----------|
| Existing Project safety dialog | Retain 16px radius, 1px strong border, maximum 1120px by 92vh |
| Authority state bar | Rectangular full-width strip, 0px additional radius when attached to banners, 1px bottom border |
| Cards and conflict groups | 10px radius, 1px border, no more than one low-contrast shadow layer |
| Buttons, fields, role selects | 8px radius; primary actions are not pills |
| Role/lease/evidence chips | Fully rounded compact chip, always icon plus text |
| Tables | Flat 1px row separators; sticky header only inside a bounded scroll region |
| Conflict/confirmation dialog | Native modal semantics; no backdrop dismissal while a save or control request is in flight |

---

## Spacing Scale

All Phase-2 additions use multiples of 4 and inherit the Phase-1 scale.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label and inline metadata gaps |
| sm | 8px | Dense control groups, table cells, chips |
| md | 16px | Default card, banner, and field-group padding |
| lg | 24px | Dialog content gutters and section separation |
| xl | 32px | Major state/workflow separation |
| 2xl | 48px | Empty and blocked-state vertical spacing |
| 3xl | 64px | Page-level separation only |

Exceptions:

- Every touch target is at least 44×44px. A 32px visible compact control is allowed on pointer layouts only when its non-overlapping hit area is 44px.
- Status glyphs may be 16px and the connection dot 8px because both are decorative and paired with text.
- Focus outlines are 2px with 2px offset; borders are 1px. These strokes do not alter layout spacing.
- Lease countdown values use tabular numerals without reserving more than 72px; the complete expiry time remains available in adjacent text or details.

---

## Typography

Exactly four interface sizes and two weights apply to new Phase-2 UI.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label / metadata | 12px | 400 or 700 | 1.4 |
| Body / controls | 14px | 400 or 700 | 1.5 |
| Section heading | 18px | 700 | 1.3 |
| Dialog title / blocking result | 24px | 700 | 1.2 |

Rules:

- Use 700 only for headings, selected tabs, primary values, action labels, and the leading phrase of a blocking message.
- Role names, capability codes, revision numbers, lease expiry, audit event codes, and correlation IDs use 12px or 14px; nothing drops below 12px.
- Do not use all caps for messages. Short technical tags may be uppercase at 12px with `0.06em` tracking.
- A disabled reason is adjacent to the action or referenced through `aria-describedby`; it is never available only as a hover tooltip.
- Never truncate a denial code, revision, expiry, correlation ID, or destructive consequence without a copy/full-details action.

---

## Color

### Dark theme — Neo 2030

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#050d16` / canvas `#081522` | Workspace, dialog context, main content |
| Secondary (30%) | `#0a1826`, `#0e2031`, `#11283d` | Cards, state bar, table headers, conflict panels |
| Accent (10%) | `#0aa8ff`, text `#36c7ff` | Selected tab, focus, current step, primary safe CTA, links |
| Border | `#19334a`, strong `#244b69` | Boundaries and separators |
| Primary text | `#edf6ff` | Main text |
| Muted text | `#8198ad` | Helper copy and metadata |
| Destructive | `#ff4f4f` | Destructive final action and failure state only |

### Light theme — Clean / Operations Light

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#edf3f7` / canvas `#ffffff` | Workspace and main content |
| Secondary (30%) | `#ffffff`, `#f7fafc`, `#eef5f8` | Cards, state bar, table headers, conflict panels |
| Accent (10%) | `#087f8c` | Selected tab, focus, current step, primary safe CTA, links |
| Border | `#d4e0e8`, strong `#bacfdc` | Boundaries and separators |
| Primary text | `#172233` | Main text |
| Muted text | `#66788b` | Helper copy and metadata |
| Destructive | `#c62828` | Destructive final action and failure state only |

Accent is reserved for the selected tab, focused control, primary safe action, active lease progress, selected merge operation, current workflow step, and navigational link. It MUST NOT imply authorization, trust, success, or a live plant state.

### Security and collaboration semantics

| Meaning | Dark / Light color | Mandatory non-color cue | Label example |
|---------|--------------------|-------------------------|---------------|
| Authorized/current | `#31d879` / `#147a43` | Check or shield-check icon + text | Capability current |
| Lease held by this session | `#31d879` / `#147a43` | Key icon + owner text + expiry | Editing lease active |
| Pending/refresh/renew | Accent | Spinner or progress bar + text | Renewing editing lease |
| Conflict/attention | `#ff9f1c` / `#9a5a00` | Split-arrows triangle + text | Newer revision exists |
| Denied/failed/expired | `#ff4f4f` / `#c62828` | Cross or expired-key icon + text | Editing lease expired |
| Read-only/unavailable | `#67e8f9` / `#0d6a8e` | Lock icon + persistent banner | Shared project is read-only |
| Trusted audit | `#31d879` / `#147a43` | Shield-check icon + explicit source label | Server-authored event |
| Untrusted telemetry | `#ff9f1c` / `#9a5a00` | Dashed speech/monitor icon + explicit label | Client telemetry — untrusted |
| Unknown/not checked | `#8198ad` / `#66788b` | Hollow/dashed icon + text | Capability not available |

No state relies on hue, animation, position, or icon alone. Forced-colors mode uses system colors, preserved borders, and visible text labels.

---

## Information Architecture

### Persistent authority state bar

The bar appears for every Project safety tab and has this reading order:

1. Mode: **Shared project** / **Gemeinsames Projekt** or **Local-only project** / **Nur lokales Projekt**.
2. Companion state: current, refreshing, stale, unavailable, or incompatible.
3. My role: Viewer, Operator, Engineer, Admin, or no assignment.
4. Editing state: read-only, lease available, lease held by this session, held by another session, renewing, expired, or lost.
5. Revision: current server revision; show expected revision when a candidate exists.

On desktop this is one wrapping row. Below 768px it becomes stacked mode/authority and role/lease rows. The project ID, hidden project count, another user's name, token, or capability list never appears in a denial for an unknown project.

When capability evidence becomes stale or unavailable, the bar switches to read-only in the same render cycle, emits one assertive announcement, disables shared actions, and keeps a pending candidate in memory. It never waits for an attempted save to reveal authority loss.

### Overview additions

Add four cards after the existing Project and Companion cards:

1. **Shared authority** — current/stale capability snapshot, server policy version, last refresh, and read-only reason.
2. **My access** — server-owned role and a disclosure listing allowed capability labels only for the known current project.
3. **Collaboration** — lease state, current revision, candidate state, and next safe action.
4. **Control policy** — configured control count visible to this user, server normalization available/unavailable, and last authoritative result state. Never show unauthorized control counts.

Admin users with `project.members.manage` receive **Manage project access** / **Projektzugriff verwalten**. Everyone else sees only their own role/capabilities. The action is absent—not disabled—when its presence would reveal authority.

### Access management work surface

The work surface opens inside Project safety, replacing Overview content while preserving the header, authority bar, and a **Back to overview** action.

- Table columns: member display name supplied by Home Assistant, fixed role, effective capability summary, assignment status, and action.
- Search/filter operates only on already authorized returned rows; result counts reflect that authorized result set only.
- **Add member** uses a server-returned eligible-user picker. It never accepts arbitrary user IDs or client-authored capabilities.
- The role selector contains exactly Viewer, Operator, Engineer, and Admin. The server may omit or disable choices above the administrator's assignable ceiling; the reason is shown without exposing hidden authority details.
- Capability checkboxes do not exist. Selecting a role shows its read-only server-returned capability matrix.
- Save is atomic and requires the current revision plus this session's valid administration lease/token as advertised by the server contract.
- Removing a member or reducing access opens a confirmation naming the member and new consequence. Initial focus is **Cancel access change**.
- A user may not remove or demote the last permitted administrator; the server denial is shown as a stable localized policy error.

### Trusted audit and telemetry

Evidence contains two separate bordered sections with independent pagination and empty/error states:

- **Trusted audit** includes server timestamp, server actor display label, event code, project, normalized result, correlation ID, and bounded details. A shield label **Server-authored** is present in the heading and every exported record contract.
- **Client telemetry (untrusted)** includes received server time, telemetry category, client-supplied occurrence time if accepted, bounded payload summary, rate-limit result, and the permanent label **Not security or control evidence**.
- A filter never spans both stores. A combined total is forbidden.
- Pagination uses **Load next 50 events** with an opaque cursor. Do not expose total counts when the policy response does not authorize them.
- Raw client timestamps, claimed actors, or claimed outcomes never receive trusted styling and never populate the trusted audit table.
- Export is available only when the server grants it; exported trusted and untrusted data remain separate files/sections with explicit provenance labels.

---

## Component Inventory

| Component | Purpose | Required states |
|-----------|---------|-----------------|
| `AuthorityStateBar` | Persistent shared/local, Companion, role, lease, revision summary | current, refreshing, stale, unavailable, incompatible, local-only |
| `RoleCapabilitySummary` | Show own fixed role and server-returned effective capabilities | viewer, operator, engineer, admin, none, stale, changed |
| `CapabilityReason` | Explain a known disabled action safely | role-missing, lease-missing, revision-stale, authority-unavailable, policy-denied |
| `MemberAccessTable` | Administer server-owned member role assignments | loading, ready, empty, filtered, save-pending, conflict, denied |
| `RoleMatrixDisclosure` | Read-only fixed role-to-capability mapping | current, unavailable, assignment-ceiling-limited |
| `EngineeringLeaseBar` | Acquire, renew, release, and display exclusive edit lease | available, acquiring, held-self, held-other, renewal-due, renewing, expired, lost, release-pending |
| `CandidateStateChip` | Make unsaved candidate preservation explicit | none, clean, dirty, preserved, merge-preview, discarded, applied |
| `RevisionTriplet` | Show base/current/candidate revisions and digests safely | aligned, stale, conflict, current-redacted |
| `ConflictRecoveryPanel` | Non-destructive two-session recovery | detected, refreshing, preview-ready, retrying, applied, role-lost, authority-lost |
| `MergePreview` | Semantic base/current/candidate operation selection | added, removed, moved, binding, config, overlap, dependency-locked, selected, invalid |
| `ConfiguredControlConfirm` | Confirm a server-known control ID and bounded user input | ready, invalid-input, capability-denied, maintenance-blocked, simulation-blocked |
| `ControlEvidenceStatus` | Report authoritative control lifecycle | accepted, dispatched, readback-confirmed, timed-out, denied, failed, cancelled-before-dispatch |
| `TrustedAuditTable` | Show authorized server-authored events | loading, ready, empty, next-page, denied, stale |
| `UntrustedTelemetryTable` | Show bounded client telemetry without trust implication | loading, ready, empty, rate-limited, rejected, denied |
| `ReadOnlyAuthorityBanner` | Block shared mutation without switching modes | stale, unavailable, incompatible, role-revoked, lease-lost |
| `LiveAnnouncementRegion` | Announce state transitions without duplicating visible text | polite-status, assertive-alert |

All interactions use native buttons, fields, selects, tables, disclosures, and dialog semantics. A styled `<div>` is not a button, tab, checkbox, or alert.

---

## Server Capability and Role Contract

### Capability loading

- Open a shared project in read-only presentation first. Do not render an enabled shared mutation during capability loading.
- The initial server snapshot provides mode, own role, effective capabilities, policy version, project revision, freshness/expiry, and visible control/access summaries. The browser does not derive additional permissions from role names.
- Refresh at 50% of the server-advertised snapshot lifetime, on visibility return, reconnect, role-change notification, sequence gap, and before opening a mutation confirmation.
- At server expiry, refresh rejection, sequence gap, or incompatible policy version, immediately enter read-only. A previously enabled control cannot remain enabled behind an error toast.
- Role/capability changes update navigation and action availability atomically. If focus was on a removed action, move it to the nearest section heading and announce the change.
- Unknown or unauthorized projects use the same direct-access result presentation. Lists, searches, badges, and counts omit unauthorized projects rather than showing redacted placeholders.

### Role presentation

Fixed display names are localized as Viewer / Betrachter, Operator / Bediener, Engineer / Ingenieur, and Admin / Administrator. Do not invent role colors as the only distinction. Each role chip uses a person/shield icon, full text, and an accessible description.

The UI may explain a missing capability only after the server confirms the project is visible to the user. Safe pattern: `Editing requires the Engineer role or higher.` Unsafe pattern: `You cannot edit project secret-plant because Alice owns it.`

Capability identifiers appear in a technical disclosure for administrators and tests. Ordinary action labels use task language, not raw codes.

---

## Engineering Lease Contract

### Acquisition

- A visible user with the advertised edit capability sees **Acquire editing lease** / **Bearbeitungslease anfordern**. Viewer and Operator users remain read-only and do not receive a misleading disabled lease button.
- Acquisition sends a server-known project route and purpose only. The opaque token is held in memory, never displayed, copied, persisted to localStorage, included in URLs, logs, telemetry, or diagnostics.
- While acquiring, retain read navigation and show `Requesting exclusive editing lease`; disable duplicate requests.
- Success shows owner **This session**, server expiry, expected revision, and **Release editing lease**. The editor enables shared mutation only after a fresh project head and capability snapshot agree with the lease response.
- A lease held elsewhere displays **Another session is editing** without the other user's name, connection ID, token, or exact activity. Offer **Check lease availability**, not force-release, unless a separately authorized administrator override is explicitly returned by the server.

### Renewal and expiry

- Use the server-advertised TTL. Default UI/test policy is 300 seconds; the accepted server option range is 60–900 seconds. Never extend expiry locally.
- When a dirty candidate exists and the document is visible, send one explicit renewal request when 40% of TTL remains. Show **Renewing editing lease** while pending. Also expose **Renew now** once 50% remains.
- Do not renew an idle clean lease automatically. At 50% remaining show the exact expiry and allow deliberate renewal or release.
- A successful renewal replaces the in-memory token/expiry atomically and announces the new expiry once.
- At server expiry, renewal denial, disconnect invalidation, role loss, or session mismatch: disable all shared save/apply actions immediately, retain the candidate in memory, mark it **Candidate preserved — not saved**, and focus the blocking lease message after the current event completes.
- There is no grace period and no retry using the old token. Reconnect requires **Reacquire and compare** against the current project head.

### Release and navigation

- Releasing a clean lease is one action with a polite completion announcement.
- Releasing or closing with a dirty candidate opens a confirmation: keep editing, discard candidate and release, or cancel. No default action discards the candidate.
- Browser close/reload cannot promise preservation. When a dirty shared candidate exists, use the platform before-unload warning and visible copy that the candidate is held only in this browser session.
- A lease release failure leaves the UI read-only until the server confirms ownership; do not claim that another session can edit.

---

## Two-Session Conflict and Merge Contract

### Conflict detection

A stale revision, lease mismatch, digest mismatch, or policy re-check denial blocks the transaction. The result view shows:

- **Base revision** — revision from which this candidate was edited.
- **Current revision** — latest authorized server revision.
- **Candidate** — in-memory user changes, labeled **Not saved**.
- Stable conflict code and a bounded semantic summary.
- `Your candidate is preserved in this browser session. No shared project data was overwritten.`

The current project content and counts are limited to what the refreshed capability permits. If access was revoked, preserve the user's candidate locally in memory but do not fetch or reveal current project content.

### Recovery actions

Present actions in this order:

1. **Refresh current project** / **Aktuelles Projekt laden** — read-only fetch; candidate stays intact.
2. **Preview non-destructive merge** / **Nicht-destruktive Zusammenführung prüfen** — recompute server-authorized semantic base/current/candidate evidence.
3. **Reacquire and retry** / **Lease neu anfordern und erneut versuchen** — only after capability, lease, and current revision are all current.
4. **Discard candidate** / **Kandidaten verwerfen** — destructive local-only confirmation.

Never offer **Overwrite**, **Force save**, automatic last-writer-wins, a raw patch upload, or a retry that reuses the stale token/revision.

### Merge preview

- Use Phase-1 semantic categories and stable IDs. Add explicit **Concurrent overlap** / **Gleichzeitige Überschneidung** for operations changed differently in current and candidate.
- Start with non-overlapping valid candidate operations selected. Overlaps start unselected and require an explicit choice of **Keep current** or **Use candidate** for that field/object.
- Dependency-locked operations explain the server-declared reason. Selection triggers a fresh candidate validation and impact summary.
- The final CTA is **Apply merged candidate** / **Zusammengeführten Kandidaten übernehmen** only when a fresh lease, expected current revision, valid preview identity, backup, and validation are current.
- Apply remains an atomic server transaction. On a second conflict, return to the conflict panel with the candidate still retained; do not stack or silently replay patches.
- Success shows new revision, selected operation count, verified backup, transaction/correlation ID, and **Candidate saved**. Only then clear the in-memory candidate.

---

## Configured Control Contract

Phase 2 defines a reusable safety primitive, not the complete Phase-4 equipment panel.

### Request and confirmation

- A control affordance is rendered only from a server-returned configured control summary visible to the current user. The browser sends the opaque control ID and only bounded user input fields declared by that control.
- Confirmation shows localized control name, project/equipment label already authorized for display, requested bounded value, and a read-only normalized target summary returned by the Companion. It does not expose editable domain, service, entity/device/area target, immutable data, or templates.
- Primary CTA uses the server-localized imperative verb plus object, for example **Set supply setpoint**. Generic **Run service** and raw service selectors are forbidden.
- Before dispatch, refresh capability and control preview. Changed policy, role, revision, target digest, maintenance gate, or simulation gate invalidates confirmation.
- Unknown keys, oversized values, target overrides, templates, nested calls, and unsafe services show a stable validation/denial message before any dispatch state.

### Authoritative result states

| State | Visible contract | Allowed next action |
|-------|------------------|---------------------|
| Accepted | `Command accepted by Companion` plus server time and correlation ID | Wait for dispatch/result; no success claim |
| Dispatched | `Command dispatched` plus normalized target label | Wait for readback; cancel only if server explicitly supports it |
| Readback confirmed | `Command confirmed by readback` plus expected/observed bounded value and time | Close/View trusted audit |
| Timed out | `Command timed out; confirmation was not received` | Check current state, retry only through a new confirmation |
| Denied | Stable safe denial plus unchanged/no-dispatch statement | Review access/gate; no retry loop |
| Failed | Bounded server failure plus whether dispatch occurred | Check current state, view trusted audit, create a new request if appropriate |
| Cancelled before dispatch | `Command cancelled before dispatch` | Close; no plant-state implication |

Accepted and dispatched use pending styling, never success green. Only readback-confirmed may use success styling. Timeout and failure never imply the requested target was not reached; they explicitly say confirmation is unknown and direct the user to current state. Browser exceptions, local state changes, or `hass.callService` resolution never create an authoritative result.

The result stays associated with its server correlation ID and normalized target. Trusted audit and the visible result must agree on state and timing. Client telemetry cannot alter the result.

---

## Trusted Audit and Untrusted Telemetry Contract

### Trusted audit rows

Each authorized row contains:

- server event time in active locale and UTC details;
- server-resolved actor display label and immutable internal actor reference only in authorized details;
- event code and localized event name;
- affected authorized project/control/member label;
- accepted/dispatched/confirmed/timed-out/denied/failed result;
- normalized target summary where applicable;
- correlation/transaction ID;
- bounded error/decision detail and policy version.

No client-supplied actor, timestamp, role, result, target, or event type is presented as trusted. A `Server-authored` shield label and accessible description are always present.

### Telemetry rows

Telemetry is visually separated by a warning-toned border and the permanent heading `Client telemetry — untrusted`. Show the server receipt time first. Any client occurrence time is labeled `Client-reported time`. Payloads are bounded summaries; rejected/rate-limited items show stable reasons without echoing unsafe content.

Telemetry cannot be filtered into a control/security audit view, cannot satisfy an evidence status, and cannot use a shield-check/success treatment. Export filenames and JSON roots include `untrusted-telemetry`.

### Empty and failure states

- Trusted empty: `No authorized server audit events are available for this project.`
- Telemetry empty: `No accepted client telemetry is available. This does not indicate that no security or control events occurred.`
- Page failure: keep loaded rows, mark them stale, and offer **Load events again**. Do not clear the table into a false empty state.
- Capability loss: remove unauthorized rows from the DOM immediately, move focus to the section heading, and show the non-enumerating denied state.

---

## Read-Only Companion Loss Contract

These are behavioral security rules:

- Shared mode becomes read-only when Companion is missing, capability evidence is stale, refresh is rejected, policy versions are incompatible, a subscription has a sequence gap, the role is revoked, or the lease is lost.
- Disable shared save, apply, rollback, import persistence, membership changes, configured controls, remote proxy actions, and authoritative evidence export in the same render cycle.
- Preserve an unsaved candidate in memory and label it **Candidate preserved — not saved**. Validation, inspection, and safe diff of the in-memory candidate may continue locally, but cannot produce a trusted or saved status.
- Show **Retry authority check** only when a new Companion request is safe. Reconnect success must still reacquire capability, project head, and lease; it never resurrects the prior token.
- Do not call `hass.callService`, mutate Lovelace config, write shared content to localStorage/IndexedDB, send caller-authored WebSocket targets, or silently use the standalone ProjectStore.
- The user may explicitly leave shared mode and open/create a local-only project through the existing standalone workflow. This is a separate navigation decision, not a fallback, and the shared candidate is not copied automatically.
- Kiosk/leitstand mode remains read-only when authority is unavailable; it never exposes membership, lease override, merge apply, or control actions.

---

## Dialog and Confirmation Contract

- Use native `<dialog>` where supported or preserve equivalent role/dialog focus behavior in the existing Shadow DOM implementation.
- Initial focus goes to the heading for read-only results, the first invalid field for forms, **Cancel** for destructive confirmations, and the principal status for authority/lease loss.
- Tab/Shift+Tab remain in a modal. Escape closes only read-only previews; it does not close an acquiring/renewing lease, saving merge, membership mutation, or dispatched control result before the server state is known.
- Closing returns focus to the exact trigger unless that trigger was removed by a capability change; then focus the owning section heading.
- Nested browser alerts/prompts are forbidden.

### Destructive actions

| Action | Confirmation requirement | Initial focus |
|--------|--------------------------|---------------|
| Discard unsaved candidate | Name project, base revision, candidate change count, and that recovery is unavailable after discard | Keep candidate |
| Discard candidate and release lease | Same candidate facts plus lease consequence | Keep editing |
| Remove project member | Member display name, old role, lost access consequence | Cancel access change |
| Reduce member role | Member display name, old/new fixed role, effective capability change summary | Cancel access change |
| Administrator lease override, if server-authorized | Existing lease state without other-session identity, candidate-loss risk, reason field | Cancel override |

Final destructive buttons use destructive color. Ordinary lease release, role save, merge apply, and configured control confirmation retain normal primary styling unless their actual configured action is itself destructive and the server labels it accordingly.

---

## Responsive Behavior

| Width / mode | Contract |
|--------------|----------|
| ≥1280px widescreen | Existing three-column designer remains; Project safety max 1120px. Conflict view uses operation list plus current/candidate inspector. Authority bar stays one wrapping row. |
| 1024–1279px tablet landscape | Content plus 280px summary rail. Member/audit tables remain tabular; conflict inspector opens inline. |
| 768–1023px tablet portrait | One content column. Authority bar uses two rows. Revision triplet and control evidence stack above actions. |
| <768px mobile | Full-screen Project safety work surface; sticky header and authority state; tabs scroll horizontally; tables become labeled cards; footer actions stack with primary last. |
| Secure kiosk/leitstand | Read-only authority, control outcome, and trusted status may be shown; membership management, merge apply, lease override, and telemetry details are absent. |
| 200% zoom / 320 CSS px | One-column reflow, no horizontal page scroll, full denial/conflict copy, reachable recovery actions, untruncated revision/correlation values. |

Mobile never hides mode, authority freshness, role, lease state, candidate preservation, conflict, control result, trusted/untrusted label, or recovery action. Optional technical columns move into disclosures.

---

## Keyboard, Focus, and Assistive Technology

### Keyboard map

| Context | Keys |
|---------|------|
| Existing top-level tabs | Left/Right moves focus; Home/End first/last; Enter/Space activates |
| Capability/role disclosure | Native Enter/Space toggle |
| Member table/cards | Tab reaches row actions; select uses native keys; no pointer-only menus |
| Lease actions | Tab + Enter/Space; no shortcut acquires, renews, releases, or overrides a lease |
| Conflict operation list | Up/Down moves row focus; Left/Right disclosure; Space selects when permitted; Enter opens comparison |
| Merge choice | Native radio group: arrows change choice; current choice announced with object label |
| Audit/telemetry | Table navigation remains sequential; Load next page preserves focus at the triggering button and announces appended count |
| Modal | Escape only when no protected server operation is active |

No shortcut directly saves, merges, discards a candidate, changes a role, releases a dirty lease, or sends a configured control.

### Focus rules

- Every interactive element has a 2px accent focus outline with 2px offset, unclipped in scroll containers and visible in both themes/forced colors.
- On authority loss, do not interrupt text entry mid-keystroke. After the input event, focus the blocking alert, preserve the candidate, and provide a return link to the last edited field for inspection only.
- On lease expiry, focus the lease alert only if focus was on a now-disabled mutation; otherwise announce and preserve current focus.
- On conflict, focus the conflict heading. **Go to first overlap** moves to the first conflicting operation.
- On role change that removes the focused action, focus the owning section heading.
- On successful save, focus the receipt heading; closing restores focus to the Project safety trigger or project heading.
- Modal focus is contained and restored. No focus trap remains after removal.

### Live regions

- One polite `role="status"` region announces capability refresh success, lease acquisition/renewal/release, candidate preservation, appended audit rows, control accepted/dispatched/confirmed, and copied IDs.
- One assertive `role="alert"` region announces authority loss, role revocation, lease expiry/loss, revision conflict, control denial/timeout/failure, and blocked merge.
- Announce state transitions once. Do not repeat countdown seconds, every progress percentage, or the same denial on each render.
- Accepted → dispatched → confirmed transitions include the configured control name. Audit page append announces only the number and section label.
- Visual icons adjacent to complete status text are `aria-hidden="true"`.

Respect `prefers-reduced-motion`: no pulsing authority/lease indicators, no animated conflict arrows, and no color transitions required to understand state. Use static glyph plus text and a determinate/indeterminate progress primitive.

---

## Copywriting Contract

All strings live in the German/English data catalog; UI logic never branches on literal text. Variable interpolation is escaped as text.

### Primary, empty, and error copy

| Element | English | German |
|---------|---------|--------|
| Primary editing CTA | Acquire editing lease | Bearbeitungslease anfordern |
| Primary conflict CTA | Preview non-destructive merge | Nicht-destruktive Zusammenführung prüfen |
| Access-management CTA | Manage project access | Projektzugriff verwalten |
| Empty shared-project heading | No shared projects available | Keine gemeinsamen Projekte verfügbar |
| Empty shared-project body | No projects are assigned to your Home Assistant identity. Ask an administrator for access or open a separate local-only project. | Ihrer Home-Assistant-Identität sind keine Projekte zugewiesen. Bitten Sie einen Administrator um Zugriff oder öffnen Sie ein separates, nur lokales Projekt. |
| Generic authority error | The authority check could not be completed. Shared actions are read-only; your candidate was not saved. Retry the authority check when Companion is available. | Die Autoritätsprüfung konnte nicht abgeschlossen werden. Gemeinsame Aktionen sind schreibgeschützt; Ihr Kandidat wurde nicht gespeichert. Wiederholen Sie die Autoritätsprüfung, wenn der Companion verfügbar ist. |
| Destructive confirmation | Discard candidate: Your {count} unsaved changes for “{project}” cannot be recovered after discard. Keep the candidate or discard it. | Kandidaten verwerfen: Ihre {count} ungespeicherten Änderungen für „{project}“ können nach dem Verwerfen nicht wiederhergestellt werden. Behalten oder verwerfen Sie den Kandidaten. |

### Modes, authority, and roles

| State or action | English | German |
|-----------------|---------|--------|
| Shared mode | Shared project — Companion authority required | Gemeinsames Projekt — Companion-Autorität erforderlich |
| Local mode | Local-only project — not shared or server-authorized | Nur lokales Projekt — nicht gemeinsam oder serverautorisiert |
| Authority current | Companion authority current | Companion-Autorität aktuell |
| Authority refreshing | Refreshing Companion authority | Companion-Autorität wird aktualisiert |
| Authority stale | Companion authority is stale — shared actions are read-only. | Companion-Autorität ist veraltet — gemeinsame Aktionen sind schreibgeschützt. |
| Authority unavailable | Companion unavailable — shared project operations are read-only. | Companion nicht verfügbar — gemeinsame Projektaktionen sind schreibgeschützt. |
| Authority incompatible | Card and Companion policy versions are incompatible — shared actions are read-only. | Die Richtlinienversionen von Karte und Companion sind nicht kompatibel — gemeinsame Aktionen sind schreibgeschützt. |
| No assignment | No project role assigned | Keine Projektrolle zugewiesen |
| Viewer | Viewer | Betrachter |
| Operator | Operator | Bediener |
| Engineer | Engineer | Ingenieur |
| Admin | Admin | Administrator |
| Role changed | Your project access changed. Available actions were updated from the Companion. | Ihr Projektzugriff hat sich geändert. Verfügbare Aktionen wurden vom Companion aktualisiert. |
| Retry authority | Retry authority check | Autoritätsprüfung wiederholen |

### Lease and candidate states

| State or action | English | German |
|-----------------|---------|--------|
| Acquire | Acquire editing lease | Bearbeitungslease anfordern |
| Acquiring | Requesting exclusive editing lease | Exklusive Bearbeitungslease wird angefordert |
| Active | Editing lease active for this session until {time}. | Bearbeitungslease für diese Sitzung bis {time} aktiv. |
| Held elsewhere | Another session is editing. This project remains read-only here. | Eine andere Sitzung bearbeitet das Projekt. Hier bleibt es schreibgeschützt. |
| Check available | Check lease availability | Lease-Verfügbarkeit prüfen |
| Renew now | Renew now | Jetzt verlängern |
| Renewing | Renewing editing lease | Bearbeitungslease wird verlängert |
| Renewed | Editing lease renewed until {time}. | Bearbeitungslease bis {time} verlängert. |
| Release | Release editing lease | Bearbeitungslease freigeben |
| Expired | Editing lease expired — shared changes cannot be saved. | Bearbeitungslease abgelaufen — gemeinsame Änderungen können nicht gespeichert werden. |
| Lost | Editing lease lost — reacquire and compare before saving. | Bearbeitungslease verloren — vor dem Speichern neu anfordern und vergleichen. |
| Candidate preserved | Candidate preserved — not saved | Kandidat beibehalten — nicht gespeichert |
| Candidate session warning | This candidate is held only in this browser session and may be lost on reload. | Dieser Kandidat wird nur in dieser Browsersitzung gehalten und kann beim Neuladen verloren gehen. |
| Reacquire | Reacquire and compare | Lease neu anfordern und vergleichen |

### Conflict and merge states

| State or action | English | German |
|-----------------|---------|--------|
| Conflict heading | Save blocked — a newer project revision exists | Speichern blockiert — eine neuere Projektrevision ist vorhanden |
| Conflict body | Base revision {base}, current revision {current}, and your unsaved candidate differ. Your candidate is preserved; no shared project data was overwritten. | Basisrevision {base}, aktuelle Revision {current} und Ihr ungespeicherter Kandidat unterscheiden sich. Ihr Kandidat bleibt erhalten; gemeinsame Projektdaten wurden nicht überschrieben. |
| Refresh current | Refresh current project | Aktuelles Projekt laden |
| Preview merge | Preview non-destructive merge | Nicht-destruktive Zusammenführung prüfen |
| Concurrent overlap | Concurrent overlap | Gleichzeitige Überschneidung |
| Keep current | Keep current | Aktuellen Stand beibehalten |
| Use candidate | Use candidate | Kandidaten verwenden |
| Apply merged | Apply merged candidate | Zusammengeführten Kandidaten übernehmen |
| Second conflict | The project changed again. The candidate remains preserved; refresh and preview a new merge. | Das Projekt wurde erneut geändert. Der Kandidat bleibt erhalten; laden Sie neu und prüfen Sie eine neue Zusammenführung. |
| Discard candidate | Discard candidate | Kandidaten verwerfen |
| Keep candidate | Keep candidate | Kandidaten behalten |
| Saved | Candidate saved as revision {revision}. | Kandidat als Revision {revision} gespeichert. |

### Control result states

| State | English | German |
|-------|---------|--------|
| Accepted | Command accepted by Companion | Befehl vom Companion angenommen |
| Dispatched | Command dispatched | Befehl gesendet |
| Confirmed | Command confirmed by readback | Befehl durch Rückmeldung bestätigt |
| Timeout | Command timed out; confirmation was not received. Check the current state before retrying. | Zeitüberschreitung beim Befehl; es wurde keine Bestätigung empfangen. Prüfen Sie vor einem erneuten Versuch den aktuellen Zustand. |
| Denied | Command denied; no service call was dispatched. Review your access or the active safety gate. | Befehl abgelehnt; es wurde kein Dienstaufruf gesendet. Prüfen Sie Ihren Zugriff oder die aktive Sicherheitssperre. |
| Failure before dispatch | Command failed before dispatch; no service call was sent. | Befehl vor dem Senden fehlgeschlagen; es wurde kein Dienstaufruf gesendet. |
| Failure after dispatch | Command dispatch failed or its result is unknown. Check the current state and trusted audit before retrying. | Das Senden des Befehls ist fehlgeschlagen oder das Ergebnis ist unbekannt. Prüfen Sie vor einem erneuten Versuch den aktuellen Zustand und das vertrauenswürdige Auditprotokoll. |
| Cancelled | Command cancelled before dispatch | Befehl vor dem Senden abgebrochen |
| View audit | View trusted audit event | Vertrauenswürdiges Auditereignis anzeigen |

### Audit, telemetry, and access management

| Element | English | German |
|---------|---------|--------|
| Trusted audit heading | Trusted audit | Vertrauenswürdiges Auditprotokoll |
| Trusted source | Server-authored | Serverseitig erstellt |
| Trusted empty | No authorized server audit events are available for this project. | Für dieses Projekt sind keine autorisierten serverseitigen Auditereignisse verfügbar. |
| Telemetry heading | Client telemetry — untrusted | Client-Telemetrie — nicht vertrauenswürdig |
| Telemetry warning | Not security or control evidence | Kein Sicherheits- oder Steuerungsnachweis |
| Telemetry empty | No accepted client telemetry is available. This does not indicate that no security or control events occurred. | Es ist keine akzeptierte Client-Telemetrie verfügbar. Dies bedeutet nicht, dass keine Sicherheits- oder Steuerungsereignisse aufgetreten sind. |
| Next page | Load next 50 events | Nächste 50 Ereignisse laden |
| Retry page | Load events again | Ereignisse erneut laden |
| Add member | Add project member | Projektmitglied hinzufügen |
| Save role | Save project role | Projektrolle speichern |
| Remove member | Remove project member | Projektmitglied entfernen |
| Cancel access | Cancel access change | Zugriffsänderung abbrechen |
| Access conflict | Project access changed before your update. Refresh assignments and review the change again. | Der Projektzugriff wurde vor Ihrer Änderung geändert. Laden Sie die Zuweisungen neu und prüfen Sie die Änderung erneut. |

### Error pattern

Every error uses: **what failed → what remained safe → what the user can do next**.

Example:

- English: `The editing lease expired before revision 18 could be saved. Your candidate remains in this browser session and no shared project data was overwritten. Reacquire the lease and compare with the current revision.`
- German: `Die Bearbeitungslease ist abgelaufen, bevor Revision 18 gespeichert werden konnte. Ihr Kandidat bleibt in dieser Browsersitzung erhalten und gemeinsame Projektdaten wurden nicht überschrieben. Fordern Sie die Lease neu an und vergleichen Sie mit der aktuellen Revision.`

Do not use `Something went wrong`, `Access denied`, `Success`, a raw exception, another user's identity, or an unlocalized stable code as the entire message.

---

## Error and Recovery Matrix

| Failure | Visible response | Allowed recovery | Security/data invariant |
|---------|------------------|------------------|-------------------------|
| Capability load pending | Shared read-only state | Wait/cancel navigation | No mutation visible as enabled |
| Capability stale/rejected | Persistent authority alert | Retry authority check | Immediate read-only; no fallback |
| Role revoked | Own-role change and removed actions | Contact admin/local inspection | Unauthorized rows/actions removed |
| Unauthorized project | Non-enumerating unavailable result | Back to authorized list | No project name/count/details leak |
| Lease held elsewhere | Anonymous other-session state | Check availability | No owner/token/activity leak |
| Lease renewal fails/expires | Candidate-preserved alert | Reacquire and compare | Old token never retried |
| Disconnect/reconnect | Read-only reconnect state | Fresh capability/head/lease | No token resurrection |
| Expected revision conflict | Revision triplet and conflict code | Refresh/merge preview/discard | No overwrite; candidate retained |
| Second merge conflict | Updated current revision | Preview again | No patch replay/last-writer-wins |
| Candidate validation fails | Stable paths and merge operations | Adjust selection/inspect | Apply disabled |
| Membership revision conflict | Stale assignment message | Reload members and retry | No role overwrite |
| Role grant above ceiling | Safe policy denial | Select allowed role | No self/elevated grant |
| Control input invalid/oversized | Field/path/actual-limit error | Correct bounded input | No service dispatch |
| Control denied/gated | Safe reason and no-dispatch state | Review access/gate | No browser service fallback |
| Control timeout | Unknown confirmation state | Check current state/new request | Never claim success/failure of plant state |
| Control failure after dispatch | Dispatch-known/result-unknown detail | Check state/audit | No automatic repeat |
| Trusted audit page fails | Loaded rows marked stale | Load events again | False empty state forbidden |
| Audit capability lost | Rows removed, non-enumerating denial | Return to overview | No retained unauthorized DOM content |
| Telemetry rejected/rate-limited | Untrusted stable rejection | Reduce/stop telemetry | Cannot impersonate audit evidence |

---

## Security and Data Boundaries

These are executable UI contracts:

- Home Assistant connection identity is the only actor identity. Ignore client-supplied user, role, timestamp, capability, ACL, target, audit owner, and project fields not defined by the routed request.
- Capability snapshots drive affordances only. The server re-authorizes every query, command, subscription, list/count, remote proxy, audit read, lease action, and mutation.
- Unauthorized projects and aggregate counts are omitted. Direct access uses the same non-enumerating result for missing and unauthorized projects where required.
- Shared mutation requires exact expected revision and opaque lease token together. Rollback, import, membership, project metadata, and merge apply have no exception.
- Lease tokens stay in memory and are never rendered, persisted, copied, logged, placed in URLs, telemetry, or exported evidence.
- Control UI never accepts editable domain/service/target fields and never calls `hass.callService` as fallback.
- Trusted audit is created only from server workflows with server actor/time. Client telemetry is bounded, untrusted, separately stored and labeled.
- Candidate preservation is in-memory browser state, not a shared save and not localStorage/IndexedDB persistence. It is cleared only after authoritative success or explicit discard.
- No physical bus, remote site, or live plant writes are part of Phase-2 verification. Tests use controlled fake Home Assistant services and assert exact normalized payloads and zero unintended calls.
- `Authorized`, `accepted`, `dispatched`, `confirmed`, `saved`, and `audited` are distinct claims and never substituted for one another.

---

## Acceptance Evidence for the UI

The executor MUST exercise the exact generated card in German and English, dark and light themes, and the declared responsive modes. Screenshots and source-token assertions alone do not pass.

Required behavioral scenarios:

1. Viewer, Operator, Engineer, Admin, and unassigned users receive only server-returned navigation and actions for an authorized project.
2. Unauthorized/missing projects and aggregate counts remain non-enumerating in lists, direct access, badges, search, and audit queries.
3. Admin membership add/change/remove uses the fixed role matrix; self-grant, arbitrary user ID, capability checkbox, above-ceiling grant, and last-admin removal fail closed.
4. Initial capability loading, refresh, role change, expiry, sequence gap, rejection, and incompatible policy version transition immediately to the correct affordance/read-only state.
5. Engineer acquires, renews, and releases an exclusive lease; token never appears in DOM, URL, storage, diagnostics, telemetry, or logs.
6. Dirty lease auto-renew threshold, manual renewal, deterministic expiry, renewal failure, role loss, and disconnect preserve the candidate while blocking save.
7. Reconnect requires fresh capability, project head, and a new lease; the old token is rejected and never retried.
8. Two browser sessions prove one exclusive editor, concurrent reads, anonymous held-elsewhere state, deterministic release/expiry, and no lost update.
9. A stale save shows base/current/candidate evidence, preserves candidate, and offers refresh, merge preview, reacquire/retry, and destructive discard without overwrite.
10. Merge preview covers non-overlap, overlap, dependency lock, invalid candidate, second conflict, successful atomic merge, and candidate clearing only after success.
11. Closing/releasing with a dirty candidate defaults to keeping it and gives an accessible destructive confirmation.
12. Configured control request sends only control ID plus bounded declared input; attempts to override target/service, add unknown keys/templates/nested calls, or exceed bounds cause zero service dispatch.
13. Control UI and trusted audit agree across accepted, dispatched, readback-confirmed, timed-out, denied, cancelled-before-dispatch, and failed-before/after-dispatch states.
14. Timeout/failure never triggers an automatic repeat or optimistic success and directs the user to current state/evidence.
15. Trusted audit and client telemetry render in separate sections, filters, pagination, exports, empty states, labels, and accessible names.
16. Client actor/time/result claims never enter trusted rows; telemetry rate/size rejection cannot create security/control evidence.
17. Audit pagination failure retains loaded rows as stale; capability revocation removes unauthorized rows and focus recovers safely.
18. Companion loss while clean, dirty, acquiring, renewing, merging, managing access, and awaiting control evidence produces read-only/no-fallback behavior.
19. Shared mode never auto-converts to local-only mode; explicit local navigation does not copy the shared candidate automatically.
20. Keyboard-only completion covers capability disclosure, lease lifecycle, access management cancellation, conflict inspection/merge selection, audit pagination, and safe control confirmation cancellation.
21. Focus restoration, authority/lease/conflict live announcements, 200% zoom, 320px reflow, touch targets, reduced motion, forced colors, mobile/tablet/widescreen, and secure kiosk behavior pass.
22. Effect ledgers prove zero unintended `hass.callService`, localStorage/IndexedDB shared persistence, direct target WebSocket fields, network calls, or active asset execution.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — framework-free native Web Components project |
| Third-party registries | none | no third-party registry code permitted in this phase |

---

## Decision Sources

| Source | Decisions applied |
|--------|-------------------|
| `02-CONTEXT.md` | Server-owned identity/roles/capabilities; default deny; exact configured controls; trusted audit separation; revision plus lease; candidate preservation; no privileged fallback |
| `REQUIREMENTS.md` / `ROADMAP.md` | SEC-01, COLLAB-01, multi-user denial, two-session conflicts, read-only Companion loss, German/English, accessibility and exact-artifact evidence |
| Phase-1 UI contract | Existing five tabs, native Web Components, spacing/type/color tokens, dialog geometry, semantic diff, status/copy/error patterns, no plant-write test boundary |
| Authored Project safety UI | `.glt-safe-*` shell, adjacent trigger, tab/focus behavior, metadata-only assets/evidence, Companion call wrapper |
| Exact-dist tests/fake HA | Real Shadow DOM interaction, effect ledger, German shell, keyboard/reflow/forced-colors, revision conflict, no service/localStorage/network fallback |
| Professional accessible defaults | Fixed non-color cues, 44px touch targets, focus recovery, live-region discipline, reduced motion, non-pointer alternatives |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
