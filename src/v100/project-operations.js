/* Phase-4 surfaces: the object panel, drill-down, breadcrumbs, outcomes, staleness.
 *
 * These render what the server decided and nothing else. There is no capability
 * check here, no control list assembled from a profile, no count computed from
 * a cached tree: each of those would be the browser-derived authority Phase 2
 * exists to forbid, and each would be wrong in a way the operator could not see.
 *
 * Two rules run through every element. A state is carried by text and shape as
 * well as colour, because the control-room kiosk runs in forced colours and has
 * no pointer. And a view that has lost track says so, permanently and visibly,
 * because a hidden staleness indicator is indistinguishable from a fresh view.
 */

import { statusColourStyles } from "./status-colours.mjs";
import { defineElement } from "./element-registry.mjs";
import { hasWording, template as catalogTemplate, text as catalogText } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";

import { presentOutcome } from "./command-outcome.mjs";
import { reducePanel } from "./panel-model.mjs";

const STYLE = `${statusColourStyles()}
  .glt-ops{font:14px/1.5 Inter,ui-sans-serif,system-ui,sans-serif;display:block;max-width:100%}
  /* German is materially longer than English, and the narrow layout is 320px.
     Wrapping is the default here rather than an afterthought; nothing in this
     file may make the page itself scroll sideways. */
  .glt-ops,.glt-ops *{min-width:0;overflow-wrap:anywhere}
  .glt-ops-region{padding:8px 0;border-top:1px solid var(--brd,#1e3346)}
  .glt-ops-region:first-child{border-top:0}
  .glt-ops-kind{font:700 12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--glt-muted,#5f7288);text-transform:uppercase;letter-spacing:.06em}
  .glt-ops-values{margin:4px 0 0;padding:0;list-style:none;display:grid;gap:4px}
  .glt-ops-value{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
  .glt-ops-unit{color:var(--glt-muted,#5f7288);font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
  .glt-ops-empty{color:var(--glt-muted,#5f7288);font-style:italic}
  .glt-ops-crumbs{display:flex;flex-wrap:wrap;gap:4px;margin:0;padding:0;list-style:none}
  .glt-ops-crumb{display:inline-flex;align-items:center;min-height:44px;gap:4px}
  .glt-ops-crumb a{color:inherit}
  .glt-ops-crumb[aria-current="page"]{font-weight:700}
  .glt-ops-list{margin:0;padding:0;list-style:none;display:grid;gap:4px}
  .glt-ops-item{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-height:44px;padding:4px 8px;border-radius:8px}
  .glt-ops-count{font:700 12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;border:1px solid currentColor;border-radius:999px;padding:2px 8px}
  .glt-ops-outcome{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-height:44px;padding:4px 12px;border:1px solid currentColor;border-radius:8px;font-weight:700}
  .glt-ops-outcome[data-tone="success"]{color:var(--glt-success,#0b6b38)}
  .glt-ops-outcome[data-tone="warning"]{color:var(--glt-warning,#8a5200)}
  .glt-ops-outcome[data-tone="error"]{color:var(--glt-error,#b3261e)}
  .glt-ops-outcome[data-tone="neutral"]{color:var(--glt-muted,#5f7288)}
  .glt-ops-mark{font:700 14px/1 ui-monospace,SFMono-Regular,Consolas,monospace}
  .glt-ops-stale{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-height:44px;padding:4px 12px;border:1px solid currentColor;border-radius:8px}
  .glt-ops-stale[data-status="live"]{color:var(--glt-success,#0b6b38)}
  .glt-ops-stale[data-status="resyncing"]{color:var(--glt-info,#0f6d99)}
  .glt-ops-stale[data-status="stale"]{color:var(--glt-warning,#8a5200)}
  .glt-ops-stale[data-status="unavailable"]{color:var(--glt-error,#b3261e)}
  /* Dimming was 60 % opacity, which took a 6.39:1 warning colour down to
     2.73:1 — the strip that says "this view is not live" was the least legible
     thing on the screen. Staleness is carried by the mark, the word and the
     border; it does not need to be carried by being harder to read. */
  .glt-ops-dim{font-style:italic}
  .glt-ops :focus-visible{outline:2px solid currentColor;outline-offset:2px}
  @media(forced-colors:active){
    .glt-ops-outcome,.glt-ops-stale,.glt-ops-count{border:1px solid CanvasText}
  }
`;

/**
 * Local wording names, mapped to their catalog keys.
 *
 * The wording itself lives in `catalog-de.mjs` and `catalog-en.mjs`. It used
 * to live here as a `COPY` table, which is what made a third locale a code
 * edit in every module that renders anything: a locale is now a catalog, and a
 * catalog is data.
 *
 * This map exists so the call sites below keep naming the string they mean
 * rather than a namespaced key, including the ones that compute a name.
 */
const KEYS = Object.freeze({
  "affordance_audit": "operations.affordance_audit",
  "affordance_cancel": "operations.affordance_cancel",
  "affordance_dismiss": "operations.affordance_dismiss",
  "affordance_state": "operations.affordance_state",
  "history_unavailable": "operations.history_unavailable",
  "last_updated": "operations.last_updated",
  "no_alarms": "operations.no_alarms",
  "no_controls_available": "operations.no_controls_available",
  "no_values_declared": "operations.no_values_declared",
  "outcome_accepted": "operations.outcome_accepted",
  "outcome_cancelled": "operations.outcome_cancelled",
  "outcome_confirmed": "operations.outcome_confirmed",
  "outcome_denied": "operations.outcome_denied",
  "outcome_dispatched": "operations.outcome_dispatched",
  "outcome_failed_after_dispatch": "operations.outcome_failed_after_dispatch",
  "outcome_failed_before_dispatch": "operations.outcome_failed_before_dispatch",
  "outcome_result_unknown": "operations.outcome_result_unknown",
  "outcome_timed_out": "operations.outcome_timed_out",
  "status_live": "operations.status_live",
  "status_resyncing": "operations.status_resyncing",
  "status_stale": "operations.status_stale",
  "status_unavailable": "operations.status_unavailable",
  "view_not_available": "operations.view_not_available",
});

// Every name this module renders must resolve in the catalog, in both
// languages. Cross-language completeness is now computed once for every
// namespace in `test/catalog-completeness.test.mjs`; what stays here is the
// half only this module knows — that the names *it* uses exist at all.
for (const catalogKey of Object.values(KEYS)) {
  for (const language of ["de", "en"]) {
    if (!hasWording(catalogKey, language)) {
      throw new Error(`project-operations renders ${catalogKey}, which has no ${language} wording`);
    }
  }
}

/** The wording this module renders, by language. Assembled from the catalog. */
export const PROJECT_OPERATIONS_COPY = Object.freeze(Object.fromEntries(
  ["de", "en"].map((language) => [
    language,
    Object.freeze(Object.fromEntries(
      Object.entries(KEYS).map(([local, catalogKey]) => [local, catalogTemplate(catalogKey, language)]),
    )),
  ]),
));

/**
 * Resolve one operations string through the catalog.
 *
 * **There is no fallback.** The three spellings this replaces across nine
 * modules resolved a missing key to the English string or to the raw key, and
 * neither is visible to anyone except the operator it fails: a German operator
 * saw an English sentence, indistinguishable from a term deliberately left in
 * English. An unknown name throws instead, naming what is missing.
 */
function textFor(language, key, values = {}) {
  const catalogKey = KEYS[key];
  if (!catalogKey) throw new Error(`no wording named ${JSON.stringify(key)}`);
  return catalogText(catalogKey, language, values);
}

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

/** Shared plumbing: one `props` assignment in, one repaint out. */
class GltOperationsElement extends HTMLElement {
  constructor() {
    super();
    this._props = {};
  }

  set props(value) {
    this._props = value ?? {};
    this.render();
  }

  get props() {
    return this._props;
  }

  get language() {
    return this._props.language === "de" ? "de" : "en";
  }

  connectedCallback() {
    this.classList.add("glt-ops");
    this.render();
  }

  render() {
    this.textContent = "";
  }
}

/** The profile-driven object panel. Renders the server's regions, in order. */
class GltObjectPanel extends GltOperationsElement {
  render() {
    this.textContent = "";
    const response = this._props.panel;
    if (!response) return;

    let reduced;
    try {
      reduced = reducePanel(response);
    } catch (error) {
      // An undeclared region kind is a server change this browser has not been
      // taught about. Saying so beats rendering a partial panel that looks whole.
      this.append(element("p", "glt-ops-empty", error.message));
      return;
    }

    this.setAttribute("role", "region");
    for (const region of reduced.regions) {
      const block = element("section", "glt-ops-region");
      block.dataset.kind = region.kind;
      block.append(element("h3", "glt-ops-kind", region.kind));

      if (region.kind === "identity") {
        block.append(element("p", null, region.name ?? ""));
        if (Array.isArray(region.path)) {
          block.append(element("p", "glt-ops-unit", region.path.join(" › ")));
        }
      } else if (region.kind === "state") {
        const badge = document.createElement("glt-flow-card-state-badge");
        badge.props = { state: region.state, language: this.language };
        block.append(badge);
      } else if (region.kind === "values" || region.kind === "runtime") {
        if (region.empty) {
          block.append(element("p", "glt-ops-empty", textFor(this.language, region.emptyText)));
        } else {
          const list = element("ul", "glt-ops-values");
          for (const value of region.values ?? []) {
            const row = element("li", "glt-ops-value");
            row.append(element("span", null, value.label ?? value.id));
            row.append(element("strong", null, value.value ?? "—"));
            if (value.unit) row.append(element("span", "glt-ops-unit", value.unit));
            list.append(row);
          }
          block.append(list);
        }
      } else if (region.kind === "quality") {
        const card = document.createElement("glt-flow-card-provenance-card");
        card.props = { row: region, language: this.language };
        block.append(card);
      } else if (region.kind === "alarms") {
        if (region.empty) {
          block.append(element("p", "glt-ops-empty", textFor(this.language, region.emptyText)));
        } else {
          const list = element("ul", "glt-ops-list");
          for (const alarm of region.alarms ?? []) {
            const row = element("li", "glt-ops-item");
            row.append(element("span", "glt-ops-mark", alarm.severity === "fault" ? "✕" : "!"));
            row.append(element("span", null, alarm.label ?? alarm.id));
            list.append(row);
          }
          block.append(list);
        }
      } else if (region.kind === "controls") {
        if (region.empty) {
          // Absent, not disabled: a disabled control still announces that the
          // control exists, which is the enumeration this region prevents.
          block.append(element("p", "glt-ops-empty", textFor(this.language, region.emptyText)));
        } else {
          const list = element("ul", "glt-ops-list");
          for (const control of region.controls ?? []) {
            const row = element("li", "glt-ops-item");
            const button = element("button", null, labelOf(control.label, this.language));
            button.type = "button";
            button.dataset.controlId = control.control_id;
            button.addEventListener("click", () => {
              // The panel carries no domain, service or target, so this can
              // only ask the host to confirm a control id.
              this.dispatchEvent(new CustomEvent("glt-control-requested", {
                detail: { controlId: control.control_id },
                bubbles: true,
                composed: true,
              }));
            });
            row.append(button);
            list.append(row);
          }
          block.append(list);
        }
      } else if (region.kind === "trend") {
        block.append(element("p", "glt-ops-empty", textFor(this.language, region.state)));
      }
      this.append(block);
    }
  }
}

function labelOf(label, language) {
  if (typeof label === "string") return label;
  if (label && typeof label === "object") return label[language] ?? label.en ?? "";
  return "";
}

/** Breadcrumbs, built from the server-returned ancestry only. */
class GltBreadcrumbs extends GltOperationsElement {
  render() {
    this.textContent = "";
    const crumbs = this._props.crumbs ?? [];
    const nav = element("nav");
    nav.setAttribute("aria-label", "Breadcrumb");
    const list = element("ol", "glt-ops-crumbs");
    for (const crumb of crumbs) {
      const item = element("li", "glt-ops-crumb");
      if (crumb.current) {
        item.setAttribute("aria-current", "page");
        item.append(element("span", null, crumb.name));
      } else {
        const link = element("a", null, crumb.name);
        // The address carries the time window and selected alarm, so a
        // breadcrumb preserves context rather than resetting it.
        link.href = `#${crumb.address}`;
        item.append(link);
      }
      list.append(item);
    }
    nav.append(list);
    this.append(nav);
  }
}

/** The authorized children of the current node, with their counts. */
class GltDrilldownList extends GltOperationsElement {
  render() {
    this.textContent = "";
    const children = this._props.children ?? [];
    const list = element("ul", "glt-ops-list");
    for (const child of children) {
      const row = element("li", "glt-ops-item");
      const link = element("a", null, child.name ?? child.id);
      link.href = `#${child.address ?? child.id}`;
      row.append(link);
      if (child.level) row.append(element("span", "glt-ops-unit", child.level));
      // A count is rendered only when the server sent one. An absent count and
      // a zero must not be distinguishable, so nothing is defaulted here.
      for (const [severity, value] of Object.entries(child.counts ?? {})) {
        row.append(element("span", "glt-ops-count", `${severity}: ${value}`));
      }
      list.append(row);
    }
    this.append(list);
  }
}

/** One command outcome, with its correlation id and no retry. */
class GltOutcomeStrip extends GltOperationsElement {
  render() {
    this.textContent = "";
    const state = this._props.state;
    if (!state) return;

    let outcome;
    try {
      outcome = presentOutcome({
        state,
        correlation_id: this._props.correlationId,
        elapsedSeconds: this._props.elapsedSeconds,
      });
    } catch (error) {
      this.append(element("p", "glt-ops-empty", error.message));
      return;
    }

    const strip = element("div", "glt-ops-outcome");
    strip.dataset.tone = outcome.tone;
    strip.dataset.state = outcome.state;
    // Announced politely: outcome transitions are frequent, and an assertive
    // region would make the kiosk unusable with a screen reader.
    strip.setAttribute("role", "status");
    strip.setAttribute("aria-live", "polite");
    // Text and a mark, never colour alone.
    strip.append(element("span", "glt-ops-mark", MARKS[outcome.tone] ?? "•"));
    strip.append(element("span", null, textFor(this.language, outcome.label)));
    if (outcome.elapsedSeconds !== null) {
      strip.append(element("span", "glt-ops-unit", `${outcome.elapsedSeconds}s`));
    }
    if (outcome.correlationId) {
      strip.append(element("span", "glt-ops-unit", outcome.correlationId));
    }
    for (const affordance of outcome.affordances) {
      const button = element("button", null, textFor(this.language, `affordance_${affordance}`));
      button.type = "button";
      button.dataset.affordance = affordance;
      strip.append(button);
    }
    this.append(strip);
  }
}

const MARKS = { success: "✓", warning: "!", error: "✕", neutral: "•" };

/** The persistent staleness indicator. Never hidden. */
class GltViewStaleness extends GltOperationsElement {
  render() {
    this.textContent = "";
    const view = this._props.view ?? { status: "stale" };
    const strip = element("div", "glt-ops-stale");
    strip.dataset.status = view.status;
    strip.setAttribute("role", "status");
    strip.setAttribute("aria-live", "polite");
    strip.append(element("span", "glt-ops-mark", STATUS_MARKS[view.status] ?? "•"));
    strip.append(element("span", null, textFor(this.language, `status_${view.status}`)));
    if (view.reason) strip.append(element("span", "glt-ops-unit", view.reason));
    if (view.status !== "live" && view.observedAt) {
      strip.append(element(
        "span",
        "glt-ops-unit",
        `${textFor(this.language, "last_updated")}: ${new Date(view.observedAt).toISOString()}`,
      ));
    }
    if (view.status !== "live") strip.classList.add("glt-ops-dim");
    this.append(strip);
  }
}

const STATUS_MARKS = { live: "●", resyncing: "↻", stale: "!", unavailable: "✕" };

if (typeof document !== "undefined" && !document.querySelector("style[data-glt-operations]")) {
  const style = element("style");
  style.dataset.gltOperations = "1";
  style.textContent = STYLE;
  document.head?.append(style);
}

for (const [name, constructor] of [
  ["glt-flow-card-object-panel", GltObjectPanel],
  ["glt-flow-card-breadcrumbs", GltBreadcrumbs],
  ["glt-flow-card-drilldown-list", GltDrilldownList],
  ["glt-flow-card-outcome-strip", GltOutcomeStrip],
  ["glt-flow-card-view-staleness", GltViewStaleness],
]) {
  defineElement(name, constructor);
}
