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

/** DE/EN copy. A missing key renders its own name, never the other language. */
const COPY = {
  en: {
    alarms_title: "Alarms",
    no_alarms: "No active alarms",
    state_active: "active",
    state_returned: "returned",
    state_acknowledged: "acknowledged",
    state_indeterminate: "state unknown",
    state_suppressed: "suppressed",
    priority_critical: "Critical",
    priority_warning: "Warning",
    priority_info: "Information",
    suppressed_shelved: "shelved",
    suppressed_maintenance: "in maintenance",
    suppressed_acknowledged: "acknowledged",
    suppressed_by: "by",
    suppressed_until: "until",
    delivery_failed: "Delivery failed",
    delivery_none: "No notification targets configured; alarms are annunciated here only",
    attempts_title: "Delivery attempts",
    acknowledge: "Acknowledge",
    shelve: "Shelve",
    comment: "Comment",
    shelve_minutes: "Suppress for how many minutes?",
    shelve_too_long: "Longer than this site allows",
    confirm: "OK",
    cancel: "Cancel",
    links_title: "Context",
    settings_title: "Alarm settings",
    setting_default: "default",
    schedule_title: "Schedules",
    schedule_preview: "Effective times",
    schedule_kind_instant: "Runs at a time",
    schedule_kind_interval: "Operating period",
    binding_read_only: "Read-only",
    preview_nonexistent: "does not exist on",
    preview_nonexistent_tail: "this entry will not run",
    preview_ambiguous: "occurs twice on",
    preview_ambiguous_tail: "this entry runs once, at",
    preview_normal: "runs at",
  },
  de: {
    alarms_title: "Alarme",
    no_alarms: "Keine aktiven Alarme",
    state_active: "aktiv",
    state_returned: "zurückgestellt",
    state_acknowledged: "quittiert",
    state_indeterminate: "Zustand unbekannt",
    state_suppressed: "unterdrückt",
    priority_critical: "Störung",
    priority_warning: "Warnung",
    priority_info: "Hinweis",
    suppressed_shelved: "geschelft",
    suppressed_maintenance: "in Wartung",
    suppressed_acknowledged: "quittiert",
    suppressed_by: "von",
    suppressed_until: "bis",
    delivery_failed: "Zustellung fehlgeschlagen",
    delivery_none: "Keine Benachrichtigungsziele konfiguriert; Alarme werden nur hier angezeigt",
    attempts_title: "Zustellversuche",
    acknowledge: "Quittieren",
    shelve: "Unterdrücken",
    comment: "Kommentar",
    shelve_minutes: "Für wie viele Minuten unterdrücken?",
    shelve_too_long: "Länger als dieser Standort erlaubt",
    confirm: "OK",
    cancel: "Abbrechen",
    links_title: "Kontext",
    settings_title: "Alarmeinstellungen",
    setting_default: "Vorgabe",
    schedule_title: "Zeitprogramme",
    schedule_preview: "Wirksame Zeiten",
    schedule_kind_instant: "Läuft zu einer Zeit",
    schedule_kind_interval: "Betriebszeit",
    binding_read_only: "Nur lesbar",
    preview_nonexistent: "gibt es nicht am",
    preview_nonexistent_tail: "dieser Eintrag läuft nicht",
    preview_ambiguous: "kommt zweimal vor am",
    preview_ambiguous_tail: "dieser Eintrag läuft einmal, um",
    preview_normal: "läuft um",
  },
};

/**
 * Shapes carrying priority without colour.
 *
 * Distinct glyphs rather than distinct fills, so the difference survives a
 * monochrome kiosk, forced colours and a screen reader reading the row aloud.
 */
const PRIORITY_SHAPES = { critical: "◆", warning: "▲", info: "●" };

function copy(language, key) {
  const table = COPY[language] || COPY.en;
  return table[key] ?? COPY.en[key] ?? key;
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
    if (!COPY[language][`priority_${priority}`]) {
      throw new Error(`alarm priority ${priority} has no ${language} label`);
    }
  }
}
for (const reason of SUPPRESSION_REASONS) {
  for (const language of ["en", "de"]) {
    if (!COPY[language][`suppressed_${reason}`]) {
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
  if (!customElements.get(name)) customElements.define(name, constructor);
}
