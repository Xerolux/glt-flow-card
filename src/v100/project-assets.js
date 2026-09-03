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

import { defineElement } from "./element-registry.mjs";
import { hasWording, text as catalogText } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";

const LANGUAGES = ["de", "en"];

/**
 * Local wording names, mapped to their catalog keys.
 *
 * The wording itself lives in `catalog-de.mjs` and `catalog-en.mjs`. It used
 * to live here as a `TEXT` table, which is what made a third locale a code
 * edit in every module that renders anything: a locale is now a catalog, and a
 * catalog is data.
 *
 * This map exists so the call sites below keep naming the string they mean
 * rather than a namespaced key, including the ones that compute a name.
 */
const KEYS = Object.freeze({
  "attachmentLimits": "assets.attachment_limits",
  "column_declared_in": "assets.column_declared_in",
  "column_diagnosis": "assets.column_diagnosis",
  "column_evidence": "assets.column_evidence",
  "column_note": "assets.column_note",
  "column_provenance": "assets.column_provenance",
  "column_reference": "assets.column_reference",
  "column_slot": "assets.column_slot",
  "column_tick": "assets.column_tick",
  "column_value": "assets.column_value",
  "diagnosis.duplicate_binding": "assets.diagnosis_duplicate_binding",
  "field_asset": "assets.field_asset",
  "field_note": "assets.field_note",
  "field_reason": "assets.field_reason",
  "field_title": "assets.field_title",
  "diagnosis.missing": "assets.diagnosis_missing",
  "diagnosis.present": "assets.diagnosis_present",
  "diagnosis.registered_not_loaded": "assets.diagnosis_registered_not_loaded",
  "diagnosis.service_missing": "assets.diagnosis_service_missing",
  "diagnosis.stale": "assets.diagnosis_stale",
  "diagnosis.unregistered": "assets.diagnosis_unregistered",
  "diagnosis.wrong_device_class": "assets.diagnosis_wrong_device_class",
  "diagnosis.wrong_unit": "assets.diagnosis_wrong_unit",
  "measured": "assets.measured",
  "noEntries": "assets.no_entries",
  "readOnly": "assets.read_only",
  "refusedSimulating": "assets.refused_simulating",
  "refusedUnknown": "assets.refused_unknown",
  "sessionActive": "assets.session_active",
  "sessionExpired": "assets.session_expired",
  "simulated": "assets.simulated",
  "simulatedShape": "assets.simulated_shape",
});

for (const catalogKey of Object.values(KEYS)) {
  for (const language of LANGUAGES) {
    if (!hasWording(catalogKey, language)) {
      throw new Error(`asset surfaces: ${catalogKey} has no ${language} wording`);
    }
  }
}

/**
 * Resolve one asset string through the catalog.
 *
 * **There is no fallback.** The three spellings this replaces across nine
 * modules resolved a missing key to the English string or to the raw key, and
 * neither is visible to anyone except the operator it fails: a German operator
 * saw an English sentence, indistinguishable from a term deliberately left in
 * English. An unknown name throws instead, naming what is missing.
 */
function text(key, language, values = {}) {
  const catalogKey = KEYS[key];
  if (!catalogKey) throw new Error(`no wording named ${JSON.stringify(key)}`);
  return catalogText(catalogKey, language, values);
}

/**
 * One diagnosis code's wording.
 *
 * The nine codes used to live in a nested per-language table read as
 * `text("diagnosis", language)[code] ?? code`, which rendered the raw code for
 * anything unlisted — a screen saying `wrong_unit` to a plant engineer. They
 * are catalog keys now, and an unknown code is a defect that names itself.
 */
function diagnosisText(code, language) {
  const key = `diagnosis.${code}`;
  if (!KEYS[key]) throw new Error(`asset surfaces: no wording for diagnosis ${JSON.stringify(code)}`);
  return text(key, language);
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
    // A status region: a rehearsal starting or expiring is something a person
    // needs told, not something they must notice. Polite, because it is context
    // rather than a command outcome — assertive is reserved for those.
    this.setAttribute("aria-live", "polite");
    this.setAttribute("role", "status");
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
    append(this, "span", text("simulatedShape", language), { "aria-hidden": "true", "data-simulation-shape": "" });
    append(
      this, "span",
      text("sessionActive", language, {
        until: session.expires_at,
        who: session.actor_name || session.actor_user_id,
      }),
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
    // Value, unit and provenance are one reading, not three fragments. The
    // provenance is inside the name because a simulated value read as a
    // measurement is this phase's whole safety concern.
    this.setAttribute("role", "group");
    this.setAttribute(
      "aria-label",
      `${value === null || value === undefined ? "—" : value}${unit ? ` ${unit}` : ""}`
      + `, ${text(simulated ? "simulated" : "measured", language)}`,
    );
    append(this, "span", value === null || value === undefined ? "—" : value, { "data-value": "" });
    if (unit) append(this, "span", unit, { "data-unit": "" });
    if (simulated) {
      append(this, "span", text("simulatedShape", language), { "aria-hidden": "true", "data-provider-shape": "" });
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
    // The fourth column held the provenance marker under a blank header, so
    // every cell in it was announced with no context — and the first three were
    // German or English by inline conditional rather than by catalog.
    for (const column of ["tick", "slot", "value", "provenance"]) {
      append(headRow, "th", text(`column_${column}`, language), { scope: "col" });
    }
    const body = append(table, "tbody");
    for (const entry of trace) {
      const row = append(body, "tr", null, { "data-tick": entry.tick });
      append(row, "td", entry.tick);
      append(row, "td", entry.slot);
      append(row, "td", entry.value);
      const marker = append(row, "td", null, { "data-provider": entry.provider ?? "simulated" });
      append(marker, "span", text("simulatedShape", language), { "aria-hidden": "true", "data-provider-shape": "" });
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
        append(counts, "li", `${diagnosisText(code, language)}: ${count}`, {
          "data-count": code,
        });
      }
    }

    const table = append(this, "table", null, { "data-commissioning": "" });
    const headRow = append(append(table, "thead"), "tr");
    for (const column of ["reference", "declared_in", "diagnosis", "evidence", "note"]) {
      append(headRow, "th", text(`column_${column}`, language), { scope: "col" });
    }
    const body = append(table, "tbody");
    for (const finding of findings) {
      const row = append(body, "tr", null, { "data-diagnosis": finding.code });
      append(row, "td", finding.reference, { "data-reference": "" });
      append(row, "td", finding.site ?? finding.evidence?.site ?? "", { "data-site": "" });
      // The word, not a colour. A severity rendered only as a tint is no
      // information at all on a monochrome kiosk.
      append(row, "td", diagnosisText(finding.code, language), {
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
    for (const field of ["title", "asset", "note", "reason"]) {
      const wrapper = append(form, "p");
      const id = `glt-wo-${field}`;
      append(wrapper, "label", text(`field_${field}`, language), { for: id });
      append(wrapper, "input", null, { "data-field": field, id, name: field, type: "text" });
    }
    if (limits) {
      append(form, "p", text("attachmentLimits", language, {
        count: limits.max_attachments,
        megabytes: Math.round(limits.max_bytes / (1024 * 1024)),
      }), { "data-attachment-limits": "" });
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
    // A refusal is the answer to something the operator just did, so it is
    // announced rather than waiting to be found.
    this.setAttribute("aria-live", "assertive");
    this.setAttribute("data-refusal", reason);
    this.setAttribute("role", "alert");
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
  defineElement(name, constructor);
}
