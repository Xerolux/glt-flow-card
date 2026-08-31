---
phase: 1
slug: trusted-contract-release-foundation
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-31
sources:
  - .planning/REQUIREMENTS.md
  - .planning/phases/01-trusted-contract-release-foundation/01-CONTEXT.md
  - .planning/research/SUMMARY.md
  - docs/editor/style.css
  - docs/images/designer-dark-live.png
  - docs/images/designer-light-live.png
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for project validation, migration, semantic diff, safe bundle exchange, Companion lifecycle, and release evidence. This phase extends the established GLT designer; it does not redesign the product.

---

## Design Intent

Phase 1 adds a trustworthy engineering workflow to the existing three-column designer. The new UI MUST feel like the current GLT workspace: compact technical controls, dark and light theme parity, cyan/teal selection accents, bordered panels, restrained status chips, and dense evidence tables. It MUST NOT introduce a marketing dashboard, a frontend framework, or a visually unrelated settings application.

The interaction model is **preview before mutation**:

1. Inspect raw input without changing it.
2. Validate and show bounded, actionable findings.
3. Preview sequential migrations and semantic changes.
4. Create and verify a rollback snapshot.
5. Apply through the same validation/revision pipeline.
6. Verify the result or restore the verified backup.

All Phase-1 interfaces MUST visibly state that their scope is project/configuration data. They MUST NOT call Home Assistant plant services, remote actions, physical buses, or equipment controls.

### Locked product language

- Preserve the existing designer shell: palette left, engineering canvas/work area center, inspector right, compact top toolbar.
- Add one top-level entry named **Project safety** / **Projektsicherheit** adjacent to the existing Projects action. Do not add multiple permanent toolbar buttons for validation, migration, diff, and bundles.
- Open Project safety as a centered desktop dialog and a full-screen mobile work surface. Within it, use five tabs in this order: **Overview**, **Validate**, **Migrate & compare**, **Bundles**, **Evidence**.
- Companion setup and options remain native Home Assistant Config Flow/options screens. Do not reproduce Home Assistant settings forms inside the card.
- Lifecycle diagnostics and build/package evidence are read-only. They report facts from the exact running or packaged artifacts; they do not provide setup, unload, service, or plant-control shortcuts.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Existing native Web Components, Shadow DOM, and Home Assistant frontend primitives; no shadcn |
| Preset | Existing GLT Neo 2030 dark and Clean/Operations Light themes |
| Component library | None; reuse existing `.glt-v1-*` and designer patterns, upgraded for accessibility |
| Icon library | Existing inline SVG equipment/symbol vocabulary plus Home Assistant-hosted icons where already available; no new icon dependency |
| Font | `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Code/data font | `ui-monospace, SFMono-Regular, Consolas, monospace` for paths, IDs, versions, hashes, and snippets only |

No `components.json`, Tailwind, React, Vite, or shadcn installation is applicable to this repository. Phase 1 MUST use authored modules under `src/v100/`; generated runtime files are not the design source of truth.

### Shape and elevation

| Element | Contract |
|---------|----------|
| Main work dialog | 16px radius, 1px `line2` border, current card background, maximum 1120px wide and 92vh high |
| Cards and grouped summaries | 10px radius, 1px `line` border, no more than one low-contrast shadow layer |
| Inputs and buttons | 8px radius; do not introduce pill-shaped primary buttons |
| Status chips | Fully rounded, compact, icon + text; never color-only |
| Tables | Flat rows with 1px separators; sticky header only when content scrolls |
| Backdrop | Existing dark translucent backdrop with restrained blur; no backdrop click dismissal during apply/rollback |

---

## Spacing Scale

All new Phase-1 layouts use multiples of 4.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gaps, checkbox-to-text gap |
| sm | 8px | Compact control groups and all dense/table-cell padding, both vertical and horizontal |
| md | 16px | Default panel padding, dialog-header padding, card padding, and field separation |
| lg | 24px | Section separation and desktop dialog gutters |
| xl | 32px | Major workflow separation |
| 2xl | 48px | Empty-state and full-page vertical spacing |
| 3xl | 64px | Reserved for page-level separation; not used inside dense dialogs |

Exceptions:

- Interactive targets are at least 44×44px on touch layouts. A visible compact button may remain 32px high on pointer layouts only if its padded hit area reaches 44px without overlapping neighbors.
- The status dot is 8px, but it is decorative and always paired with icon/text.
- One-pixel borders and two-pixel focus outlines are visual strokes, not layout spacing.

---

## Typography

Exactly four interface sizes and two weights are allowed in new Phase-1 UI. Existing smaller legacy text is not a precedent for these workflows.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label / metadata | 12px | 400 or 700 | 1.4 |
| Body / controls | 14px | 400 or 700 | 1.5 |
| Section heading | 18px | 700 | 1.3 |
| Dialog title / key result | 24px | 700 | 1.2 |

Rules:

- Use weight 700 only for headings, selected tabs, primary values, and the leading phrase of a critical message.
- Paths, schema codes, revisions, hashes, versions, and filenames use the code font at 12px or 14px; never reduce them below 12px.
- Do not use all caps for sentences. Uppercase is limited to 12px short section labels with at least `0.06em` letter spacing.
- Error copy describes the problem first and the recovery action second. Avoid raw exception messages as the only visible explanation.
- Text may wrap to two lines in toolbar-width controls. Never truncate error paths, checksums, or destructive consequences without an adjacent copy/full-view action.

---

## Color

### Dark theme — Neo 2030 default

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#050d16` / canvas `#081522` | App background, dialog backdrop context, main work surface |
| Secondary (30%) | `#0a1826`, `#0e2031`, `#11283d` | Dialogs, cards, table headers, side panels |
| Accent (10%) | `#0aa8ff`, text accent `#36c7ff` | Selected tab, focus ring, primary CTA, active row, links, progress bar |
| Border | `#19334a`, strong `#244b69` | Boundaries and separators |
| Primary text | `#edf6ff` | Main text |
| Muted text | `#8198ad` | Secondary evidence and helper copy |
| Destructive | `#ff4f4f` | Restore/replace consequences and invalid/error state only |

### Light theme — Clean / Operations Light

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#edf3f7` / canvas `#ffffff` | App and work-surface background |
| Secondary (30%) | `#ffffff`, `#f7fafc`, `#eef5f8` | Dialogs, cards, table headers, side panels |
| Accent (10%) | `#087f8c` | Selected tab, focus ring, primary CTA, links, progress bar |
| Border | `#d4e0e8`, strong `#bacfdc` | Boundaries and separators |
| Primary text | `#172233` | Main text |
| Muted text | `#66788b` | Secondary evidence and helper copy |
| Destructive | `#c62828` | Restore/replace consequences and invalid/error state only |

Accent is reserved for: the selected tab, current workflow step, primary CTA, focused control, selected diff row, safe informational link, and active progress indicator. It is not a generic decoration color and MUST NOT encode success.

### Status semantics

| Meaning | Dark / Light color | Required non-color cue | Typical label |
|---------|--------------------|------------------------|---------------|
| Passed / verified / equal | `#31d879` / `#147a43` | Check icon + text | Verified / Verifiziert |
| Information / not run | Accent | Info icon or hollow circle + text | Not run / Nicht ausgeführt |
| In progress | Accent | Spinner/progress bar + live text | Validating 3 of 8 / Validierung 3 von 8 |
| Warning / requires review | `#ff9f1c` / `#9a5a00` | Triangle icon + text | Review required / Prüfung erforderlich |
| Failed / invalid / unequal | `#ff4f4f` / `#c62828` | Cross icon + text | Failed / Fehlgeschlagen |
| Unavailable / unknown | `#8198ad` / `#66788b` | Dashed icon + text | Unavailable / Nicht verfügbar |
| Read-only safety mode | `#67e8f9` / `#0d6a8e` | Lock icon + persistent banner | Read-only / Schreibgeschützt |

Every status badge and table cell MUST contain a label or accessible name. Color, dot position, and animation alone never convey state. In forced-colors mode, preserve borders and icons and use system colors.

---

## Information Architecture

### Project safety entry

The toolbar action shows one of these compact summaries:

- `✓ Project verified` / `✓ Projekt verifiziert`
- `△ Review required` / `△ Prüfung erforderlich`
- `× Project invalid` / `× Projekt ungültig`
- `○ Not checked` / `○ Nicht geprüft`

The summary is derived from the current revision only. Editing the project after validation immediately changes it to `Not checked`; stale green state MUST NOT remain visible.

### Project safety dialog

Desktop layout:

- Header: title, project name, schema version, revision, close button.
- Persistent scope banner below header: `Project data only — no Home Assistant service or plant command is executed.`
- Horizontal tab list with five tabs.
- Main content at least 640px wide.
- Optional 280px summary rail only on widths of 1024px or more; never force horizontal scrolling for the workflow itself.
- Sticky footer for Back, secondary action, and one primary CTA.

Mobile layout below 768px:

- Full viewport with safe-area padding.
- Header and footer stay visible; content scrolls between them.
- Tabs become a horizontally scrollable tab list with visible selected state; do not replace them with unlabeled icons.
- Evidence tables become labeled cards, preserving field names and copy actions.

### Overview tab

Show five summary cards in this order:

1. Raw contract: schema dialect/version and last validation result.
2. Project: project version, current revision, and last verified backup.
3. Companion: connected/capability-compatible/read-only/unavailable.
4. Bundle safety: last import/export result and manifest verification.
5. Release evidence: exact card version and artifact-equality status.

The overview contains no mutation buttons except **Validate project**. Each card links to its detailed tab.

---

## Component Inventory

| Component | Purpose | Required states |
|-----------|---------|-----------------|
| `TrustStatusChip` | Current validation, Companion, or evidence state | not-run, running, passed, warning, failed, unavailable, stale |
| `ScopeSafetyBanner` | Declares project-only/no-plant-write boundary | normal, read-only, Companion-unavailable |
| `ValidationSummary` | Counts errors/warnings and identifies raw input/version | idle, validating, valid, invalid, bounded-limit-rejected, internal-failure |
| `ValidationIssueList` | Actionable code/path/message findings | filtered, expanded, copied, empty, truncated-at-contract-limit |
| `WorkflowStepper` | Inspect → Preview → Backup → Apply → Verify | current, complete, failed, blocked, rolled-back |
| `MigrationPlan` | Sequential from/to migration steps | no-migration, selectable, required, unsupported-gap, blocked |
| `SemanticDiffTree` | Stable-ID grouped semantic changes | added, removed, moved, binding, config, dependency-locked, selected, ignored-noise |
| `BeforeAfterInspector` | Field-level values and impact | unchanged context, changed, redacted, binary/asset metadata |
| `RevisionGuard` | Shows expected/current revision | equal, conflict, recheck-required |
| `BackupReceipt` | Snapshot ID, checksum, created time, verification | creating, verified, failed, restored |
| `BundleDropzone` | File picker/drop target | empty, keyboard-focused, scanning, accepted, rejected, wrong type |
| `BundleManifestSummary` | Entry count, sizes, schema, assets, hashes | complete, mismatch, unsupported, redacted |
| `LifecycleEvidencePanel` | Companion setup/options/reload/unload cleanup facts | connected, incompatible, partially-clean, clean, unavailable |
| `ArtifactEvidenceTable` | Source→artifact hash/equality and test lanes | verified, unequal, missing, not-run, stale |
| `ProgressRegion` | Long validation/import/migration work | determinate, indeterminate, failed, complete, cancelled-before-mutation |
| `ConfirmMutationDialog` | Replace project or restore snapshot | awaiting-name, mismatch, ready, submitting, failure |
| `InlineCallout` | Contextual warning/error/recovery | info, warning, error, success |

All components use native buttons, inputs, checkboxes, tabs, tables, details/disclosure, and `<dialog>` semantics. A visual `<div>` is not an interactive control.

---

## Validation Contract

### Default view

Before a check, show:

- Heading: **Validate raw project** / **Rohprojekt validieren**
- Body: validation occurs before defaults, normalization, or migration.
- Metadata: input source, byte size, detected project/schema version, and current revision.
- Primary CTA: **Validate project** / **Projekt validieren**

### Running state

- Disable only actions that would replace or apply the inspected input; navigation and **Cancel validation** / **Validierung abbrechen** remain available until persistence begins.
- Announce `Validating raw project` / `Rohprojekt wird validiert` once, then the exact bilingual bounded milestone strings defined in the Copywriting Contract.
- Use determinate progress only when total work is known. Otherwise use an indeterminate bar with textual stage.
- Do not show success before frontend/Companion parity checks required for that operation have completed.

### Result summary

The result header shows a large icon, result text, and counts. Under it show:

- Validated input checksum.
- Schema dialect and schema version.
- Runtime(s) used: browser, Companion, or both.
- Timestamp formatted in the active locale plus machine-readable UTC in the details disclosure.
- `Original unchanged` / `Original unverändert` confirmation.

The issue list columns are **Severity**, **Code**, **Path**, **Message**, **Suggested action**. It supports severity/code filtering, expand/collapse, copy path, and copy all as JSON. Stable codes and JSON-pointer-like paths are always shown; validator stack traces are hidden behind a developer-only details disclosure and never replace localized messages.

When bounds are exceeded, stop at the boundary and show the rejected limit category and actual/allowed values without attempting normalization or partial rendering. Examples: file bytes, nesting depth, string length, collection count, archive entry count, decompressed bytes, and path length.

### Empty and error states

- Valid with no issues: `No validation issues found. The raw project matches schema {version}.`
- Nothing loaded: `Open a project or choose a .gltproject file to validate.`
- Parity disagreement: hard failure; show browser and Companion result codes side-by-side and disable Apply/Import.
- Internal validator failure: distinguish from invalid project. Preserve original input, offer **Download validation diagnostic** / **Validierungsdiagnose herunterladen** and **Try validation again** / **Validierung erneut starten**, and never label the project invalid solely because the tool failed.

---

## Migration and Semantic Diff Contract

### Migration stepper

The stepper has these fixed steps:

1. **Inspect** — validate raw input and identify migration path.
2. **Preview** — run all pure copy-on-write migration steps and produce semantic diff.
3. **Backup** — create and verify rollback snapshot for the expected revision.
4. **Apply** — persist the selected valid result atomically.
5. **Verify** — validate persisted result, reference integrity, custom assets, revision, and checksum.

The initial primary CTA is **Run dry run** / **Probelauf starten**. Dry run MUST NOT create a new project revision, write Companion stores, extract files into a live location, or change the editor draft. A persistent `Dry run — original unchanged` banner remains until Apply begins.

### Migration plan

List every sequential step as `{from_version} → {to_version}` with:

- step ID and localized name;
- required/optional designation;
- affected object count;
- warnings and compatibility notes;
- custom-asset preservation result;
- completion/failure state.

Required steps cannot be deselected. Optional transformations may be deselected only if the resulting document still validates and all references remain valid. An unsupported version gap blocks the workflow and offers export of the diagnostic, not a forced skip.

### Semantic diff

Group changes by stable semantic ID, not raw array position. The top summary uses exactly these categories:

- Added / Hinzugefügt
- Removed / Entfernt
- Moved / Verschoben
- Binding changed / Bindung geändert
- Configuration changed / Konfiguration geändert

Ordering-only changes are hidden by default under `Ignored ordering noise` / `Ignorierte Reihenfolgeänderungen`. They never increase the main change count.

Each diff row includes checkbox, category icon/text, object name, stable ID, semantic path, one-line impact, and expand control. Expanded content shows before/after values in two columns at desktop and stacked blocks on mobile. Long JSON values wrap and can be copied; secrets and credentials are never shown.

Selective apply rules:

- Selection starts with all valid changes selected.
- If deselecting a change would break a reference or required migration, the dependent checkbox becomes locked and explains why.
- Selection changes trigger immediate revalidation of the candidate copy and update counts.
- Primary CTA reads **Apply {n} changes** / **{n} Änderungen übernehmen**.
- Apply remains disabled until expected revision matches, backup verification succeeds, candidate validation passes, and no archive-safety finding remains.

### Revision conflict

When expected revision differs from current revision, do not overwrite. Replace the footer CTA with **Reload and compare again** / **Neu laden und erneut vergleichen**. Preserve the dry-run selection locally for review, but require a fresh preview against the current revision before Apply can re-enable.

### Apply, failure, and rollback

During Apply, the dialog cannot be dismissed with backdrop click or Escape. Show the precise stage and `Do not close Home Assistant while project changes are being applied.` / `Schließen Sie Home Assistant nicht, während Projektänderungen übernommen werden.` helper text. The server operation remains atomic; the UI does not simulate success from a browser-only state change.

Success shows:

- new revision;
- applied step IDs and change count;
- original and result checksums;
- verified backup ID/checksum;
- custom asset count/checksum result;
- **Close migration receipt** / **Migrationsnachweis schließen** and **View migration evidence** / **Migrationsnachweise anzeigen** actions.

If Apply fails before persistence, use the exact bilingual **Failure before persistence** copy below. If it fails after a persistence boundary, show the exact automatic-restore progress strings and only use the **Verified backup restored** success copy after checksum verification. If restore verification fails, present the exact bilingual blocking rollback-failure view with both snapshot IDs, **Download rollback diagnostic** / **Rollback-Diagnose herunterladen**, and no further Apply action.

Rollback is available from a successful migration receipt. It opens destructive confirmation, previews reverse semantic impact, checks expected revision again, restores only from a verified snapshot, creates a new audit/evidence receipt, and validates the restored project before reporting success.

---

## Safe Bundle Import and Export

### Import

The Bundles tab starts with a native file input and keyboard-operable dropzone. Accepted extension is `.gltproject`; MIME type alone is never trusted.

Import stages are:

1. Read bounded bytes.
2. Inspect archive structure without extracting into a live project location.
3. Verify manifest, entry names, duplicates, compression/encryption policy, declared sizes, hashes, schema version, and project/manifest match.
4. Validate project and custom-asset references.
5. Preview migration and semantic diff.
6. Confirm replace/merge action through the same revision and backup pipeline.

The preflight summary shows filename, compressed size, declared/uncompressed size, entry count, project/schema version, asset count/size, manifest version, checksum status, and any rejected rule. Absolute paths, traversal, duplicate logical entries, unsupported encryption/compression, missing/mismatched manifest, excessive counts/sizes/depth, and unsafe entry names are hard failures. On rejection, no entry is extracted and the current project is unchanged.

Never render imported SVG/HTML/script content during preflight. Asset previews in Phase 1 are metadata only: filename, safe media type, byte size, dimensions when safely decoded, and checksum.

After preflight, use **Compare with current project** / **Mit aktuellem Projekt vergleichen**. There is no one-click import that bypasses validation, migration, diff, expected revision, or backup.

### Export

The export summary shows:

- project/schema version and revision;
- included project object count and custom asset count;
- manifest version;
- source/result checksum;
- explicit `No credentials or Home Assistant secrets included` statement;
- estimated archive size and configured bounds.

Primary CTA: **Export verified bundle** / **Verifiziertes Paket exportieren**. Export remains disabled if the current revision is unvalidated or has blocking reference errors. The filename pattern is `{project-slug}-r{revision}.gltproject`.

After export, show a receipt with filename, bytes, SHA-256, manifest version, and **Copy bundle checksum** / **Paket-Prüfsumme kopieren**. Browser download completion is described as `Bundle created` / `Paket erstellt`; do not claim that the user saved or retained the file.

---

## Companion Setup, Options, and Lifecycle Diagnostics

### Native Home Assistant setup

Use Home Assistant's Config Flow shell, field rendering, navigation, and error placement. The user-facing content is:

| Element | English | German |
|---------|---------|--------|
| Title | GLT Flow Card Companion | GLT Flow Card Companion |
| Description | Adds server-managed project storage, validation, migration, and lifecycle services. No plant command is executed during setup. | Fügt serververwaltete Projektspeicherung, Validierung, Migration und Lifecycle-Dienste hinzu. Während der Einrichtung wird kein Anlagenbefehl ausgeführt. |
| Primary CTA | Set up Companion | Companion einrichten |
| Already configured | GLT Flow Card Companion is already configured. Open its options to review active settings. | GLT Flow Card Companion ist bereits eingerichtet. Öffnen Sie die Optionen, um aktive Einstellungen zu prüfen. |
| Setup failure | Companion setup did not complete. No project data was changed. Review the diagnostic and try again. | Die Companion-Einrichtung wurde nicht abgeschlossen. Projektdaten wurden nicht geändert. Prüfen Sie die Diagnose und versuchen Sie es erneut. |

### Options

The options form displays only options that have an executable runtime effect in the shipped Companion. An option without implemented behavior MUST be removed rather than shown disabled or documented aspirationally.

Each option row contains:

- localized label and one-sentence effect;
- current value and bounded allowed range;
- activation behavior: `Applies immediately` or `Reload required`;
- validation error adjacent to the field;
- no security promise based solely on browser state.

The form action is **Save Companion options** / **Companion-Optionen speichern**. After that action, show which values became effective and whether Home Assistant completed a safe reload. Do not show success if the running manager still reports old values. If reload fails, preserve the prior effective configuration, show the failed field/effect, and offer **Retry Companion reload** / **Companion-Neuladen erneut versuchen** through Home Assistant's normal retry path.

Existing options such as server enforcement, lock TTL, version retention, or audit retention may appear only when their manager behavior is wired and tested in the current phase. Phase-2 security/lease settings MUST NOT be presented as authoritative Phase-1 protection before that implementation exists.

### Read-only lifecycle diagnostics

The Evidence tab includes a **Companion lifecycle** section. It is explicitly read-only and contains:

- configured/running state and Config Entry ID;
- Companion version, API/capability version, schema version;
- supported and actual Home Assistant version lane;
- active effective options, with secrets omitted;
- store repositories and versions, migration/rollback status, record counts, and checksums where safe;
- tracked listener, task, WebSocket registration, and manager-resource counts;
- last setup/reload/unload/re-setup evidence result;
- compatibility state between running card and Companion.

Clean unload evidence shows each tracked resource category as zero and manager state removed. A global green `Clean` / `Bereinigt` status is allowed only when all categories pass. `Unload returned success` / `Entladen als erfolgreich gemeldet` without zero-resource evidence is a failure, not a warning.

If Companion is unavailable:

- show a persistent lock banner: `Companion unavailable — shared project operations are read-only.`;
- keep local standalone validation/dry-run/export available where safe;
- disable shared Apply/import persistence and any authoritative lifecycle claim;
- never fall back to a direct Home Assistant service call.

Version/capability mismatch shows both versions, the missing capability code, and a specific upgrade path. Do not collapse mismatch into generic `Connection failed`.

---

## Build and Package Evidence View

The Evidence tab contains a **Release build** section intended for administrators, maintainers, and engineering diagnostics. It reports the exact loaded/packaged bytes; it does not run a build in the browser.

### Build identity card

Show:

- card/product version;
- schema version;
- source commit (short visible, full copyable);
- build timestamp only when reproducibility policy permits it;
- Node/esbuild/tool versions;
- build manifest version;
- canonical output SHA-256.

### Artifact equality table

Rows are canonical output, `dist/glt-flow-card.js`, Companion `www/glt-flow-card.js`, and standalone/editor copy where applicable. Columns are artifact, bytes, SHA-256, manifest identity, equality result, and evidence timestamp/source.

- All equal: green check and `Byte-identical` / `Byte-identisch`.
- Missing: gray unavailable, `Artifact missing` / `Artefakt fehlt`, and a specific path/artifact label.
- Unequal: red cross, expected/actual hash, and `Release blocked` / `Release blockiert`.
- Not measured: hollow circle and `Not verified` / `Nicht verifiziert`; never green.
- Evidence from a different source commit or artifact version is `Evidence stale` / `Nachweis veraltet` and cannot satisfy release readiness.

### Package/install evidence

Show separate cards for **Dashboard artifact** and **Companion integration**; never imply they are the same HACS category. Each card includes package filename/category, manifest/version, checksum, clean-install result, historical upgrade result, reload, unload cleanup, and re-setup result for minimum/current HA lanes.

The overall status may read **Release evidence complete** only when exact produced artifacts pass every required lane and equality gate. Otherwise use **Release evidence incomplete** and list missing gates. Source-token tests and documentation claims are labeled non-authoritative evidence.

Provide **Copy release evidence JSON** / **Release-Nachweise als JSON kopieren** and **Download release evidence JSON** / **Release-Nachweise als JSON herunterladen**. Evidence export contains versions, hashes, status codes, and timestamps but no Home Assistant tokens, secret option values, user identifiers, project payloads, or plant state.

---

## Dialog and Confirmation Contract

### General dialog behavior

- Use native `<dialog>` where the host supports it, with explicit title association and `aria-modal="true"` behavior.
- Initial focus goes to the dialog heading for a read-only result, the first invalid field for an error, or the first safe input for a form. It never lands on a destructive button.
- Tab and Shift+Tab remain within an open modal. Escape closes preview/read-only dialogs and returns focus to the trigger.
- During Apply, verified Restore, or final Replace, Escape/backdrop dismissal is disabled and the status is announced.
- The Project safety close button has the accessible name **Close Project safety** / **Projektsicherheit schließen**, not only `✕`. Receipt dialogs use their task-specific close labels from the Copywriting Contract.
- Nested browser prompts/alerts are forbidden. Use owned dialogs and inline validation.

### Destructive confirmation

Replacing the current project and restoring a backup are destructive to the current working revision. Confirmation shows:

1. exact action and affected project;
2. current revision and target revision/snapshot;
3. semantic change counts;
4. backup/checksum status;
5. consequence: current working revision will be replaced;
6. no-plant-write statement;
7. an input requiring the exact current project name.

The primary button remains disabled until the project name matches. Button labels are **Replace project** / **Projekt ersetzen** and **Restore verified backup** / **Verifiziertes Backup wiederherstellen**. The initially focused action is **Cancel project replacement** / **Projektersetzung abbrechen** in the replace dialog and **Cancel backup restore** / **Backup-Wiederherstellung abbrechen** in the restore dialog. Red is used only for these final mutation actions, never for ordinary migration Apply.

### Principal-state focal hierarchy

Each dialog state has exactly one dominant focal point; secondary content MUST remain visually subordinate.

| Principal state | Single focal point | Secondary hierarchy |
|-----------------|--------------------|---------------------|
| Default / idle | Workflow heading and its adjacent primary task CTA as one action group | Scope banner, input metadata, then optional guidance/details |
| Running | `ProgressRegion` stage heading and progress indicator as one status group | Task-specific cancellation action, immutable input summary, then elapsed/detail disclosure |
| Result / success | Result receipt heading with status icon and verified revision/checksum | Evidence facts, task-specific close action, then evidence export/view actions |
| Error / rollback | Blocking error or rollback-status heading with alert icon | Safety invariant, exact failed stage, recovery CTA, diagnostic/evidence actions, then technical details |

Default and running states use accent only on their focal group. A successful result uses semantic success color for the result status while keeping close/evidence actions secondary. An error or rollback state uses destructive color only on the blocking status and destructive final confirmation; recovery actions retain normal button styling.

---

## Responsive Behavior

| Width | Contract |
|-------|----------|
| ≥1280px | Existing three-column designer remains. Project safety dialog up to 1120px; diff supports list + before/after inspector. |
| 1024–1279px | Dialog uses content + 280px summary rail; existing designer may collapse inspector per current pattern. |
| 768–1023px | Single main dialog column; summary becomes top cards; diff before/after opens inline below row. |
| <768px | Full-screen work surface; sticky header/footer; tabs scroll horizontally; tables become labeled cards; no horizontal page scroll. |
| 200% zoom / 320 CSS px | One-column reflow, complete labels, reachable actions, no clipped confirmation or evidence values. |

At mobile widths, do not hide safety state, validation codes, errors, revision conflict, backup status, or primary/task-specific cancellation actions. Optional descriptive columns may move into row details but remain accessible.

---

## Keyboard, Focus, and Assistive Technology

### Keyboard map

| Context | Keys |
|---------|------|
| Tab list | Left/Right changes focused tab; Home/End first/last; Enter/Space activates if manual activation is used |
| Issue/diff list | Up/Down moves row focus; Left/Right collapses/expands; Space toggles selectable change; Enter opens details |
| Buttons/checkboxes/disclosures | Native Enter/Space behavior |
| Dialog | Escape closes only when no protected mutation is active |
| File dropzone | Enter/Space opens native file picker |
| Copy action | Enter/Space copies and announces the exact task-specific bilingual copied confirmation from the Copywriting Contract without moving focus |

No keyboard shortcut directly executes Apply, Replace, or Restore. Drag-and-drop is optional convenience; every bundle action has a file-picker alternative.

### Focus

- Every interactive element uses a 2px accent outline with 2px offset. Focus indicators remain visible against both themes and are not clipped by overflow containers.
- On validation failure, focus moves to the result heading; an explicit **Go to first issue** action moves to the first issue row.
- On form submission failure, focus moves to the error summary, which links to invalid controls.
- When a diff row is removed by filtering or selection dependency, focus moves to the nearest remaining row and the change is announced.
- Closing any dialog restores focus to the exact invoking control.

### Announcements

- Use `role="status"` for progress milestones, copied confirmations, and successful completion.
- Use `role="alert"` for blocking validation, revision, archive, apply, or rollback failures.
- Do not announce every progress percentage. Announce stage changes and completion.
- Result icons are decorative when adjacent text provides the name.
- Validation and diff tables have captions and correctly associated headers.

Respect `prefers-reduced-motion`: replace spinners with a static progress indicator plus text when necessary, remove glow/pulse, and use no animated flow imagery in these tools.

---

## Copywriting Contract

### Core actions and states

| Element | English | German |
|---------|---------|--------|
| Toolbar entry | Project safety | Projektsicherheit |
| Primary validation CTA | Validate project | Projekt validieren |
| Dry-run CTA | Run dry run | Probelauf starten |
| Apply CTA | Apply {count} changes | {count} Änderungen übernehmen |
| Bundle import CTA | Compare with current project | Mit aktuellem Projekt vergleichen |
| Bundle export CTA | Export verified bundle | Verifiziertes Paket exportieren |
| Release evidence CTA | View release evidence | Release-Nachweise anzeigen |
| Empty validation heading | No project loaded | Kein Projekt geladen |
| Empty validation body | Open a project or choose a .gltproject file to validate. | Öffnen Sie ein Projekt oder wählen Sie eine .gltproject-Datei zur Validierung aus. |
| Valid result | No validation issues found. The raw project matches schema {version}. | Keine Validierungsprobleme gefunden. Das Rohprojekt entspricht Schema {version}. |
| Invalid result | The project is invalid. Review the listed paths; the original remains unchanged. | Das Projekt ist ungültig. Prüfen Sie die aufgeführten Pfade; das Original bleibt unverändert. |
| Revision conflict | Revision {expected} is no longer current; revision {actual} is active. Reload and compare again. | Revision {expected} ist nicht mehr aktuell; Revision {actual} ist aktiv. Laden Sie neu und vergleichen Sie erneut. |
| Companion unavailable | Companion unavailable — shared project operations are read-only. | Companion nicht verfügbar — gemeinsame Projektaktionen sind schreibgeschützt. |
| Safety scope | Project data only — no Home Assistant service or plant command is executed. | Nur Projektdaten — es wird kein Home-Assistant-Dienst und kein Anlagenbefehl ausgeführt. |
| Release incomplete | Release evidence is incomplete. Missing or stale gates are listed below. | Die Release-Nachweise sind unvollständig. Fehlende oder veraltete Prüfungen sind unten aufgeführt. |

### Exact validation state copy

| State or action | English | German |
|-----------------|---------|--------|
| Running heading | Validating raw project | Rohprojekt wird validiert |
| Progress 1 of 4 | Checking schema (1 of 4) | Schema wird geprüft (1 von 4) |
| Progress 2 of 4 | Checking references (2 of 4) | Referenzen werden geprüft (2 von 4) |
| Progress 3 of 4 | Checking archive manifest (3 of 4) | Archivmanifest wird geprüft (3 von 4) |
| Progress 4 of 4 | Comparing browser and Companion results (4 of 4) | Browser- und Companion-Ergebnisse werden verglichen (4 von 4) |
| Cancel running validation | Cancel validation | Validierung abbrechen |
| Success heading | Project validation complete | Projektvalidierung abgeschlossen |
| Failure heading | Project validation failed | Projektvalidierung fehlgeschlagen |
| Failure body | Validation could not be completed. The original project is unchanged. Review the diagnostic and try validation again. | Die Validierung konnte nicht abgeschlossen werden. Das Originalprojekt ist unverändert. Prüfen Sie die Diagnose und starten Sie die Validierung erneut. |
| Disabled reason | Validate project unavailable — open a project or choose a .gltproject file. | Projektvalidierung nicht verfügbar — öffnen Sie ein Projekt oder wählen Sie eine .gltproject-Datei aus. |
| Recovery action | Try validation again | Validierung erneut starten |
| Evidence action | View validation evidence | Validierungsnachweise anzeigen |
| Diagnostic action | Download validation diagnostic | Validierungsdiagnose herunterladen |
| Completion confirmation | Original project unchanged | Originalprojekt unverändert |
| Close result | Close validation result | Validierungsergebnis schließen |

### Exact apply state copy

| State or action | English | German |
|-----------------|---------|--------|
| Confirmation heading | Confirm project changes | Projektänderungen bestätigen |
| Confirmation body | Apply {count} validated changes to “{project}” at revision {revision}? A verified backup will be created first. This changes project data only and sends no plant command. | {count} validierte Änderungen auf „{project}“ in Revision {revision} übernehmen? Zuerst wird ein verifiziertes Backup erstellt. Dies ändert nur Projektdaten und sendet keinen Anlagenbefehl. |
| Cancel confirmation | Cancel project changes | Projektänderungen abbrechen |
| Running heading | Applying {count} project changes | {count} Projektänderungen werden übernommen |
| Progress 1 of 4 | Creating and verifying backup (1 of 4) | Backup wird erstellt und verifiziert (1 von 4) |
| Progress 2 of 4 | Applying validated changes (2 of 4) | Validierte Änderungen werden übernommen (2 von 4) |
| Progress 3 of 4 | Validating saved revision (3 of 4) | Gespeicherte Revision wird validiert (3 von 4) |
| Progress 4 of 4 | Verifying revision and checksums (4 of 4) | Revision und Prüfsummen werden verifiziert (4 von 4) |
| Success heading | Project changes applied | Projektänderungen übernommen |
| Success body | Revision {revision} was validated and verified after applying {count} changes. Verified backup {backup_id} remains available. | Revision {revision} wurde nach dem Übernehmen von {count} Änderungen validiert und verifiziert. Das verifizierte Backup {backup_id} bleibt verfügbar. |
| Failure before persistence | Project changes were not applied. Nothing was changed. Review the diagnostic and run a fresh dry run. | Projektänderungen wurden nicht übernommen. Es wurde nichts geändert. Prüfen Sie die Diagnose und starten Sie einen neuen Probelauf. |
| Failure after persistence | Applying project changes failed. Automatic backup restore is starting; do not close Home Assistant. | Das Übernehmen der Projektänderungen ist fehlgeschlagen. Die automatische Backup-Wiederherstellung wird gestartet; schließen Sie Home Assistant nicht. |
| Disabled — revision | Apply changes unavailable — the project revision changed. Reload and compare again. | Änderungen können nicht übernommen werden — die Projektrevision hat sich geändert. Laden Sie neu und vergleichen Sie erneut. |
| Disabled — backup | Apply changes unavailable — a verified backup has not been created. | Änderungen können nicht übernommen werden — es wurde kein verifiziertes Backup erstellt. |
| Disabled — validation | Apply changes unavailable — the selected project changes did not pass validation. | Änderungen können nicht übernommen werden — die ausgewählten Projektänderungen haben die Validierung nicht bestanden. |
| Disabled — archive safety | Apply changes unavailable — resolve the listed archive safety finding first. | Änderungen können nicht übernommen werden — beheben Sie zuerst den aufgeführten Archiv-Sicherheitsbefund. |
| Recovery action | Run fresh dry run | Neuen Probelauf starten |
| Evidence action | View migration evidence | Migrationsnachweise anzeigen |
| Close result | Close migration receipt | Migrationsnachweis schließen |

### Exact rollback state copy

| State or action | English | German |
|-----------------|---------|--------|
| Confirmation heading | Restore verified project backup | Verifiziertes Projekt-Backup wiederherstellen |
| Cancel confirmation | Cancel backup restore | Backup-Wiederherstellung abbrechen |
| Running heading | Restoring verified backup | Verifiziertes Backup wird wiederhergestellt |
| Progress 1 of 3 | Checking revision and backup checksum (1 of 3) | Revision und Backup-Prüfsumme werden geprüft (1 von 3) |
| Progress 2 of 3 | Restoring project revision (2 of 3) | Projektrevision wird wiederhergestellt (2 von 3) |
| Progress 3 of 3 | Validating restored project (3 of 3) | Wiederhergestelltes Projekt wird validiert (3 von 3) |
| Success heading | Verified backup restored | Verifiziertes Backup wiederhergestellt |
| Success body | Project revision {revision} matches verified backup {backup_id}. A rollback evidence receipt was created. | Projektrevision {revision} entspricht dem verifizierten Backup {backup_id}. Ein Rollback-Nachweis wurde erstellt. |
| Failure heading | Backup restore verification failed | Verifizierung der Backup-Wiederherstellung fehlgeschlagen |
| Failure body | The restored revision could not be verified. Both snapshots were retained. Download the rollback diagnostic and request administrator recovery. | Die wiederhergestellte Revision konnte nicht verifiziert werden. Beide Snapshots wurden beibehalten. Laden Sie die Rollback-Diagnose herunter und fordern Sie eine Wiederherstellung durch die Administration an. |
| Disabled reason | Restore backup unavailable — the snapshot or current revision is not verified. | Backup-Wiederherstellung nicht verfügbar — der Snapshot oder die aktuelle Revision ist nicht verifiziert. |
| Recovery action | Request administrator recovery | Wiederherstellung durch Administration anfordern |
| Evidence action | View rollback evidence | Rollback-Nachweise anzeigen |
| Diagnostic action | Download rollback diagnostic | Rollback-Diagnose herunterladen |
| Close result | Close rollback receipt | Rollback-Nachweis schließen |

### Companion options, evidence, and destructive confirmation actions

| State or action | English | German |
|-----------------|---------|--------|
| Save options | Save Companion options | Companion-Optionen speichern |
| Options reload recovery | Retry Companion reload | Companion-Neuladen erneut versuchen |
| Replace confirmation cancel | Cancel project replacement | Projektersetzung abbrechen |
| Restore confirmation cancel | Cancel backup restore | Backup-Wiederherstellung abbrechen |
| Project safety close | Close Project safety | Projektsicherheit schließen |
| Release evidence copy | Copy release evidence JSON | Release-Nachweise als JSON kopieren |
| Release evidence download | Download release evidence JSON | Release-Nachweise als JSON herunterladen |
| Migration receipt close | Close migration receipt | Migrationsnachweis schließen |
| Rollback receipt close | Close rollback receipt | Rollback-Nachweis schließen |
| Bundle checksum copy | Copy bundle checksum | Paket-Prüfsumme kopieren |
| Bundle checksum copied | Bundle checksum copied | Paket-Prüfsumme kopiert |
| Validation path copied | Validation path copied | Validierungspfad kopiert |
| Release evidence copied | Release evidence JSON copied | Release-Nachweise als JSON kopiert |

### Exact evidence status copy

| State | English | German |
|-------|---------|--------|
| Complete | Release evidence complete | Release-Nachweise vollständig |
| Incomplete | Release evidence incomplete | Release-Nachweise unvollständig |
| Equal | Byte-identical | Byte-identisch |
| Missing | Artifact missing | Artefakt fehlt |
| Unequal | Release blocked | Release blockiert |
| Not measured | Not verified | Nicht verifiziert |
| Stale | Evidence stale | Nachweis veraltet |
| Lifecycle clean | Companion resources cleaned up | Companion-Ressourcen bereinigt |
| Lifecycle failure | Companion cleanup incomplete | Companion-Bereinigung unvollständig |

### Exact destructive confirmation states

| State or action | English | German |
|-----------------|---------|--------|
| Awaiting project name — replace | Enter “{project}” to enable Replace project. | Geben Sie „{project}“ ein, um „Projekt ersetzen“ zu aktivieren. |
| Awaiting project name — restore | Enter “{project}” to enable Restore verified backup. | Geben Sie „{project}“ ein, um „Verifiziertes Backup wiederherstellen“ zu aktivieren. |
| Project name mismatch | The project name does not match. The project remains unchanged. | Der Projektname stimmt nicht überein. Das Projekt bleibt unverändert. |
| Ready | Project name confirmed. Review the revision and backup before continuing. | Projektname bestätigt. Prüfen Sie vor dem Fortfahren die Revision und das Backup. |
| Replacing | Replacing project revision | Projektrevision wird ersetzt |
| Restore submitting | Restoring verified backup | Verifiziertes Backup wird wiederhergestellt |
| Revision changed | Confirmation expired because the project revision changed. Reload and compare again. | Die Bestätigung ist abgelaufen, weil sich die Projektrevision geändert hat. Laden Sie neu und vergleichen Sie erneut. |

### Error pattern

Every error follows: **what failed → what remained safe → what the user can do next**.

Example:

- English: `Bundle inspection failed because entry "../config" uses an unsafe path. No files were extracted and the current project is unchanged. Choose a different bundle or download the diagnostic.`
- German: `Die Paketprüfung ist fehlgeschlagen, weil der Eintrag „../config“ einen unsicheren Pfad verwendet. Es wurden keine Dateien entpackt und das aktuelle Projekt blieb unverändert. Wählen Sie ein anderes Paket oder laden Sie die Diagnose herunter.`

Do not use `Something went wrong`, `Invalid input`, `Success`, or raw exception strings without the affected object and recovery path.

### Destructive confirmation copy

**Restore backup / Backup wiederherstellen**

- English: `Restore verified backup {backup_id} for “{project}”? The current revision {revision} will be replaced. A new evidence receipt will be created. This changes project data only and sends no plant command.`
- German: `Verifiziertes Backup {backup_id} für „{project}“ wiederherstellen? Die aktuelle Revision {revision} wird ersetzt. Ein neuer Nachweis wird erstellt. Dies ändert nur Projektdaten und sendet keinen Anlagenbefehl.`
- Input label: `Enter the project name to confirm` / `Projektname zur Bestätigung eingeben`
- Primary action: `Restore verified backup` / `Verifiziertes Backup wiederherstellen`

---

## Error and Recovery Matrix

| Failure | Visible response | Allowed recovery | Safety invariant |
|---------|------------------|------------------|------------------|
| Raw schema invalid | Grouped stable errors with paths | Fix source, copy errors, retry | No normalization or persistence |
| Validation bound exceeded | Actual vs allowed boundary | Choose smaller/safer input | Stop processing at boundary |
| Browser/Companion parity mismatch | Side-by-side codes and hard failure | Download diagnostic, retry after upgrade | Apply/import disabled |
| No migration path | Unsupported from/to versions | Export diagnostic, use supported intermediary tooling | No step skipping |
| Expected revision conflict | Expected/current revision callout | Reload and compare again | No overwrite |
| Backup creation/verification failure | Blocking Backup step failure | Retry backup or cancel | Apply disabled |
| Migration apply failure | Exact failed step and restore state | Retry only after verified restore/fresh dry run | Original retained or checksum-restored |
| Rollback verification failure | Blocking red receipt with IDs/checksums | Download diagnostic, administrator recovery | No success claim, both snapshots retained |
| Unsafe archive entry | Rule, entry name, actual/allowed value | Choose another bundle | No extraction, current project unchanged |
| Manifest/project mismatch | Expected/actual manifest facts | Re-export from trusted source | No import candidate created |
| Companion unavailable | Persistent read-only banner | Reconnect, local dry-run/export | No shared mutation or direct-service fallback |
| Capability mismatch | Card/Companion versions and missing capability | Upgrade indicated artifact | No degraded authoritative claim |
| Options reload failure | Prior/effective values and failed reload | Retry through HA | Prior effective config retained |
| Artifact inequality | Expected/actual hash and release block | Rebuild from canonical source | No release-ready status |
| Evidence stale/not run | Gray status with source commit/time | Run required external gate | Never treated as pass |

---

## Live-Plant and Data Safety Boundaries

These are hard UI and interaction rules, not advisory copy:

- Phase 1 actions may read project files, validate, create candidate copies, create/restore project backups, update Companion project stores/options, and export evidence.
- They MUST NOT call `hass.callService` for equipment, controls, scripts, scenes, automations, remote sites, or fieldbus-facing entities.
- They MUST NOT present a control target, service selector, or `Run service` action.
- Lifecycle tests use isolated Home Assistant test instances/fixtures. A live Home Assistant UI may display previously produced evidence, but it does not initiate plant writes.
- Shared project persistence is disabled when Companion authority is unavailable or incompatible. Standalone local validation, dry-run, comparison, and export remain explicitly local.
- Import preflight does not execute scripts, render active HTML/SVG, resolve remote URLs, or extract before full archive acceptance.
- Credentials, tokens, secret option values, and plant state are excluded from bundles, diagnostics, hashes displayed to ordinary users, and evidence exports unless a separate explicit secure contract says otherwise.
- Success text names exactly what was verified. `Bundle created`, `Project revision verified`, and `Resources cleaned up` are acceptable; `System safe` or `Plant safe` is not.

---

## Acceptance Evidence for the UI

The executor MUST provide browser behavior evidence for the exact generated card in both German and English and both dark and light themes.

Required scenarios:

1. Valid raw project with no changes.
2. Invalid and boundary-rejected project with actionable path errors.
3. Historical project dry-run through multiple sequential steps; source checksum remains unchanged.
4. Semantic diff with add/remove/move/binding/config changes and ignored ordering noise.
5. Selective apply with dependency-locked changes and successful verified backup.
6. Revision conflict and fresh compare path.
7. Injected migration failure with verified automatic restore.
8. Verified backup restore through destructive confirmation.
9. Safe bundle export receipt and safe import preflight.
10. Rejection of traversal, duplicate, oversized, encrypted/unsupported, and manifest-mismatch bundles with zero extraction.
11. Companion unavailable/read-only and capability mismatch states.
12. Options apply/reload success and failure with actual effective values.
13. Setup, reload, unload, and re-setup lifecycle evidence including zero leaked resources.
14. Artifact equality pass, inequality failure, missing, not-run, and stale evidence states.
15. Keyboard-only completion of validation, dry-run, diff selection, bundle selection, and confirmation cancellation.
16. Focus restoration, modal containment, screen-reader announcements, 200% zoom/reflow, reduced motion, and forced colors.
17. Explicit proof that Phase-1 browser workflows issue no plant/service calls.

Screenshots alone do not satisfy interaction or safety evidence. Source-token assertions do not satisfy validation, migration, archive, lifecycle, or artifact-equality behavior.

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
| `01-CONTEXT.md` | Raw-before-normalization validation, sequential copy-on-write migrations, dry-run, expected revision, verified rollback, safe archive bounds, lifecycle cleanup, split stores, canonical build, executable browser evidence, German/English, no live writes |
| `REQUIREMENTS.md` | SCHEMA-01, DIFF-01, HACS-01 plus phase-local i18n/a11y/test gates |
| Research summary | Native Web Components, exact-artifact evidence, browser/Companion authority boundary, HA minimum/current lanes, no framework rewrite |
| Existing designer | Neo 2030/Clean palettes, three-column shell, compact technical cards, inline SVG vocabulary, dialog and panel geometry |
| Standard accessible practice | Focus containment/restoration, native semantics, non-color status, 44px touch targets, reflow, reduced motion, error summaries |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
