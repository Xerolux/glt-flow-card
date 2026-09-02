/* Phase-8 simulation, commissioning and asset surfaces.
 *
 * One rule governs all of them, and it is a safety rule rather than a styling
 * one: **a simulated value must never read as a commissioned measurement.**
 *
 * The whole hazard of this phase is a belief about the plant that is wrong in a
 * comforting direction — "I am only rehearsing", "the installation is ready",
 * "that maintenance was done". The first of those was true in the shipped
 * product only because nothing checked it, and the surface said otherwise.
 *
 * Four consequences, from `08-UI-SPEC.md`:
 *
 * **Simulated is a word and a shape, never a tint.** A control room may be
 * monochrome, forced colours discard the palette entirely, and a screen reader
 * gets nothing from either. The provider travels next to the value, not only in
 * a banner, because a banner scrolls away and a value does not.
 *
 * **A refusal says which refusal it was.** "Simulation is running" and "the
 * Companion could not tell whether simulation is running" call for different
 * responses from an operator, and one of them means wait.
 *
 * **The commissioning table states its four-way diagnosis**, not "missing", and
 * carries no aggregate percentage — replacing an invented score with a
 * better-computed invented score would be the same defect with a nicer formula.
 *
 * **Form fields, never `prompt()`.** Third time this rule is written down,
 * after Phase 6's acknowledgement comment and Phase 7's report schedule.
 *
 * Operator text — an asset name, a work-order note, a scenario label — is set as
 * text content and never interpolated into markup.
 */

const LANGUAGES = ["de", "en"];

/** Wording, written out in both languages rather than assembled from fragments. */
const TEXT = {
  simulated: { de: "simuliert", en: "simulated" },
  simulatedShape: { de: "◈", en: "◈" },
  measured: { de: "gemessen", en: "measured" },
  sessionActive: {
    de: (who, until) => `Simulation aktiv — gestartet von ${who}, endet ${until}. Die Anlage wird nicht bedient.`,
    en: (who, until) => `Simulation active — started by ${who}, ends ${until}. The plant is not being operated.`,
  },
  sessionExpired: {
    de: "Die Simulation ist abgelaufen. Die Anlage wird wieder bedient.",
    en: "The simulation has expired. The plant is being operated again.",
  },
  refusedSimulating: {
    de: "Nicht ausgeführt: eine Simulation läuft.",
    en: "Not performed: a simulation is running.",
  },
  refusedUnknown: {
    de: "Nicht ausgeführt: der Simulationszustand war nicht feststellbar. Bitte erneut versuchen.",
    en: "Not performed: the simulation state could not be determined. Please try again.",
  },
  diagnosis: {
    de: {
      present: "vorhanden",
      registered_not_loaded: "registriert, aber nicht geladen",
      unregistered: "ohne Registry-Eintrag",
      missing: "fehlt",
      wrong_unit: "falsche Einheit",
      wrong_device_class: "falsche Geräteklasse",
      duplicate_binding: "doppelte Zuordnung",
      stale: "veraltet",
      service_missing: "Dienst fehlt",
    },
    en: {
      present: "present",
      registered_not_loaded: "registered but not loaded",
      unregistered: "no registry entry",
      missing: "missing",
      wrong_unit: "wrong unit",
      wrong_device_class: "wrong device class",
      duplicate_binding: "duplicate binding",
      stale: "stale",
      service_missing: "service missing",
    },
  },
  readOnly: {
    de: "Diese Ansicht ändert nichts. Alle Hinweise sind Verweise, keine Aktionen.",
    en: "This view changes nothing. Every remediation is a link, not an action.",
  },
  attachmentLimits: {
    de: (count, megabytes) => `Höchstens ${count} Anhänge, je bis ${megabytes} MB.`,
    en: (count, megabytes) => `At most ${count} attachments, each up to ${megabytes} MB.`,
  },
  noEntries: { de: "Keine Einträge.", en: "No entries." },
};

for (const key of Object.keys(TEXT)) {
  for (const language of LANGUAGES) {
    if (TEXT[key][language] === undefined) {
      throw new Error(`asset surfaces: "${key}" has no ${language} wording`);
    }
  }
}

function text(key, language, ...args) {
  const entry = TEXT[key]?.[language] ?? TEXT[key]?.en;
  return typeof entry === "function" ? entry(...args) : entry;
}

/** Append a child carrying operator text, set as text content and never markup. */
function append(parent, tag, value, attributes = {}) {
  const node = document.createElement(tag);
  for (const [name, attribute] of Object.entries(attributes)) {
    if (attribute !== null && attribute !== undefined) node.setAttribute(name, String(attribute));
  }
  if (value !== null && value !== undefined) node.textContent = String(value);
  parent.append(node);
  return node;
}

/**
 * The banner that says a rehearsal is running.
 *
 * An expired session says so rather than disappearing. A banner that vanishes
 * is indistinguishable from one that was never there, and the operator needs to
 * know the plant is live again — that transition is the moment the belief this
 * phase protects against is most likely to be wrong.
 */
class SimulationBanner extends HTMLElement {
  set props({ session = null, expired = false, language = "de" }) {
    this.replaceChildren();
    if (expired) {
      this.setAttribute("data-simulation", "expired");
      append(this, "span", text("sessionExpired", language), { "data-banner-text": "" });
      return;
    }
    if (!session) {
      this.removeAttribute("data-simulation");
      return;
    }
    this.setAttribute("data-simulation", "active");
    append(this, "span", TEXT.simulatedShape[language], { "data-simulation-shape": "" });
    append(
      this, "span",
      text("sessionActive", language, session.actor_name || session.actor_user_id, session.expires_at),
      { "data-banner-text": "" },
    );
  }
}

/**
 * One value, with its provider stated beside it.
 *
 * The provider travels with the value rather than only in the banner, because a
 * banner scrolls off and a value does not — and the whole hazard is a simulated
 * reading being taken for a commissioned one.
 *
 * Marked with a word *and* a shape. A colour would be invisible on a monochrome
 * kiosk, discarded in forced colours, and silent to a screen reader.
 */
class ProvidedValue extends HTMLElement {
  set props({ value, unit = "", provider = "measured", language = "de" }) {
    this.replaceChildren();
    const simulated = provider === "simulated";
    this.setAttribute("data-provider", provider);
    append(this, "span", value === null || value === undefined ? "—" : value, { "data-value": "" });
    if (unit) append(this, "span", unit, { "data-unit": "" });
    if (simulated) {
      append(this, "span", TEXT.simulatedShape[language], { "data-provider-shape": "" });
    }
    append(this, "span", text(simulated ? "simulated" : "measured", language), {
      "data-provider-text": "",
    });
  }
}

/**
 * A scenario, as a table of ticks.
 *
 * A table rather than a timeline widget, because the table *is* the accessible
 * form: building a chart and then a keyboard alternative is two things to get
 * right, and Phase 4 established that the control-room kiosk has no pointer at
 * all.
 */
class ScenarioTable extends HTMLElement {
  set props({ trace = [], language = "de" }) {
    this.replaceChildren();
    const table = append(this, "table", null, { "data-scenario": "" });
    const head = append(table, "thead");
    const headRow = append(head, "tr");
    for (const label of ["Tick", "Slot", language === "de" ? "Wert" : "Value", ""]) {
      append(headRow, "th", label, { scope: "col" });
    }
    const body = append(table, "tbody");
    for (const entry of trace) {
      const row = append(body, "tr", null, { "data-tick": entry.tick });
      append(row, "td", entry.tick);
      append(row, "td", entry.slot);
      append(row, "td", entry.value);
      const marker = append(row, "td", null, { "data-provider": entry.provider ?? "simulated" });
      append(marker, "span", TEXT.simulatedShape[language], { "data-provider-shape": "" });
      append(marker, "span", text("simulated", language), { "data-provider-text": "" });
    }
  }
}

/**
 * The commissioning table.
 *
 * One row per reference, and the diagnosis is the **four-way** answer rather
 * than "missing". No aggregate percentage: counts per diagnosis, because
 * replacing an invented score with a better-computed one is the same defect
 * with a nicer formula.
 */
class CommissioningTable extends HTMLElement {
  set props({ findings = [], summary = null, language = "de" }) {
    this.replaceChildren();
    append(this, "p", text("readOnly", language), { "data-read-only": "" });

    if (summary) {
      const counts = append(this, "ul", null, { "data-summary": "" });
      for (const [code, count] of Object.entries(summary.counts ?? {})) {
        if (!count) continue;
        append(counts, "li", `${text("diagnosis", language)[code] ?? code}: ${count}`, {
          "data-count": code,
        });
      }
    }

    const table = append(this, "table", null, { "data-commissioning": "" });
    const headRow = append(append(table, "thead"), "tr");
    for (const label of ["Referenz", "Deklariert in", "Diagnose", "Nachweis", "Hinweis"]) {
      append(headRow, "th", label, { scope: "col" });
    }
    const body = append(table, "tbody");
    for (const finding of findings) {
      const row = append(body, "tr", null, { "data-diagnosis": finding.code });
      append(row, "td", finding.reference, { "data-reference": "" });
      append(row, "td", finding.site ?? finding.evidence?.site ?? "", { "data-site": "" });
      // The word, not a colour. A severity rendered only as a tint is no
      // information at all on a monochrome kiosk.
      append(row, "td", text("diagnosis", language)[finding.code] ?? finding.code, {
        "data-diagnosis-text": "",
      });
      append(row, "td", finding.evidence?.platform ?? "", { "data-evidence": "" });
      // A link, never an action. Nothing on this surface writes.
      append(row, "td", finding.remediation ?? "", { "data-remediation": "" });
    }
  }
}

/**
 * A work order, shown as its entries.
 *
 * Oldest first, each with its actor and time, because the record exists to
 * answer "who did what, and when" months later. The current status is derived
 * from the last entry rather than shown from a separate field, so the display
 * cannot disagree with the record.
 */
class WorkOrderHistory extends HTMLElement {
  set props({ order = null, language = "de" }) {
    this.replaceChildren();
    const entries = order?.entries ?? [];
    if (!entries.length) {
      append(this, "p", text("noEntries", language), { "data-empty": "" });
      return;
    }
    this.setAttribute("data-status", entries[entries.length - 1].status);
    const list = append(this, "ol", null, { "data-entries": "" });
    for (const entry of entries) {
      const item = append(list, "li", null, {
        "data-entry": entry.id,
        "data-entry-status": entry.status,
        ...(entry.corrects ? { "data-corrects": entry.corrects } : {}),
      });
      append(item, "span", entry.status, { "data-entry-status-text": "" });
      append(item, "span", entry.at, { "data-at": "" });
      append(item, "span", entry.actor_user_id, { "data-actor": "" });
      if (entry.note) append(item, "span", entry.note, { "data-note": "" });
      if (entry.reason) append(item, "span", entry.reason, { "data-reason": "" });
    }
  }
}

/**
 * The work-order form. Fields, never `prompt()`.
 *
 * `prompt()` blocks the whole page, cannot be styled, is unusable on a kiosk and
 * barely reachable by a screen reader. This is the third surface in this project
 * to replace one.
 *
 * Attachment limits are stated **before** a file is chosen. A limit discovered
 * by hitting it is a limit that wasted the work, and in a plant room that work
 * is a photograph somebody climbed a ladder to take.
 */
class WorkOrderForm extends HTMLElement {
  set props({ limits = null, language = "de" }) {
    this.replaceChildren();
    const form = append(this, "form", null, { "data-work-order-form": "" });
    for (const [field, label] of [
      ["title", language === "de" ? "Aufgabe" : "Task"],
      ["asset", language === "de" ? "Anlagenobjekt" : "Asset"],
      ["note", language === "de" ? "Notiz" : "Note"],
      ["reason", language === "de" ? "Begründung" : "Reason"],
    ]) {
      const wrapper = append(form, "p");
      const id = `glt-wo-${field}`;
      append(wrapper, "label", label, { for: id });
      append(wrapper, "input", null, { "data-field": field, id, name: field, type: "text" });
    }
    if (limits) {
      append(form, "p", text(
        "attachmentLimits", language,
        limits.max_attachments, Math.round(limits.max_bytes / (1024 * 1024)),
      ), { "data-attachment-limits": "" });
    }
  }
}

/**
 * A refusal, saying which refusal it was.
 *
 * "A simulation is running" and "the Companion could not tell" call for
 * different responses, and one of them means wait. An operator shown only
 * "refused" cannot know which.
 */
class DispatchRefusal extends HTMLElement {
  set props({ reason = "simulation_active", language = "de" }) {
    this.replaceChildren();
    this.setAttribute("data-refusal", reason);
    append(
      this, "span",
      text(reason === "simulation_state_unavailable" ? "refusedUnknown" : "refusedSimulating", language),
      { "data-refusal-text": "" },
    );
  }
}

const ELEMENTS = [
  ["glt-flow-card-simulation-banner", SimulationBanner],
  ["glt-flow-card-provided-value", ProvidedValue],
  ["glt-flow-card-scenario-table", ScenarioTable],
  ["glt-flow-card-commissioning-table", CommissioningTable],
  ["glt-flow-card-work-order-history", WorkOrderHistory],
  ["glt-flow-card-work-order-form", WorkOrderForm],
  ["glt-flow-card-dispatch-refusal", DispatchRefusal],
];

for (const [name, constructor] of ELEMENTS) {
  if (!customElements.get(name)) customElements.define(name, constructor);
}
