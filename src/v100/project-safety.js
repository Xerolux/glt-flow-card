import { defineElement } from "./element-registry.mjs";
import { evaluateProjectContract } from "./project-contract.mjs";
import { readProjectBundleArchive } from "./project-bundle.mjs";
import {
  ROLES,
  authorityAffordances,
  createProjectAuthorityClient,
  initialAuthorityState,
  sharedWritable,
} from "./project-authority.mjs";
import {
  createCollaborationController,
  conflictChoices,
  initialCollaborationState,
} from "./project-collaboration.mjs";
import {
  createConfiguredControlClient,
  initialControlState,
  isControlSuccess,
  isControlUnknown,
} from "./configured-control.mjs";
import { projectSafetyCopy, projectSafetyLocale } from "./project-safety-i18n.mjs";

const Editor = customElements.get("glt-flow-card-editor");

const STYLE = `
  .glt-safe-trigger{min-height:31px}
  .glt-safe-modal{position:fixed;inset:0;z-index:13000;display:grid;place-items:center;padding:16px;background:#020617bd;backdrop-filter:blur(3px)}
  .glt-safe-dialog{display:grid;grid-template-rows:auto auto auto auto minmax(0,1fr) auto;width:min(1120px,calc(100vw - 32px));max-height:92vh;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:16px;background:var(--bg,var(--card-background-color,#0a1826));color:var(--tx,var(--primary-text-color,#edf6ff));box-shadow:0 24px 70px #02061788;font:14px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}
  .glt-safe-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px;border-bottom:1px solid var(--b,var(--divider-color,#19334a))}
  .glt-safe-head h2{font-size:24px;line-height:1.2;margin:0}.glt-safe-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;color:var(--mut,var(--secondary-text-color,#8198ad));font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
  .glt-safe-close,.glt-safe-btn,.glt-safe-tab{min-height:44px;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:8px;background:transparent;color:inherit;padding:8px 12px;font:700 14px/1.5 inherit;cursor:pointer}
  .glt-safe-close{min-width:44px;padding:8px}.glt-safe-btn.primary{background:var(--e,#0aa8ff);border-color:var(--e,#0aa8ff);color:#fff}.glt-safe-btn:disabled{cursor:not-allowed;opacity:.55}
  .glt-safe-close:focus-visible,.glt-safe-btn:focus-visible,.glt-safe-tab:focus-visible,.glt-safe-dialog input:focus-visible{outline:2px solid var(--e,#36c7ff);outline-offset:2px}
  .glt-safe-banner{padding:12px 16px;border-bottom:1px solid var(--b,var(--divider-color,#19334a));background:color-mix(in srgb,var(--e,#0aa8ff) 10%,transparent);font-weight:700}
  .glt-safe-banner.readonly{background:color-mix(in srgb,#8198ad 16%,transparent)}
  .glt-safe-tabs{display:flex;gap:4px;overflow-x:auto;padding:8px 16px;border-bottom:1px solid var(--b,var(--divider-color,#19334a));scrollbar-width:thin}.glt-safe-tab{white-space:nowrap;border-color:transparent;color:var(--mut,var(--secondary-text-color,#8198ad))}.glt-safe-tab[aria-selected="true"]{color:var(--e,#36c7ff);border-color:var(--e,#0aa8ff);background:color-mix(in srgb,var(--e,#0aa8ff) 10%,transparent)}
  .glt-safe-content{min-width:0;overflow:auto;padding:24px}.glt-safe-content h3{font-size:18px;line-height:1.3;margin:0 0 16px}.glt-safe-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:16px}.glt-safe-card{min-width:0;padding:16px;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:10px;background:color-mix(in srgb,var(--bg,var(--card-background-color,#0a1826)) 94%,var(--mut,#8198ad) 6%)}.glt-safe-card h4{margin:0 0 8px;font-size:14px}.glt-safe-value{font-weight:700;overflow-wrap:anywhere}.glt-safe-help,.glt-safe-code{color:var(--mut,var(--secondary-text-color,#8198ad));font-size:12px}.glt-safe-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
  .glt-safe-status{display:flex;align-items:center;gap:8px;margin:0 0 16px;padding:12px;border:1px solid currentColor;border-radius:10px}.glt-safe-status.pass{color:#31d879}.glt-safe-status.fail{color:#ff4f4f}.glt-safe-status.info{color:var(--e,#36c7ff)}
  .glt-safe-table{width:100%;border-collapse:collapse}.glt-safe-table th,.glt-safe-table td{padding:8px;border-bottom:1px solid var(--b,var(--divider-color,#19334a));text-align:left;vertical-align:top}.glt-safe-table th{font-size:12px}.glt-safe-table td{overflow-wrap:anywhere}.glt-safe-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.glt-safe-footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--b,var(--divider-color,#19334a));background:var(--bg,var(--card-background-color,#0a1826))}
  .glt-safe-stepper{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:0;list-style:none}.glt-safe-stepper li{padding:8px;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:8px;color:var(--mut,var(--secondary-text-color,#8198ad));font-size:12px}.glt-safe-stepper li.complete{border-color:var(--e,#0aa8ff);color:inherit}.glt-safe-input{width:min(100%,420px);min-height:44px;display:block;margin-top:8px;padding:8px;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:8px;background:var(--bg,var(--card-background-color,#0a1826));color:inherit;font:14px/1.5 inherit}.glt-safe-confirm{margin-top:16px}
  @media(max-width:767px){.glt-safe-modal{padding:0}.glt-safe-dialog{width:100vw;max-height:none;height:100dvh;border:0;border-radius:0}.glt-safe-content{padding:16px}.glt-safe-table,.glt-safe-table tbody,.glt-safe-table tr,.glt-safe-table th,.glt-safe-table td{display:block}.glt-safe-table thead{display:none}.glt-safe-table tr{padding:8px 0;border-bottom:1px solid var(--b,var(--divider-color,#19334a))}.glt-safe-table td{border:0}.glt-safe-table td::before{content:attr(data-label);display:block;color:var(--mut,var(--secondary-text-color,#8198ad));font-size:12px;font-weight:700}}
  @media(forced-colors:active){.glt-safe-dialog,.glt-safe-card,.glt-safe-status,.glt-safe-btn,.glt-safe-tab{border:1px solid CanvasText}.glt-safe-tab[aria-selected="true"]{outline:2px solid Highlight}}
  @media(prefers-reduced-motion:reduce){.glt-safe-modal,.glt-safe-dialog,.glt-safe-tab{scroll-behavior:auto;transition:none!important;animation:none!important}}
  .glt-safe-authority{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid var(--b,var(--divider-color,#19334a))}
  .glt-safe-chip{display:inline-flex;align-items:center;gap:4px;min-height:32px;padding:4px 12px;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:999px;font:700 12px/1.4 inherit}
  .glt-safe-chip[data-state="current"]{color:#31d879}.glt-safe-chip[data-state="stale"],.glt-safe-chip[data-state="unavailable"],.glt-safe-chip[data-state="incompatible"],.glt-safe-chip[data-state="expired"],.glt-safe-chip[data-state="lost"]{color:#ff4f4f}.glt-safe-chip[data-state="revision"]{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums}
  .glt-safe-readonly{margin:0;padding:12px 16px;border-bottom:1px solid var(--b,var(--divider-color,#19334a));background:color-mix(in srgb,#8198ad 16%,transparent);font-weight:700}
  .glt-safe-live{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
  .glt-safe-section{margin:24px 0 0;padding:16px;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:10px}.glt-safe-section h4{margin:0 0 8px;font-size:18px;line-height:1.3}.glt-safe-section>.glt-safe-help{margin:0 0 16px}
  .glt-safe-provenance{display:inline-block;margin-left:8px;padding:2px 8px;border:1px solid currentColor;border-radius:999px;font:700 12px/1.4 inherit;letter-spacing:.06em}
  .glt-safe-select{min-height:44px;padding:8px;border:1px solid var(--b,var(--divider-color,#19334a));border-radius:8px;background:var(--bg,var(--card-background-color,#0a1826));color:inherit;font:14px/1.5 inherit}
  .glt-safe-disclosure summary{min-height:44px;display:flex;align-items:center;cursor:pointer}.glt-safe-disclosure ul{margin:8px 0 0;padding-left:20px;font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
  @media(max-width:767px){.glt-safe-authority{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch}.glt-safe-chip[data-state="revision"]{grid-column:1/-1}}
  @media(forced-colors:active){.glt-safe-chip,.glt-safe-section,.glt-safe-provenance{border:1px solid CanvasText}}
`;

function copyFor(editor, key, values) {
  const locale = projectSafetyLocale(editor._hass || editor._glt4Hass, document.documentElement.lang);
  return projectSafetyCopy(locale, key, values);
}

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function button(label, className = "glt-safe-btn") {
  const node = element("button", className, label);
  node.type = "button";
  return node;
}

function card(title, value, detail) {
  const node = element("section", "glt-safe-card");
  node.append(element("h4", "", title), element("div", "glt-safe-value", value));
  if (detail) node.append(element("div", "glt-safe-help", detail));
  return node;
}

function status(kind, text) {
  const node = element("div", `glt-safe-status ${kind}`);
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.append(element("span", "", kind === "pass" ? "✓" : kind === "fail" ? "×" : "○"), element("strong", "", text));
  return node;
}

/** Map an internal authority state to the five states the bar may display. */
const COMPANION_STATE = {
  current: "current",
  loading: "refreshing",
  stale: "stale",
  rejected: "stale",
  incompatible: "incompatible",
  absent: "unavailable",
  unavailable: "unavailable",
};

/**
 * Reasons that earn a persistent blocking banner.
 *
 * "No lease yet" is a normal read state, not a loss of authority, so it stays a
 * chip: turning every read-only moment into an alert would train users to
 * ignore the alert that matters.
 */
const BANNER_REASONS = new Set([
  "authority_stale",
  "authority_rejected",
  "authority_incompatible",
  "authority_sequence_gap",
  "role_revoked",
  "role_missing",
  "lease_lost",
  "companion_disconnected",
]);

function chip(glyph, text, state) {
  const node = element("span", "glt-safe-chip");
  node.dataset.state = state;
  const icon = element("span", "", glyph);
  icon.setAttribute("aria-hidden", "true");
  node.append(icon, element("span", "", text));
  return node;
}

function leaseChipState(state, affordances) {
  const lease = state.lease;
  if (!lease) return affordances.canAcquireLease ? "available" : "readOnly";
  if (lease.state === "held-self") return "heldSelf";
  if (lease.state === "held-other") return "heldOther";
  if (lease.state === "expired") return "expired";
  if (lease.state === "lost") return "lost";
  return "readOnly";
}

function disclosure(summaryText, items, emptyText) {
  const node = element("details", "glt-safe-disclosure");
  node.append(element("summary", "", summaryText));
  if (items.length === 0) {
    node.append(element("p", "glt-safe-help", emptyText));
    return node;
  }
  const list = element("ul");
  for (const item of items) list.append(element("li", "", item));
  node.append(list);
  return node;
}

/**
 * The persistent authority state bar.
 *
 * It is a custom element so the same live regions survive every re-render of
 * the tabs beneath it: a status region that is replaced is a status region that
 * never announces.
 */
class GltAuthorityBar extends HTMLElement {
  constructor() {
    super();
    this._state = null;
    this._copy = (key) => key;
    this._announced = null;
  }

  set copy(value) {
    if (typeof value !== "function") return;
    this._copy = value;
    this._paint();
  }

  set state(value) {
    this._state = value;
    this._paint();
  }

  get state() {
    return this._state;
  }

  connectedCallback() {
    this._paint();
  }

  _build() {
    if (this._row) return;
    this._row = element("div", "glt-safe-authority");
    this._row.setAttribute("role", "group");
    this._banner = element("p", "glt-safe-readonly");
    this._banner.setAttribute("role", "alert");
    this._banner.hidden = true;
    // Bare `aria-live` regions, not `role="status"`/`role="alert"`: the visible
    // status blocks already carry those roles, and a second, permanently empty
    // element with the same role makes every status ambiguous to a reader
    // walking the dialog by role.
    this._polite = element("div", "glt-safe-live");
    this._polite.setAttribute("aria-live", "polite");
    this._polite.setAttribute("aria-atomic", "true");
    this._assertive = element("div", "glt-safe-live");
    this._assertive.setAttribute("aria-live", "assertive");
    this._assertive.setAttribute("aria-atomic", "true");
    this.append(this._row, this._banner, this._polite, this._assertive);
  }

  _paint() {
    if (!this.isConnected || !this._state) return;
    this._build();
    const t = this._copy;
    const state = this._state;
    const shared = state.mode === "shared";
    const affordances = authorityAffordances(state);
    this._row.setAttribute("aria-label", t("authorityBar"));

    const chips = [chip("◆", shared ? t("modeShared") : t("modeLocal"), shared ? "shared" : "local")];
    if (shared) {
      const companion = COMPANION_STATE[state.authority] || "unavailable";
      chips.push(chip("●", t("companionStates")[companion], companion));
      const role = state.role || "none";
      chips.push(chip("◎", `${t("myRole")}: ${t("roleNames")[role]}`, role));
      const lease = leaseChipState(state, affordances);
      chips.push(chip("✎", `${t("editing")}: ${t("leaseStates")[lease]}`, lease));
    }
    const revision = state.revision === null || state.revision === undefined ? "—" : String(state.revision);
    const expected = state.expectedRevision === null || state.expectedRevision === undefined
      ? null
      : String(state.expectedRevision);
    chips.push(chip("#", expected
      ? `${t("currentRevision")} ${revision} · ${t("expectedRevision")} ${expected}`
      : `${t("currentRevision")} ${revision}`, "revision"));
    this._row.replaceChildren(...chips);

    const reason = shared && !sharedWritable(state) ? state.readOnlyReason : null;
    const blocking = Boolean(reason) && BANNER_REASONS.has(reason);
    this._banner.hidden = !blocking;
    this._banner.textContent = blocking ? t("readOnlyReasons")[reason] : "";

    const announcement = state.announcement;
    if (!announcement || announcement.code === this._announced) return;
    this._announced = announcement.code;
    const text = t("announcements")[announcement.code]
      || t("readOnlyReasons")[announcement.code]
      || t("errorCodes")[announcement.code]
      || "";
    if (!text) return;
    // Only one region speaks per transition, so a screen reader never reads the
    // same change twice.
    const assertive = announcement.level === "assertive";
    (assertive ? this._assertive : this._polite).textContent = text;
    (assertive ? this._polite : this._assertive).textContent = "";
  }
}

/**
 * The shared-authority surface: it owns the Companion adapter and the bar, and
 * publishes every authority transition to whatever renders beneath it.
 */
class GltProjectAuthority extends HTMLElement {
  constructor() {
    super();
    this._client = null;
    this._state = initialAuthorityState();
    this._copy = (key) => key;
    this._bar = document.createElement("glt-flow-card-authority-bar");
  }

  connectedCallback() {
    if (this._bar.parentNode !== this) this.append(this._bar);
    this._publish();
  }

  disconnectedCallback() {
    this.release();
  }

  set copy(value) {
    if (typeof value !== "function") return;
    this._copy = value;
    this._bar.copy = value;
  }

  get authorityState() {
    return this._state;
  }

  get client() {
    return this._client;
  }

  get affordances() {
    return authorityAffordances(this._state);
  }

  /**
   * Attach a live Companion connection.
   *
   * Without one this is an explicit local-only project - a separate labelled
   * mode, never a shared project that has quietly stopped being shared.
   */
  connect({ hass, projectId }) {
    this.release();
    if (!hass?.callWS) {
      this._state = initialAuthorityState({ mode: "local" });
      this._publish();
      return null;
    }
    this._client = createProjectAuthorityClient({
      hass,
      projectId,
      onChange: (state) => {
        this._state = state;
        this._publish();
      },
    });
    return this._client;
  }

  release() {
    if (!this._client) return;
    const client = this._client;
    this._client = null;
    client.destroy();
  }

  _publish() {
    this._bar.copy = this._copy;
    this._bar.state = this._state;
    this.dispatchEvent(new CustomEvent("glt-authority-change", {
      bubbles: true,
      detail: { state: this._state },
    }));
  }
}

/**
 * Shared plumbing for the Phase-2 surface elements.
 *
 * Each one takes its whole input in a single `props` assignment and repaints
 * once, so a half-updated surface - new revision, old lease - cannot be shown
 * even for one frame.
 */
class GltSurfaceElement extends HTMLElement {
  constructor() {
    super();
    this._copy = (key) => key;
    this._props = {};
  }

  connectedCallback() {
    this.paint();
  }

  set copy(value) {
    if (typeof value !== "function") return;
    this._copy = value;
    this.paint();
  }

  set props(value) {
    this._props = value ?? {};
    this.paint();
  }

  get props() {
    return this._props;
  }

  paint() {
    if (this.isConnected) this.replaceChildren(...this.render());
  }

  render() {
    return [];
  }
}

/** Acquire, renew, release and describe the one exclusive engineering lease. */
class GltLeaseControl extends GltSurfaceElement {
  render() {
    const t = this._copy;
    const { authority, collaboration, affordances, onAcquire, onRenew, onRelease, onDiscard } = this._props;
    if (!authority || !collaboration) return [];
    const section = element("section", "glt-safe-section");
    section.append(element("h4", "", t("leaseHeading")));

    const lease = collaboration.lease || authority.lease;
    const chipState = leaseChipState(authority, affordances);
    const summary = element("div", "glt-safe-authority");
    summary.append(chip("✎", t("leaseStates")[chipState], chipState));
    if (lease?.expiresAt !== undefined && lease?.state === "held-self") {
      const remaining = Math.max(0, Math.round(lease.expiresAt - authority.observedAt));
      summary.append(chip("⏱", t("leaseExpiresIn", { seconds: remaining }), "revision"));
    }
    const candidate = collaboration.candidate;
    const candidateState = !candidate ? "none" : candidate.preserved ? "preserved" : "dirty";
    summary.append(chip("✱", t("candidateStates")[candidateState], candidateState));
    const revisions = collaboration.revisions;
    summary.append(chip("#", t("revisionTriplet", {
      base: revisions.base ?? "—",
      current: revisions.current ?? authority.revision ?? "—",
      candidate: revisions.candidate ?? "—",
    }), "revision"));
    section.append(summary);

    const actions = element("div", "glt-safe-actions");
    // A viewer or operator never sees a disabled lease button: an affordance
    // they can never use is only a way to make them feel refused.
    if (affordances.canAcquireLease) {
      const acquire = button(t("acquireLease"), "glt-safe-btn primary");
      acquire.addEventListener("click", () => onAcquire?.());
      actions.append(acquire);
    }
    if (affordances.canRenewLease) {
      const renew = button(t("renewLease"));
      renew.addEventListener("click", () => onRenew?.());
      const release = button(t("releaseLease"));
      release.addEventListener("click", () => onRelease?.());
      actions.append(renew, release);
    }
    if (candidate) {
      const discard = button(t("conflictChoices").discard);
      discard.addEventListener("click", () => onDiscard?.());
      actions.append(discard);
    }
    if (actions.childElementCount > 0) section.append(actions);

    if (chipState === "heldOther") {
      section.append(element("p", "glt-safe-help", t("leaseStates").heldOther));
    }
    return [section];
  }
}

/** Non-destructive two-session recovery. There is no overwrite path. */
class GltConflictRecovery extends GltSurfaceElement {
  render() {
    const t = this._copy;
    const { collaboration, onChoose } = this._props;
    const conflict = collaboration?.conflict;
    if (!conflict) return [];
    const section = element("section", "glt-safe-section");
    section.setAttribute("role", "group");
    section.append(
      element("h4", "", t("conflictHeading")),
      element("p", "", t("conflictBody", {
        base: conflict.base ?? "—",
        current: conflict.current ?? "—",
      })),
      element("p", "glt-safe-help", t("mergeStates")[collaboration.merge.state]),
    );
    const actions = element("div", "glt-safe-actions");
    for (const choice of conflictChoices(collaboration)) {
      const node = button(t("conflictChoices")[choice], choice === "discard"
        ? "glt-safe-btn"
        : "glt-safe-btn primary");
      node.addEventListener("click", () => onChoose?.(choice));
      actions.append(node);
    }
    section.append(actions);
    return [section];
  }
}

/**
 * Confirm one configured control and report its authoritative result.
 *
 * The effect summary is the server's own, rendered read-only. There is no
 * retry action anywhere in this element, in any result state.
 */
class GltControlConfirm extends GltSurfaceElement {
  render() {
    const t = this._copy;
    const { control, onConfirm, onCancel } = this._props;
    if (!control || control.phase === "idle") return [];
    const section = element("section", "glt-safe-section");
    section.setAttribute("role", "group");
    section.append(element("h4", "", t("controlConfirmHeading")));

    const preview = control.preview;
    if (preview) {
      section.append(element("p", "", t("controlConfirmBody", { label: preview.label ?? control.controlId })));
      const table = element("table", "glt-safe-table");
      const body = element("tbody");
      for (const [label, value] of [
        [t("controlEffect"), preview.summary ?? "—"],
        [t("controlTarget"), JSON.stringify(preview.target ?? {})],
      ]) {
        const row = element("tr");
        const key = element("th", "", label);
        const cell = element("td", "glt-safe-code", value);
        cell.dataset.label = label;
        row.append(key, cell);
        body.append(row);
      }
      table.append(body);
      section.append(table);
    }

    if (control.phase === "confirm") {
      const actions = element("div", "glt-safe-actions");
      const cancel = button(t("controlCancel"));
      cancel.addEventListener("click", () => onCancel?.());
      const run = button(t("controlRun"), "glt-safe-btn primary");
      run.addEventListener("click", () => onConfirm?.());
      actions.append(cancel, run);
      section.append(actions);
      // The safe choice takes focus, never the one that moves plant.
      queueMicrotask(() => cancel.focus());
    }

    if (control.result) {
      const kind = isControlSuccess(control.result) ? "pass" : isControlUnknown(control.result) ? "fail" : "info";
      section.append(status(kind, t("controlStates")[control.result]));
      if (control.correlationId) {
        section.append(element("p", "glt-safe-code", `${t("controlCorrelation")} ${control.correlationId}`));
      }
      if (isControlUnknown(control.result)) {
        section.append(element("p", "glt-safe-help", t("controlNoRetry")));
      }
    }
    if (control.error) {
      section.append(element("p", "glt-safe-help",
        t("errorCodes")[control.error.code] || t("errorCodes").effect_unknown));
    }
    return [section];
  }
}

if (!customElements.get("glt-flow-card-authority-bar")) {
  defineElement("glt-flow-card-authority-bar", GltAuthorityBar);
}
if (!customElements.get("glt-flow-card-project-authority")) {
  defineElement("glt-flow-card-project-authority", GltProjectAuthority);
}
/**
 * One evidence stream, with its own heading, query, pagination and export.
 *
 * The two streams never share a filter, a cursor, a total or a style, and the
 * untrusted one carries its label permanently rather than only while empty. A
 * failed next page keeps the rows already on screen and marks them stale:
 * dropping them would hide history the user was authorized to see.
 */
class GltEvidenceView extends GltSurfaceElement {
  _row(kind, row) {
    const t = this._copy;
    const cells = kind === "trusted"
      ? [
          ["auditAt", row.at],
          ["auditActor", row.actor ?? row.user_id ?? "—"],
          ["auditEvent", row.action ?? "—"],
          ["auditResult", row.result ?? row.state ?? "—"],
          ["auditCorrelation", row.correlation_id ?? "—"],
        ]
      : [
          ["telemetryReceived", row.at],
          ["telemetryCategory", row.payload?.category ?? "—"],
          ["telemetryPayload", JSON.stringify(row.payload ?? {}).slice(0, 200)],
        ];
    const node = element("tr");
    for (const [key, value] of cells) {
      const cell = element("td", "", value === undefined || value === null ? "—" : String(value));
      cell.dataset.label = t(key);
      node.append(cell);
    }
    return node;
  }

  render() {
    const t = this._copy;
    const { kind, page, onNext, onExport } = this._props;
    if (!page) return [];
    const trusted = kind === "trusted";
    const section = element("section", "glt-safe-section");
    const title = t(trusted ? "trustedAudit" : "clientTelemetry");
    const heading = element("h4", "", title);
    const label = element("span", "glt-safe-provenance", t(trusted ? "serverAuthored" : "notEvidence"));
    heading.append(label);
    section.setAttribute("aria-label", `${title} — ${label.textContent}`);
    section.append(heading);

    if (page.stale) section.append(status("fail", t("rowsStale")));
    if (page.error) {
      section.append(element("p", "glt-safe-help",
        t("errorCodes")[page.error.code] || t("errorCodes").effect_unknown));
    }
    if (page.rows.length === 0) {
      section.append(element("p", "glt-safe-help", t(trusted ? "trustedEmpty" : "telemetryEmpty")));
      return [section];
    }

    const table = element("table", "glt-safe-table");
    const header = element("thead");
    const headRow = element("tr");
    const columns = trusted
      ? ["auditAt", "auditActor", "auditEvent", "auditResult", "auditCorrelation"]
      : ["telemetryReceived", "telemetryCategory", "telemetryPayload"];
    for (const key of columns) headRow.append(element("th", "", t(key)));
    header.append(headRow);
    const body = element("tbody");
    for (const row of page.rows) body.append(this._row(kind, row));
    table.append(header, body);
    section.append(table);

    const actions = element("div", "glt-safe-actions");
    if (page.hasMore) {
      const next = button(t("loadNext"));
      next.addEventListener("click", () => onNext?.(page.cursor));
      actions.append(next);
    }
    const download = button(t(trusted ? "exportTrusted" : "exportTelemetry"));
    download.addEventListener("click", () => onExport?.(page.rows));
    actions.append(download);
    section.append(actions);
    return [section];
  }
}

if (!customElements.get("glt-flow-card-evidence-view")) {
  defineElement("glt-flow-card-evidence-view", GltEvidenceView);
}
if (!customElements.get("glt-flow-card-lease-control")) {
  defineElement("glt-flow-card-lease-control", GltLeaseControl);
}
if (!customElements.get("glt-flow-card-conflict-recovery")) {
  defineElement("glt-flow-card-conflict-recovery", GltConflictRecovery);
}
if (!customElements.get("glt-flow-card-control-confirm")) {
  defineElement("glt-flow-card-control-confirm", GltControlConfirm);
}

function projectAuthority(editor, type, payload) {
  if (!editor._hass?.callWS) return Promise.reject(Object.assign(new Error("Companion unavailable"), { code: "unavailable" }));
  return editor._hass.callWS({ type: `glt_flow_card/projects/${type}`, ...payload });
}

function selectedClosure(state) {
  const selected = new Set();
  const locked = new Set();
  for (const requested of state.requested || []) {
    const closure = state.preview?.closures?.[requested];
    for (const operationId of closure?.selected || [requested]) {
      selected.add(operationId);
      if (operationId !== requested) locked.add(operationId);
    }
  }
  state.locked = locked;
  return [...selected].sort();
}

function actualRevision(error, fallback) {
  if (Number.isInteger(error?.actual_revision)) return error.actual_revision;
  const match = String(error?.message || "").match(/revision_conflict:(\d+)/u);
  return match ? Number(match[1]) : fallback;
}

function migrationStatus(editor, state) {
  if (state.phase === "preview-ready") return ["pass", copyFor(editor, "previewReady")];
  if (state.phase === "applying") return ["info", copyFor(editor, "applying", { count: selectedClosure(state).length })];
  if (state.phase === "applied") return ["pass", copyFor(editor, "applySuccess")];
  if (state.phase === "conflict") return ["fail", copyFor(editor, "revisionConflict", { expected: state.expectedRevision, actual: state.actualRevision })];
  if (state.phase === "rollback-running") return ["info", copyFor(editor, "rollbackRunning")];
  if (state.phase === "rolled-back") return ["pass", copyFor(editor, "rollbackSuccess")];
  if (state.phase === "unavailable") return ["fail", copyFor(editor, "standalone")];
  if (state.phase === "rollback-failed") return ["fail", copyFor(editor, "rollbackFailure")];
  if (state.phase === "failed") return ["fail", copyFor(editor, "applyFailure")];
  if (state.phase === "preview-failed") return ["fail", copyFor(editor, "previewFailed")];
  return ["info", copyFor(editor, "notRun")];
}

function focusable(dialog) {
  return [...dialog.querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])")]
    .filter((node) => !node.hidden && node.getAttribute("aria-hidden") !== "true");
}

/** Load the membership inventory once per surface entry. */
function loadAccessInventory(editor, state) {
  if (state.access.loading || !state.client) return;
  state.access.loading = true;
  state.client.accessInventory().then(
    (inventory) => {
      state.access.loading = false;
      state.access.inventory = inventory;
      state.access.error = null;
      state.render();
    },
    (error) => {
      state.access.loading = false;
      state.access.error = error?.code || "effect_unknown";
      state.render();
    },
  );
}

/**
 * Apply one membership change atomically.
 *
 * The administration lease is acquired for this change and released straight
 * after, so a browser that is left open never sits on the lease that membership
 * recovery depends on. The inventory is then dropped rather than patched: the
 * next authoritative list is the only list worth trusting.
 */
function applyAccessChange(editor, state) {
  const pending = state.access.pending;
  const inventory = state.access.inventory;
  if (!pending || !inventory || !state.client) return;
  state.access.pending = null;
  state.access.busy = true;
  state.render();
  const client = state.client;
  client.acquireLease("membership_admin", 300)
    .then(() => client.setAccess({
      userId: pending.userId,
      role: pending.role,
      expectedAccessRevision: inventory.access_revision,
    }))
    .then(
      () => { state.access.notice = "accessSaved"; },
      (error) => {
        state.access.notice = "accessDenied";
        state.access.lastCode = error?.code || "effect_unknown";
      },
    )
    .then(() => client.releaseLease().catch(() => {
      // A lease that cannot be released expires on the server by itself.
    }))
    .then(() => {
      state.access.inventory = null;
      state.access.busy = false;
      state.render();
    });
}

function accessConfirmation(editor, state) {
  const pending = state.access.pending;
  const inventory = state.access.inventory;
  const values = {
    member: pending.name || pending.userId,
    role: copyFor(editor, "roleNames")[pending.role] || copyFor(editor, "roleNames").none,
    revision: inventory.access_revision,
  };
  const block = element("section", "glt-safe-confirm");
  block.setAttribute("role", "group");
  block.append(
    element("h4", "", copyFor(editor, "confirmAccessHeading")),
    element("p", "", copyFor(editor, pending.role === null ? "confirmRemoveBody" : "confirmAccessBody", values)),
  );
  const actions = element("div", "glt-safe-actions");
  const cancel = button(copyFor(editor, "cancelAccessChange"));
  cancel.addEventListener("click", () => {
    state.access.pending = null;
    state.render();
  });
  const apply = button(copyFor(editor, "applyAccessChange"), "glt-safe-btn primary");
  apply.addEventListener("click", () => applyAccessChange(editor, state));
  actions.append(cancel, apply);
  block.append(actions);
  // Initial focus is the safe choice, not the one that changes authority.
  queueMicrotask(() => cancel.focus());
  return block;
}

/**
 * The in-dialog access work surface.
 *
 * Every identity it offers came from the server's eligible-user list, the role
 * selector holds exactly the four fixed roles, and there is no capability
 * checkbox anywhere: capabilities follow from the role the server assigns.
 */
function renderAccessSurface(editor, state, content) {
  const heading = element("h3", "", copyFor(editor, "accessHeading"));
  heading.tabIndex = -1;
  content.append(heading);
  const back = button(copyFor(editor, "backToOverview"));
  back.addEventListener("click", () => {
    state.accessSurface = false;
    state.render();
  });
  content.append(back);

  if (state.access.notice) {
    const saved = state.access.notice === "accessSaved";
    content.append(status(saved ? "pass" : "fail", copyFor(editor, state.access.notice)));
    if (!saved && state.access.lastCode) {
      content.append(element("p", "glt-safe-help", copyFor(editor, "errorCodes")[state.access.lastCode] || ""));
    }
  }
  if (state.access.error) {
    content.append(status("fail", copyFor(editor, "errorCodes")[state.access.error]
      || copyFor(editor, "errorCodes").effect_unknown));
    return;
  }
  const inventory = state.access.inventory;
  if (!inventory) {
    content.append(status("info", copyFor(editor, "accessLoading")));
    loadAccessInventory(editor, state);
    return;
  }

  content.append(element("p", "glt-safe-code", `${copyFor(editor, "accessRevision")} ${inventory.access_revision}`));
  const eligible = Array.isArray(inventory.eligible_users) ? inventory.eligible_users : [];
  const named = new Map(eligible.map((entry) => [entry.user_id, entry.name || entry.user_id]));
  const assignments = Array.isArray(inventory.assignments) ? inventory.assignments : [];

  if (assignments.length === 0) {
    content.append(element("p", "glt-safe-help", copyFor(editor, "accessEmpty")));
  } else {
    const table = element("table", "glt-safe-table");
    const head = element("tr");
    for (const key of ["memberColumn", "roleColumn", "capabilitiesColumn", "assignmentColumn", "actionColumn"]) {
      head.append(element("th", "", copyFor(editor, key)));
    }
    const header = element("thead");
    header.append(head);
    table.append(header);
    const body = element("tbody");
    for (const entry of assignments) {
      const row = element("tr");
      const name = named.get(entry.user_id) || entry.user_id;
      const member = element("td", "", name);
      member.dataset.label = copyFor(editor, "memberColumn");

      const roleCell = element("td");
      roleCell.dataset.label = copyFor(editor, "roleColumn");
      const select = element("select", "glt-safe-select");
      select.setAttribute("aria-label", `${copyFor(editor, "roleColumn")} — ${name}`);
      for (const role of ROLES) {
        const option = element("option", "", copyFor(editor, "roleNames")[role]);
        option.value = role;
        option.selected = role === entry.role;
        select.append(option);
      }
      select.disabled = Boolean(state.access.busy);
      select.addEventListener("change", () => {
        state.access.pending = { userId: entry.user_id, name, role: select.value };
        state.render();
      });
      roleCell.append(select);

      const matrix = inventory.role_matrix?.[entry.role];
      const capabilities = element("td");
      capabilities.dataset.label = copyFor(editor, "capabilitiesColumn");
      capabilities.append(Array.isArray(matrix)
        ? disclosure(copyFor(editor, "roleMatrix"), matrix, copyFor(editor, "noCapabilities"))
        : element("span", "glt-safe-help", copyFor(editor, "roleMatrixUnavailable")));

      const assignment = element("td", "", copyFor(editor, "assigned"));
      assignment.dataset.label = copyFor(editor, "assignmentColumn");

      const action = element("td");
      action.dataset.label = copyFor(editor, "actionColumn");
      const remove = button(copyFor(editor, "removeAccess"));
      remove.disabled = Boolean(state.access.busy);
      remove.addEventListener("click", () => {
        state.access.pending = { userId: entry.user_id, name, role: null };
        state.render();
      });
      action.append(remove);

      row.append(member, roleCell, capabilities, assignment, action);
      body.append(row);
    }
    table.append(body);
    content.append(table);
  }

  const assigned = new Set(assignments.map((entry) => entry.user_id));
  const candidates = eligible.filter((entry) => !assigned.has(entry.user_id));
  if (candidates.length > 0) {
    const add = element("section", "glt-safe-card");
    add.append(element("h4", "", copyFor(editor, "addMember")));
    const picker = element("select", "glt-safe-select");
    picker.setAttribute("aria-label", copyFor(editor, "eligibleUser"));
    const placeholder = element("option", "", copyFor(editor, "chooseUser"));
    placeholder.value = "";
    picker.append(placeholder);
    for (const entry of candidates) {
      const option = element("option", "", entry.name || entry.user_id);
      option.value = entry.user_id;
      picker.append(option);
    }
    const role = element("select", "glt-safe-select");
    role.setAttribute("aria-label", copyFor(editor, "roleColumn"));
    for (const name of ROLES) {
      const option = element("option", "", copyFor(editor, "roleNames")[name]);
      option.value = name;
      role.append(option);
    }
    const confirm = button(copyFor(editor, "addMember"), "glt-safe-btn primary");
    confirm.addEventListener("click", () => {
      if (!picker.value) return;
      state.access.pending = {
        userId: picker.value,
        name: picker.selectedOptions[0]?.textContent || picker.value,
        role: role.value,
      };
      state.render();
    });
    const actions = element("div", "glt-safe-actions");
    actions.append(picker, role, confirm);
    add.append(actions);
    content.append(add);
  }

  if (state.access.pending) content.append(accessConfirmation(editor, state));
}

function renderOverview(editor, state, content) {
  const authority = state.authority || initialAuthorityState();
  const affordances = authorityAffordances(authority);
  if (state.accessSurface && affordances.canManageAccess) {
    renderAccessSurface(editor, state, content);
    return;
  }
  content.append(element("h3", "", copyFor(editor, "overview")));
  const grid = element("div", "glt-safe-grid");
  const project = editor._config?.project || {};
  grid.append(
    card(copyFor(editor, "rawContract"), `${copyFor(editor, "schema")} ${editor._config?.schema_version ?? "—"}`, state.validation?.valid === true ? copyFor(editor, "validationSuccess") : copyFor(editor, "notRun")),
    card(copyFor(editor, "project"), project.name || project.id || "—", `${copyFor(editor, "revision")} ${project.revision ?? 0}`),
    card(copyFor(editor, "companion"), editor._hass?.callWS ? copyFor(editor, "connected") : copyFor(editor, "readOnly")),
    card(copyFor(editor, "bundleSafety"), copyFor(editor, "notRun")),
    card(copyFor(editor, "releaseEvidence"), copyFor(editor, "byteIdentical"), `v${window.GLTFlowCardSDK?.version || "—"}`),
  );

  const companion = COMPANION_STATE[authority.authority] || "unavailable";
  const refreshed = authority.snapshotAt === null
    ? copyFor(editor, "never")
    : `${copyFor(editor, "lastRefresh")} +${Math.round(authority.snapshotAt)}s`;
  grid.append(card(
    copyFor(editor, "sharedAuthority"),
    copyFor(editor, "companionStates")[companion],
    `${copyFor(editor, "policyVersion")} ${authority.policyVersion ?? "—"} · ${refreshed}`,
  ));

  const access = card(
    copyFor(editor, "myAccess"),
    copyFor(editor, "roleNames")[authority.role || "none"],
    authority.readOnlyReason ? copyFor(editor, "readOnlyReasons")[authority.readOnlyReason] : undefined,
  );
  access.append(disclosure(
    copyFor(editor, "capabilityCodes"),
    authority.capabilities,
    copyFor(editor, "noCapabilities"),
  ));
  grid.append(access);

  grid.append(card(
    copyFor(editor, "collaboration"),
    copyFor(editor, "leaseStates")[leaseChipState(authority, affordances)],
    `${copyFor(editor, "currentRevision")} ${authority.revision ?? project.revision ?? 0}`,
  ));

  // A control count the user is not authorized to see is absent, not redacted:
  // a redacted placeholder still answers "there is something here".
  const controls = Array.isArray(editor._config?.controls) ? editor._config.controls : [];
  if (affordances.canReadProject) {
    grid.append(card(
      copyFor(editor, "controlPolicy"),
      copyFor(editor, "controlsVisible", { count: controls.length }),
      copyFor(editor, "serverNormalization"),
    ));
  }
  content.append(grid);

  if (affordances.canExecuteControl && controls.length > 0 && state.controlClient) {
    const section = element("section", "glt-safe-section");
    section.append(element("h4", "", copyFor(editor, "controlHeading")));
    const actions = element("div", "glt-safe-actions");
    for (const control of controls) {
      if (!control?.id) continue;
      // The request names the control and nothing else: no domain, service or
      // target field exists here to be edited or smuggled.
      const preview = button(`${copyFor(editor, "controlPreview")} — ${control.label || control.id}`);
      preview.addEventListener("click", () => {
        state.controlClient.select(control.id);
        state.controlClient.preview(control.id, {}, authority.revision ?? project.revision ?? 0);
      });
      actions.append(preview);
    }
    section.append(actions);
    content.append(section);

    const confirm = document.createElement("glt-flow-card-control-confirm");
    confirm.copy = (key, values) => copyFor(editor, key, values);
    confirm.props = {
      control: state.control,
      onCancel: () => state.controlClient.cancel(),
      onConfirm: () => state.controlClient.execute(
        state.control.controlId,
        {},
        authority.revision ?? project.revision ?? 0,
      ),
    };
    content.append(confirm);
  }

  const actions = element("div", "glt-safe-actions");
  const validate = button(copyFor(editor, "validate"), "glt-safe-btn primary");
  validate.addEventListener("click", () => {
    state.tab = 1;
    state.runValidation = true;
    state.render();
  });
  actions.append(validate);
  // Absent, not disabled: a disabled administration action would tell a user
  // who may not administer this project that administration exists here.
  if (affordances.canManageAccess) {
    const manage = button(copyFor(editor, "manageAccess"));
    manage.addEventListener("click", () => {
      state.accessSurface = true;
      state.access.notice = null;
      state.render();
    });
    actions.append(manage);
  }
  content.append(actions);
}

function renderValidation(editor, state, content) {
  content.append(element("h3", "", copyFor(editor, "validate")));
  if (!state.validation) {
    content.append(status("info", copyFor(editor, "validationIdle")));
  } else if (state.validation.valid) {
    content.append(status("pass", copyFor(editor, "validationSuccess")));
    content.append(element("p", "", copyFor(editor, "validationValid", { version: state.validation.schema_version })));
    content.append(element("p", "glt-safe-code", copyFor(editor, "unchanged")));
  } else {
    content.append(status("fail", copyFor(editor, "validationFailed")));
    content.append(element("p", "", copyFor(editor, "validationInvalid")));
    content.append(element("p", "glt-safe-code", copyFor(editor, "unchanged")));
    const table = element("table", "glt-safe-table");
    const head = element("thead");
    const headRow = element("tr");
    for (const label of ["Code", copyFor(editor, "path"), "Message"]) headRow.append(element("th", "", label));
    head.append(headRow);
    const body = element("tbody");
    for (const issue of state.validation.errors || []) {
      const row = element("tr");
      for (const [label, value] of [["Code", issue.code], [copyFor(editor, "path"), issue.path], ["Message", issue.message || JSON.stringify(issue.params || {})]]) {
        const cell = element("td", "glt-safe-code", value);
        cell.dataset.label = label;
        row.append(cell);
      }
      body.append(row);
    }
    table.append(head, body);
    content.append(table);
  }
  const actions = element("div", "glt-safe-actions");
  const validate = button(copyFor(editor, "validate"), "glt-safe-btn primary");
  validate.addEventListener("click", () => {
    state.validation = evaluateProjectContract(editor._config);
    state.render();
  });
  actions.append(validate);
  content.append(actions);
  if (state.runValidation) {
    state.runValidation = false;
    queueMicrotask(() => validate.click());
  }
}

/** The engineering lease bar and, on a conflict, the recovery panel. */
function renderCollaboration(editor, state, content) {
  const controller = state.collaborationController;
  if (!controller) return;
  const copy = (key, values) => copyFor(editor, key, values);

  const lease = document.createElement("glt-flow-card-lease-control");
  lease.copy = copy;
  lease.props = {
    authority: state.authority,
    collaboration: state.collaboration,
    affordances: authorityAffordances(state.authority),
    onAcquire: () => controller.acquire(),
    onRenew: () => controller.renew(),
    onRelease: () => controller.release(),
    onDiscard: () => controller.discard(),
  };
  content.append(lease);

  if (!state.collaboration.conflict) return;
  const recovery = document.createElement("glt-flow-card-conflict-recovery");
  recovery.copy = copy;
  recovery.props = {
    collaboration: state.collaboration,
    onChoose: (choice) => controller.recover(choice),
  };
  content.append(recovery);
}

function renderMigration(editor, state, content) {
  content.append(element("h3", "", copyFor(editor, "tabs")[2]));
  renderCollaboration(editor, state, content);
  const workflow = element("ol", "glt-safe-stepper");
  workflow.setAttribute("aria-label", "Migration workflow");
  for (const [index, label] of copyFor(editor, "workflow").entries()) {
    workflow.append(element("li", state.preview || index === 0 ? "complete" : "", `${index + 1}. ${label}`));
  }
  content.append(workflow);
  const [kind, message] = migrationStatus(editor, state);
  content.append(status(kind, message));

  if (state.phase === "applied") {
    content.append(element("p", "", copyFor(editor, "applySuccessBody", {
      revision: state.applied.revision,
      count: state.appliedCount,
      backup_id: state.applied.rollback_snapshot_id,
    })));
  }
  if (state.phase === "rolled-back") {
    content.append(element("p", "", copyFor(editor, "rollbackSuccessBody", {
      revision: state.rollback.revision,
      backup_id: state.applied?.rollback_snapshot_id,
    })));
  }

  if (state.preview) {
    const receipt = state.preview.migration_receipt || {};
    content.append(card("Migration", `${receipt.source_schema_version ?? "—"} → ${receipt.candidate_schema_version ?? "—"}`, `${receipt.steps?.length || 0} sequential step(s)`));
    const table = element("table", "glt-safe-table");
    const head = element("thead");
    const headRow = element("tr");
    for (const label of ["Select", "Category", copyFor(editor, "path"), copyFor(editor, "impact")]) headRow.append(element("th", "", label));
    head.append(headRow);
    const body = element("tbody");
    selectedClosure(state);
    for (const operation of state.preview.operations || []) {
      const row = element("tr");
      const selectCell = element("td");
      selectCell.dataset.label = "Select";
      const checkbox = element("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.requested.has(operation.id) || state.locked.has(operation.id);
      checkbox.disabled = state.locked.has(operation.id);
      checkbox.setAttribute("aria-label", operation.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.requested.add(operation.id);
        else state.requested.delete(operation.id);
        state.render();
      });
      selectCell.append(checkbox);
      if (state.locked.has(operation.id)) selectCell.append(element("span", "glt-safe-help", copyFor(editor, "requiredDependency")));
      const category = copyFor(editor, "categories")[operation.category] || operation.category;
      const values = [category, operation.path, `${operation.impact?.severity || "—"}: ${(operation.impact?.areas || []).join(", ")}`];
      row.append(selectCell);
      for (const [index, value] of values.entries()) {
        const cell = element("td", index > 0 ? "glt-safe-code" : "", value);
        cell.dataset.label = ["Category", copyFor(editor, "path"), copyFor(editor, "impact")][index];
        row.append(cell);
      }
      body.append(row);
    }
    table.append(head, body);
    content.append(table);
    if (state.preview.ordering_noise?.length) content.append(element("p", "glt-safe-help", `${copyFor(editor, "ignoredNoise")}: ${state.preview.ordering_noise.join(", ")}`));
  }

  if (state.confirmApply) {
    const confirm = element("section", "glt-safe-card glt-safe-confirm");
    confirm.append(element("h3", "", copyFor(editor, "confirmApplyHeading")));
    const selectedIds = selectedClosure(state);
    confirm.append(element("p", "", copyFor(editor, "confirmApplyBody", {
      count: selectedIds.length,
      project: editor._config?.project?.name || editor._config?.project?.id,
      revision: state.expectedRevision,
    })));
    const actions = element("div", "glt-safe-actions");
    const cancel = button(copyFor(editor, "cancelApply"));
    cancel.addEventListener("click", () => { state.confirmApply = false; state.render(); });
    const apply = button(copyFor(editor, "confirmApplyHeading"), "glt-safe-btn primary");
    apply.addEventListener("click", async () => {
      state.confirmApply = false;
      state.phase = "applying";
      state.render();
      try {
        const selected_ids = selectedClosure(state);
        const result = await projectAuthority(editor, "apply", {
          project_id: editor._config.project.id,
          preview_id: state.preview.preview_id,
          expected_revision: state.expectedRevision,
          selected_ids,
        });
        state.applied = result;
        state.appliedCount = selected_ids.length;
        state.phase = "applied";
        if (result?.config) editor._config = structuredClone(result.config);
      } catch (error) {
        if (error?.code === "revision_conflict" || /revision_conflict/u.test(String(error?.message))) {
          state.phase = "conflict";
          state.actualRevision = actualRevision(error, state.expectedRevision);
        } else if (error?.code === "unavailable") state.phase = "unavailable";
        else state.phase = "failed";
      }
      state.render();
    });
    actions.append(cancel, apply);
    confirm.append(actions);
    content.append(confirm);
  }

  if (state.confirmRollback) {
    const confirm = element("section", "glt-safe-card glt-safe-confirm");
    confirm.append(element("h3", "", copyFor(editor, "restore")));
    const name = editor._config?.project?.name || editor._config?.project?.id || "";
    confirm.append(element("p", "", copyFor(editor, "restoreBody", { backup_id: state.applied.rollback_snapshot_id, project: name, revision: state.applied.revision })));
    const label = element("label", "", copyFor(editor, "restoreLabel"));
    const input = element("input", "glt-safe-input");
    input.id = `glt-safe-restore-${Math.random().toString(36).slice(2)}`;
    label.htmlFor = input.id;
    const hint = element("p", "glt-safe-help", copyFor(editor, "restoreAwaiting", { project: name }));
    const actions = element("div", "glt-safe-actions");
    const cancel = button(copyFor(editor, "cancelApply"));
    cancel.addEventListener("click", () => { state.confirmRollback = false; state.render(); });
    const restore = button(copyFor(editor, "restore"), "glt-safe-btn primary");
    restore.disabled = true;
    input.addEventListener("input", () => {
      restore.disabled = input.value !== name;
      hint.textContent = copyFor(editor, input.value === name ? "restoreReady" : input.value ? "restoreMismatch" : "restoreAwaiting", { project: name });
    });
    restore.addEventListener("click", async () => {
      if (input.value !== name) return;
      state.confirmRollback = false;
      state.phase = "rollback-running";
      state.render();
      try {
        const result = await projectAuthority(editor, "rollback", {
          project_id: editor._config.project.id,
          snapshot_id: state.applied.rollback_snapshot_id,
          expected_revision: state.applied.revision,
          confirmation: `ROLLBACK ${editor._config.project.id}`,
        });
        state.rollback = result;
        state.phase = "rolled-back";
        if (result?.config) editor._config = structuredClone(result.config);
      } catch (_error) {
        state.phase = "rollback-failed";
      }
      state.render();
    });
    actions.append(cancel, restore);
    confirm.append(label, input, hint, actions);
    content.append(confirm);
  }

  const actions = element("div", "glt-safe-actions");
  const dryRun = button(state.preview ? copyFor(editor, "dryRunFresh") : copyFor(editor, "dryRun"), state.preview ? "glt-safe-btn" : "glt-safe-btn primary");
  dryRun.addEventListener("click", async () => {
    state.phase = "previewing";
    state.preview = null;
    state.requested = new Set();
    state.render();
    try {
      const expected_revision = Number(editor._config?.project?.revision || 0);
      const preview = await projectAuthority(editor, "preview", {
        project_id: editor._config.project.id,
        expected_revision,
        candidate: structuredClone(editor._config),
      });
      state.preview = preview;
      state.expectedRevision = preview.base_revision;
      state.requested = new Set((preview.operations || []).map((operation) => operation.id));
      state.phase = "preview-ready";
    } catch (error) {
      state.phase = error?.code === "unavailable" ? "unavailable" : "preview-failed";
    }
    state.render();
  });
  actions.append(dryRun);
  if (state.preview && state.phase === "preview-ready") {
    const apply = button(copyFor(editor, "applySelected"), "glt-safe-btn primary");
    apply.disabled = selectedClosure(state).length === 0;
    apply.addEventListener("click", () => { state.confirmApply = true; state.render(); });
    actions.append(apply);
  }
  if (state.phase === "applied" && state.applied?.rollback_snapshot_id && !state.confirmRollback) {
    const restore = button(copyFor(editor, "restore"));
    restore.addEventListener("click", () => { state.confirmRollback = true; state.render(); });
    actions.append(restore);
  }
  content.append(actions);
}

function appendAssetTable(editor, content, assets) {
  content.append(element("h3", "", copyFor(editor, "assetMetadata")));
  const table = element("table", "glt-safe-table");
  const head = element("thead");
  const headRow = element("tr");
  const labels = [copyFor(editor, "path"), copyFor(editor, "mediaType"), copyFor(editor, "size"), copyFor(editor, "checksum")];
  for (const label of labels) headRow.append(element("th", "", label));
  head.append(headRow);
  const body = element("tbody");
  for (const asset of assets) {
    const row = element("tr");
    const values = [asset.path || asset.id || "—", asset.media_type || "—", String(asset.size ?? "—"), asset.sha256 || "—"];
    values.forEach((value, index) => {
      const cell = element("td", "glt-safe-code", value);
      cell.dataset.label = labels[index];
      row.append(cell);
    });
    body.append(row);
  }
  table.append(head, body);
  content.append(table);
}

function renderBundles(editor, state, content) {
  content.append(element("p", "glt-safe-help", copyFor(editor, "bundleEmpty")));
  appendAssetTable(editor, content, state.bundle?.assets || editor._config?.assets || []);
  const input = element("input");
  input.type = "file";
  input.accept = ".gltproject,application/zip";
  input.hidden = true;
  const inspect = button(copyFor(editor, "inspectBundle"));
  inspect.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      state.bundle = await readProjectBundleArchive(await file.arrayBuffer());
      state.bundleError = null;
    } catch (error) {
      state.bundleError = error;
    }
    state.render();
  });
  const actions = element("div", "glt-safe-actions");
  actions.append(inspect, input);
  content.append(actions);
  if (state.bundleError) content.append(status("fail", String(state.bundleError.message || state.bundleError)));
}

/**
 * Export one provenance stream on its own.
 *
 * Trusted and untrusted rows never share a file, and each file states which it
 * is: an export that merged them would be exactly as trustworthy as its least
 * trustworthy row, which is the property the two stores exist to prevent.
 */
function exportEvidence(kind, rows) {
  const provenance = kind === "trusted" ? "trusted" : "untrusted";
  const payload = JSON.stringify({
    format: "glt-flow-card-evidence-export",
    version: 1,
    provenance,
    rows,
  }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const anchor = element("a");
  anchor.href = url;
  anchor.download = `glt-${provenance}-evidence.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function evidenceView(editor, state, kind) {
  const trusted = kind === "trusted";
  const node = document.createElement("glt-flow-card-evidence-view");
  node.copy = (key, values) => copyFor(editor, key, values);
  node.props = {
    kind,
    page: trusted ? state.authority.evidence : state.authority.telemetry,
    onNext: (cursor) => {
      const load = trusted ? state.client?.evidencePage : state.client?.telemetryPage;
      load?.call(state.client, { cursor, append: true });
    },
    onExport: (rows) => exportEvidence(kind, rows),
  };
  return node;
}

function renderEvidence(editor, state, content) {
  content.append(element("h3", "", copyFor(editor, "releaseEvidence")));
  const grid = element("div", "glt-safe-grid");
  grid.append(
    card(copyFor(editor, "exactCardVersion"), window.GLTFlowCardSDK?.version || "—"),
    card(copyFor(editor, "artifactEquality"), copyFor(editor, "byteIdentical"), "dist/glt-flow-card.js = Companion www"),
  );
  content.append(grid, element("p", "glt-safe-help", copyFor(editor, "noEvidence")));

  const affordances = authorityAffordances(state.authority);
  if (!affordances.canReadEvidence) return;
  if (!state.evidenceRequested && state.client) {
    state.evidenceRequested = true;
    state.client.evidencePage();
    state.client.telemetryPage();
  }
  content.append(evidenceView(editor, state, "trusted"), evidenceView(editor, state, "telemetry"));
}

function openProjectSafety(editor, trigger) {
  editor.shadowRoot.querySelector(".glt-safe-modal")?.remove();
  const state = {
    tab: 0,
    validation: null,
    bundle: null,
    bundleError: null,
    runValidation: false,
    phase: "idle",
    preview: null,
    requested: new Set(),
    locked: new Set(),
    applied: null,
    rollback: null,
    confirmApply: false,
    confirmRollback: false,
    authority: initialAuthorityState(),
    client: null,
    accessSurface: false,
    access: { loading: false, inventory: null, error: null, pending: null, busy: false, notice: null, lastCode: null },
    evidenceRequested: false,
    collaboration: initialCollaborationState(),
    collaborationController: null,
    control: initialControlState(),
    controlClient: null,
  };
  const modal = element("div", "glt-safe-modal");
  const dialog = element("section", "glt-safe-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  const titleId = `glt-safe-title-${Math.random().toString(36).slice(2)}`;
  dialog.setAttribute("aria-labelledby", titleId);
  const head = element("header", "glt-safe-head");
  const headingWrap = element("div");
  const heading = element("h2", "", copyFor(editor, "title"));
  heading.id = titleId;
  const project = editor._config?.project || {};
  const meta = element("div", "glt-safe-meta");
  meta.append(element("span", "", project.name || project.id || "—"), element("span", "", `${copyFor(editor, "schema")} ${editor._config?.schema_version ?? "—"}`), element("span", "", `${copyFor(editor, "revision")} ${project.revision ?? 0}`));
  headingWrap.append(heading, meta);
  const close = button("×", "glt-safe-close");
  close.setAttribute("aria-label", copyFor(editor, "close"));
  head.append(headingWrap, close);
  const banner = element("div", "glt-safe-banner", copyFor(editor, "scope"));
  const tabs = element("div", "glt-safe-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", copyFor(editor, "title"));
  const content = element("main", "glt-safe-content");
  const authority = document.createElement("glt-flow-card-project-authority");
  authority.copy = (key, values) => copyFor(editor, key, values);
  const footer = element("footer", "glt-safe-footer");
  const footerClose = button(copyFor(editor, "close"));
  footer.append(footerClose);
  dialog.append(head, banner, authority, tabs, content, footer);
  modal.append(dialog);
  editor.shadowRoot.append(modal);

  const closeDialog = () => {
    authority.release();
    modal.remove();
    trigger.focus();
  };
  close.addEventListener("click", closeDialog);
  footerClose.addEventListener("click", closeDialog);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeDialog();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = focusable(dialog);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes.at(-1);
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first.focus();
    }
  });

  state.render = () => {
    const focused = dialog.contains(editor.shadowRoot.activeElement);
    tabs.replaceChildren();
    const labels = copyFor(editor, "tabs");
    labels.forEach((label, index) => {
      const tab = button(label, "glt-safe-tab");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(index === state.tab));
      tab.tabIndex = index === state.tab ? 0 : -1;
      tab.addEventListener("click", () => {
        state.tab = index;
        state.render();
      });
      tab.addEventListener("keydown", (event) => {
        const movement = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (movement === undefined && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        state.tab = event.key === "Home" ? 0 : event.key === "End" ? labels.length - 1 : (index + movement + labels.length) % labels.length;
        state.render();
        tabs.querySelectorAll('[role="tab"]')[state.tab].focus();
      });
      tabs.append(tab);
    });
    content.replaceChildren();
    if (!editor._hass?.callWS) {
      const unavailable = element("div", "glt-safe-banner readonly", copyFor(editor, "standalone"));
      content.append(unavailable);
    }
    if (state.tab === 0) renderOverview(editor, state, content);
    if (state.tab === 1) renderValidation(editor, state, content);
    if (state.tab === 2) renderMigration(editor, state, content);
    if (state.tab === 3) renderBundles(editor, state, content);
    if (state.tab === 4) renderEvidence(editor, state, content);
    // An action removed by an authority change must not take the focus ring
    // with it: park focus on the section heading and let the live region say
    // why, rather than dropping focus to the document.
    if (focused && !dialog.contains(editor.shadowRoot.activeElement)) {
      const target = content.querySelector("h3");
      if (target) {
        target.tabIndex = -1;
        target.focus();
      }
    }
  };

  authority.addEventListener("glt-authority-change", (event) => {
    state.authority = event.detail.state;
    state.render();
  });
  state.client = authority.connect({ hass: editor._hass, projectId: project.id });
  state.authority = authority.authorityState;
  if (state.client) {
    state.collaborationController = createCollaborationController({
      client: state.client,
      onChange: (next) => {
        state.collaboration = next;
        state.render();
      },
    });
    state.controlClient = createConfiguredControlClient({
      hass: editor._hass,
      projectId: project.id,
      onChange: (next) => {
        state.control = next;
        state.render();
      },
    });
  }
  state.render();
  state.client?.refresh().catch(() => {
    // The client has already made shared mode read-only with a stable reason.
  });
  queueMicrotask(() => close.focus());
}

function installProjectSafety(editor) {
  const root = editor.shadowRoot;
  if (!root) return;
  if (!root.querySelector("style[data-glt-project-safety]")) {
    const style = element("style");
    style.dataset.gltProjectSafety = "1";
    style.textContent = STYLE;
    root.append(style);
  }
  const projects = root.querySelector('.glt4-bar [data-g4="projects"]');
  if (!projects) return;
  const existing = root.querySelector("[data-glt-project-safety-trigger]");
  const label = copyFor(editor, "title");
  if (existing) {
    existing.textContent = label;
    existing.setAttribute("aria-label", label);
    return;
  }
  const trigger = button(label, "glt4-btn glt-safe-trigger");
  trigger.dataset.gltProjectSafetyTrigger = "1";
  trigger.setAttribute("aria-label", label);
  trigger.addEventListener("click", () => openProjectSafety(editor, trigger));
  projects.after(trigger);
}

if (Editor) {
  const originalRender = Editor.prototype._render;
  Editor.prototype._render = function projectSafetyRender() {
    const result = originalRender.call(this);
    installProjectSafety(this);
    return result;
  };
  const hassDescriptor = Object.getOwnPropertyDescriptor(Editor.prototype, "hass");
  if (hassDescriptor?.set) {
    Object.defineProperty(Editor.prototype, "hass", {
      configurable: true,
      get: hassDescriptor.get,
      set(value) {
        hassDescriptor.set.call(this, value);
        installProjectSafety(this);
      },
    });
  }
  if (window.GLTFlowCardSDK) window.GLTFlowCardSDK.projectSafety = { version: 1, tabs: 5 };
}
