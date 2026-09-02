/* Phase-6 alarm and schedule surfaces.
 *
 * One rule governs all of them, and it is the whole point of the phase: **these
 * elements display state they were given and derive none of their own.** Every
 * "is this active", "is this suppressed", "did this notify" and "when does this
 * next run" is a value that arrived from the Companion. Four derivations of the
 * first question disagreed with each other before this, and the authoritative
 * one was displayed nowhere.
 *
 * Three more, from the UI contract:
 *
 * **Nothing is distinguished by colour alone.** Priority is a word *and* a
 * shape. A red dot is no information at all on a monochrome kiosk, in forced
 * colours, or to a screen reader.
 *
 * **A suppressed row says why and until when.** "Quiet" without a reason is
 * exactly the defect shelving shipped: a field that reported success and did
 * nothing, while the operator believed the alarm was silenced.
 *
 * **A failed delivery is visible on the row, and the alarm is not downgraded
 * for it.** An alarm nobody could be told about is more urgent than one they
 * were told about, not less -- so it is not hidden, not sorted below the
 * successful ones, and not marked handled.
 *
 * Operator text -- an acknowledgement comment, an alarm name, a schedule name
 * -- is set as text content and never interpolated into markup. One operator
 * writes it and another reads it.
 */

import { defineElement } from "./element-registry.mjs";
import { hasWording, text as catalogText } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";

import {
  ALARM_PRIORITIES,
  SUPPRESSION_REASONS,
  migrateSeverity,
  priorityRank,
} from "./alarm-vocabulary.mjs";
import {
  DEFAULT_AMBIGUOUS_POLICY,
  DEFAULT_NONEXISTENT_POLICY,
  resolveEntry,
} from "./schedule-time.mjs";

const STYLE = `
  .glt-alm{font:14px/1.5 Inter,ui-sans-serif,system-ui,sans-serif;display:block;max-width:100%}
  .glt-alm,.glt-alm *{min-width:0;overflow-wrap:anywhere}
  .glt-alm-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
  .glt-alm-row{display:grid;gap:4px;padding:8px;border:1px solid currentColor;border-radius:8px}
  .glt-alm-head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}
  .glt-alm-shape{font:700 14px/1 ui-monospace,SFMono-Regular,Consolas,monospace}
  .glt-alm-priority{font-weight:700;text-transform:uppercase;letter-spacing:.04em;font-size:12px}
  .glt-alm-meta{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--mut,#8198ad)}
  .glt-alm-suppressed{font-style:italic}
  .glt-alm-failed{font-weight:700;border:1px solid currentColor;border-radius:8px;padding:2px 8px;display:inline-block}
  .glt-alm-empty{color:var(--mut,#8198ad);font-style:italic;padding:8px 0}
  .glt-alm-actions{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0}
  .glt-alm-actions button{min-height:44px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit;padding:0 12px;cursor:pointer}
  .glt-alm label{display:inline-flex;flex-direction:column;gap:2px;font:12px/1.4 inherit}
  .glt-alm input,.glt-alm select{min-height:44px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit;padding:0 8px}
  .glt-alm-attempts{display:grid;gap:4px;margin:0;padding:0;list-style:none}
  .glt-alm-preview{display:grid;gap:4px;margin:0;padding:0;list-style:none}
  .glt-alm-preview li{padding:8px;border:1px solid currentColor;border-radius:8px}
  .glt-alm :focus-visible{outline:2px solid currentColor;outline-offset:2px}
  @media(forced-colors:active){
    .glt-alm-row,.glt-alm-failed,.glt-alm-preview li{border:1px solid CanvasText}
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
  "acknowledge": "alarms.acknowledge",
  "alarms_title": "alarms.alarms_title",
  "attempts_title": "alarms.attempts_title",
  "binding_read_only": "alarms.binding_read_only",
  "cancel": "alarms.cancel",
  "comment": "alarms.comment",
  "confirm": "alarms.confirm",
  "delivery_failed": "alarms.delivery_failed",
  "delivery_none": "alarms.delivery_none",
  "links_title": "alarms.links_title",
  "no_alarms": "alarms.no_alarms",
  "preview_ambiguous": "alarms.preview_ambiguous",
  "preview_ambiguous_tail": "alarms.preview_ambiguous_tail",
  "preview_nonexistent": "alarms.preview_nonexistent",
  "preview_nonexistent_tail": "alarms.preview_nonexistent_tail",
  "preview_normal": "alarms.preview_normal",
  "priority_critical": "alarms.priority_critical",
  "priority_info": "alarms.priority_info",
  "priority_warning": "alarms.priority_warning",
  "schedule_kind_instant": "alarms.schedule_kind_instant",
  "schedule_kind_interval": "alarms.schedule_kind_interval",
  "schedule_preview": "alarms.schedule_preview",
  "schedule_title": "alarms.schedule_title",
  "setting_default": "alarms.setting_default",
  "settings_title": "alarms.settings_title",
  "shelve": "alarms.shelve",
  "shelve_minutes": "alarms.shelve_minutes",
  "shelve_too_long": "alarms.shelve_too_long",
  "state_acknowledged": "alarms.state_acknowledged",
  "state_active": "alarms.state_active",
  "state_indeterminate": "alarms.state_indeterminate",
  "state_returned": "alarms.state_returned",
  "state_suppressed": "alarms.state_suppressed",
  "suppressed_acknowledged": "alarms.suppressed_acknowledged",
  "suppressed_by": "alarms.suppressed_by",
  "suppressed_maintenance": "alarms.suppressed_maintenance",
  "suppressed_shelved": "alarms.suppressed_shelved",
  "suppressed_until": "alarms.suppressed_until",
});

/**
 * Shapes carrying priority without colour.
 *
 * Distinct glyphs rather than distinct fills, so the difference survives a
 * monochrome kiosk, forced colours and a screen reader reading the row aloud.
 */
const PRIORITY_SHAPES = { critical: "◆", warning: "▲", info: "●" };

/**
 * Resolve one alarm string through the catalog.
 *
 * **There is no fallback.** The three spellings this replaces across nine
 * modules resolved a missing key to the English string or to the raw key, and
 * neither is visible to anyone except the operator it fails: a German operator
 * saw an English sentence, indistinguishable from a term deliberately left in
 * English. An unknown name throws instead, naming what is missing.
 */
function copy(language, key, values = {}) {
  const catalogKey = KEYS[key];
  if (!catalogKey) throw new Error(`no wording named ${JSON.stringify(key)}`);
  return catalogText(catalogKey, language, values);
}

/** Build one element with text content. Never markup: operators write this. */
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function priorityOf(row) {
  return migrateSeverity(row?.priority ?? row?.severity).priority;
}

class GltAlarmElement extends HTMLElement {
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
    this.classList.add("glt-alm");
    this.render();
  }

  render() {
    this.textContent = "";
  }
}

/**
 * The authoritative alarm list.
 *
 * Sorts, filters and phrases. Decides nothing: `active`, `suppression` and
 * `last_delivery` all arrive from `glt_flow_card/alarms/list`.
 */
class GltAlarmList extends GltAlarmElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const alarms = Array.isArray(this._props.alarms) ? this._props.alarms : [];

    if (alarms.length === 0) {
      // Says there are none, rather than rendering an empty container that
      // reads as a loading state forever.
      this.append(element("p", "glt-alm-empty", copy(language, "no_alarms")));
      return;
    }

    if (this._props.targetsConfigured === false) {
      // The conservative default made legible instead of made invisible.
      this.append(element("p", "glt-alm-meta", copy(language, "delivery_none")));
    }

    const list = element("ul", "glt-alm-list");
    // Most severe first, and a failed delivery is *not* sorted below a
    // successful one -- an alarm nobody could be told about is more urgent.
    const ordered = [...alarms].sort((a, b) => (
      priorityRank(priorityOf(a)) - priorityRank(priorityOf(b))
    ));
    for (const alarm of ordered) list.append(this.row(alarm, language));
    this.append(list);
  }

  row(alarm, language) {
    const item = element("li", "glt-alm-row");
    item.setAttribute("data-alarm", String(alarm.id ?? ""));

    const priority = priorityOf(alarm);
    const head = element("div", "glt-alm-head");
    const shape = element("span", "glt-alm-shape", PRIORITY_SHAPES[priority]);
    shape.setAttribute("data-priority-shape", priority);
    shape.setAttribute("aria-hidden", "true");
    head.append(shape);
    const label = element("span", "glt-alm-priority", copy(language, `priority_${priority}`));
    label.setAttribute("data-priority", priority);
    head.append(label);

    const suppression = alarm.suppression;
    const stateKey = suppression ? "state_suppressed" : `state_${alarm.state || "active"}`;
    const state = element("span", "glt-alm-meta", copy(language, stateKey));
    state.setAttribute("data-state", suppression ? "suppressed" : String(alarm.state || "active"));
    head.append(state);
    item.append(head);

    // The operator's own words, as text content.
    item.append(element("div", null, alarm.name ?? alarm.id ?? ""));

    if (suppression) {
      const reason = SUPPRESSION_REASONS.includes(suppression.reason)
        ? copy(language, `suppressed_${suppression.reason}`)
        : String(suppression.reason ?? "");
      const parts = [reason];
      if (suppression.by) parts.push(`${copy(language, "suppressed_by")} ${suppression.by}`);
      if (suppression.until) parts.push(`${copy(language, "suppressed_until")} ${suppression.until}`);
      const line = element("div", "glt-alm-suppressed", parts.join(" · "));
      line.setAttribute("data-suppression", String(suppression.reason ?? ""));
      item.append(line);
    }

    const delivery = alarm.delivery ?? alarm.last_delivery;
    if (delivery && delivery.outcome && delivery.outcome !== "delivered") {
      const failed = element(
        "div", "glt-alm-failed",
        `${copy(language, "delivery_failed")}: ${delivery.error ?? delivery.outcome}`,
      );
      failed.setAttribute("data-delivery-failed", String(delivery.outcome));
      item.append(failed);
    }

    return item;
  }
}

/** One alarm: its history, its delivery attempts, and its context links. */
class GltAlarmDetail extends GltAlarmElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const alarm = this._props.alarm;
    if (!alarm) {
      this.append(element("p", "glt-alm-empty", copy(language, "no_alarms")));
      return;
    }

    this.append(element("h3", null, alarm.name ?? alarm.id ?? ""));

    const acknowledgement = alarm.acknowledgement;
    if (acknowledgement) {
      // The comment is one operator's text read by another. Text content, never
      // markup, and never `innerHTML`.
      const line = element("p", null, acknowledgement.comment ?? "");
      line.setAttribute("data-ack-comment", "");
      this.append(line);
      this.append(element("p", "glt-alm-meta",
        `${copy(language, "suppressed_by")} ${acknowledgement.by ?? ""} ${acknowledgement.at ?? ""}`));
    }

    const attempts = Array.isArray(alarm.delivery_attempts) ? alarm.delivery_attempts : [];
    this.append(element("h4", null, copy(language, "attempts_title")));
    if (attempts.length === 0) {
      this.append(element("p", "glt-alm-meta", copy(language, "delivery_none")));
    } else {
      const list = element("ul", "glt-alm-attempts");
      for (const attempt of attempts) {
        const row = element("li", "glt-alm-meta", [
          attempt.at, attempt.service,
          (attempt.target || []).join(", "),
          attempt.outcome, attempt.error,
        ].filter(Boolean).join(" · "));
        row.setAttribute("data-attempt", String(attempt.outcome ?? ""));
        list.append(row);
      }
      this.append(list);
    }

    const links = alarm.links ?? {};
    const targets = Object.entries(links).filter(([, value]) => Boolean(value));
    if (targets.length > 0) {
      this.append(element("h4", null, copy(language, "links_title")));
      const list = element("ul", "glt-alm-list");
      for (const [kind, address] of targets) {
        const anchor = element("a", null, `${kind}: ${address}`);
        anchor.setAttribute("data-link", kind);
        anchor.href = `#${address}`;
        list.append(element("li", null)).append(anchor);
      }
      this.append(list);
    }
  }
}

/**
 * Acknowledge and shelve.
 *
 * Both post and re-read; neither paints optimistically. An optimistic
 * acknowledgement the server refused is a lie the operator will act on.
 *
 * The shelve control offers only durations within the site maximum and says why
 * when it refuses -- while the server enforces the same bound independently.
 * The browser check is UX; every phase since Phase 2 has required that.
 */
class GltAlarmActions extends GltAlarmElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const maximumDays = Number(this._props.shelvingMaximumDays ?? 7);
    const maximumMinutes = Math.max(1, Math.round(maximumDays * 24 * 60));

    const form = element("div", "glt-alm-actions");

    const comment = element("label", null, copy(language, "comment"));
    const commentInput = document.createElement("input");
    commentInput.type = "text";
    commentInput.setAttribute("data-ack-comment", "");
    comment.append(commentInput);
    form.append(comment);

    const acknowledge = element("button", null, copy(language, "acknowledge"));
    acknowledge.type = "button";
    acknowledge.setAttribute("data-acknowledge", "");
    acknowledge.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("glt-acknowledge", {
        bubbles: true,
        detail: { alarmId: this._props.alarmId, comment: commentInput.value },
      }));
    });
    form.append(acknowledge);

    const minutes = element("label", null, copy(language, "shelve_minutes"));
    const minutesInput = document.createElement("input");
    minutesInput.type = "number";
    minutesInput.min = "1";
    minutesInput.max = String(maximumMinutes);
    minutesInput.value = "60";
    minutesInput.setAttribute("data-shelve-minutes", "");
    minutes.append(minutesInput);
    form.append(minutes);

    const refusal = element("span", "glt-alm-meta", "");
    refusal.setAttribute("data-shelve-refusal", "");
    refusal.setAttribute("role", "status");
    refusal.setAttribute("aria-live", "polite");

    const shelve = element("button", null, copy(language, "shelve"));
    shelve.type = "button";
    shelve.setAttribute("data-shelve", "");
    shelve.addEventListener("click", () => {
      const requested = Number(minutesInput.value);
      if (!Number.isFinite(requested) || requested < 1 || requested > maximumMinutes) {
        // Refused here with the reason, and refused again at the server. This
        // one is a courtesy; that one is the enforcement.
        refusal.textContent = copy(language, "shelve_too_long");
        return;
      }
      refusal.textContent = "";
      this.dispatchEvent(new CustomEvent("glt-shelve", {
        bubbles: true,
        detail: { alarmId: this._props.alarmId, minutes: requested },
      }));
    });
    form.append(shelve);
    form.append(refusal);
    this.append(form);
  }
}

/**
 * The site's alarm philosophy, shown as decisions rather than as facts.
 *
 * Every setting carries its current value, its default and one sentence on what
 * it means. Where a default means "nobody is notified", the surface says so
 * rather than leaving it to be discovered during an incident.
 */
class GltAlarmSettings extends GltAlarmElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const settings = Array.isArray(this._props.settings) ? this._props.settings : [];
    this.append(element("h3", null, copy(language, "settings_title")));

    if (this._props.targetsConfigured === false) {
      const line = element("p", "glt-alm-meta", copy(language, "delivery_none"));
      line.setAttribute("data-no-targets", "");
      this.append(line);
    }

    const list = element("ul", "glt-alm-list");
    for (const setting of settings) {
      const item = element("li", "glt-alm-row");
      item.setAttribute("data-setting", String(setting.key ?? ""));
      item.append(element("div", null, setting.label ?? setting.key ?? ""));
      item.append(element("div", "glt-alm-meta",
        `${setting.value} (${copy(language, "setting_default")}: ${setting.default})`));
      item.append(element("p", null, setting.why ?? ""));
      list.append(item);
    }
    this.append(list);

    // The one deliberate exception, said out loud rather than left implicit.
    const fixed = element("p", "glt-alm-meta", this._props.vocabularyNote ?? "");
    fixed.setAttribute("data-vocabulary-fixed", ALARM_PRIORITIES.join(","));
    this.append(fixed);
  }
}

/** The schedule editor: entries, their binding, and what the binding cannot do. */
class GltScheduleEditor extends GltAlarmElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const entries = Array.isArray(this._props.schedules) ? this._props.schedules : [];
    this.append(element("h3", null, copy(language, "schedule_title")));

    const list = element("ul", "glt-alm-list");
    for (const entry of entries) {
      const item = element("li", "glt-alm-row");
      item.setAttribute("data-schedule", String(entry.id ?? ""));
      item.append(element("div", null, entry.name ?? entry.id ?? ""));

      // Instant and interval are different concepts, and the UI does not blur
      // them because Home Assistant does not either.
      const kind = entry.kind === "interval" ? "interval" : "instant";
      const kindLabel = element("div", "glt-alm-meta", copy(language, `schedule_kind_${kind}`));
      kindLabel.setAttribute("data-schedule-kind", kind);
      item.append(kindLabel);

      const binding = entry.binding;
      if (binding) {
        const line = element("div", "glt-alm-meta", binding.entity_id ?? "");
        line.setAttribute("data-binding", String(binding.kind ?? ""));
        item.append(line);
        if (binding.writable === false) {
          const readOnly = element(
            "div", "glt-alm-suppressed",
            `${copy(language, "binding_read_only")}: ${binding.reason ?? ""}`,
          );
          readOnly.setAttribute("data-binding-read-only", String(binding.reason ?? ""));
          item.append(readOnly);
        }
      }

      const failures = (entry.history || []).filter(
        (row) => row.outcome && row.outcome !== "delivered",
      );
      for (const failure of failures) {
        const line = element(
          "div", "glt-alm-failed",
          `${failure.at ?? ""} ${failure.service ?? ""}: ${failure.error ?? failure.outcome}`,
        );
        line.setAttribute("data-execution-failed", String(failure.outcome));
        item.append(line);
      }
      list.append(item);
    }
    this.append(list);
  }
}

/**
 * The effective-value preview.
 *
 * The two sentences this element exists for are the DST ones. An engineer
 * cannot derive either from an `HH:MM` field, and both are authored in each
 * language rather than string-joined from fragments.
 *
 * Resolution uses the **site's** timezone, passed in. A browser in a different
 * zone from the plant is ordinary, and answering for the browser's zone would
 * mean the engineer verified something the runner will not do.
 */
class GltSchedulePreview extends GltAlarmElement {
  render() {
    this.textContent = "";
    const language = this.language;
    const entry = this._props.entry;
    const zone = this._props.timezone;
    const dates = Array.isArray(this._props.dates) ? this._props.dates : [];
    this.append(element("h3", null, copy(language, "schedule_preview")));
    if (!entry || !zone) return;

    const list = element("ul", "glt-alm-preview");
    for (const date of dates) {
      const item = element("li", null);
      item.setAttribute("data-preview-date", date);
      let resolution;
      try {
        resolution = this._props.resolutions?.[date] ?? resolveEntry(entry, date, zone, {
          nonexistent: this._props.nonexistent ?? DEFAULT_NONEXISTENT_POLICY,
          ambiguous: this._props.ambiguous ?? DEFAULT_AMBIGUOUS_POLICY,
        });
      } catch {
        item.textContent = `${date}: ?`;
        list.append(item);
        continue;
      }
      item.setAttribute("data-preview-status", resolution.status);
      const time = entry.time ?? entry.from ?? "";
      if (resolution.status === "nonexistent") {
        item.textContent = `${time} ${copy(language, "preview_nonexistent")} ${date} — `
          + `${copy(language, "preview_nonexistent_tail")}`;
      } else if (resolution.status === "ambiguous") {
        item.textContent = `${time} ${copy(language, "preview_ambiguous")} ${date} — `
          + `${copy(language, "preview_ambiguous_tail")} ${resolution.instants[0] ?? ""}`;
      } else {
        item.textContent = `${date}: ${time} ${copy(language, "preview_normal")} `
          + `${resolution.instants[0] ?? ""}`;
      }
      list.append(item);
    }
    this.append(list);
  }
}

if (typeof document !== "undefined" && !document.querySelector("style[data-glt-alarms]")) {
  const style = document.createElement("style");
  style.dataset.gltAlarms = "1";
  style.textContent = STYLE;
  document.head?.append(style);
}

/* Every declared priority must have both a shape and a label in both
 * languages, checked at module load. A priority the surface cannot draw is a
 * priority an operator cannot see, and the vocabulary is closed precisely so
 * this can be checked rather than hoped for.
 */
for (const priority of ALARM_PRIORITIES) {
  if (!PRIORITY_SHAPES[priority]) {
    throw new Error(`alarm priority ${priority} has no non-colour shape`);
  }
  for (const language of ["en", "de"]) {
    if (!hasWording(KEYS[`priority_${priority}`], language)) {
      throw new Error(`alarm priority ${priority} has no ${language} label`);
    }
  }
}
for (const reason of SUPPRESSION_REASONS) {
  for (const language of ["en", "de"]) {
    if (!hasWording(KEYS[`suppressed_${reason}`], language)) {
      throw new Error(`suppression reason ${reason} has no ${language} wording`);
    }
  }
}

for (const [name, constructor] of [
  ["glt-flow-card-alarm-list", GltAlarmList],
  ["glt-flow-card-alarm-detail", GltAlarmDetail],
  ["glt-flow-card-alarm-actions", GltAlarmActions],
  ["glt-flow-card-alarm-settings", GltAlarmSettings],
  ["glt-flow-card-schedule-editor", GltScheduleEditor],
  ["glt-flow-card-schedule-preview", GltSchedulePreview],
]) {
  defineElement(name, constructor);
}
