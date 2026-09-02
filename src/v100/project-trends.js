/* Phase-7 trend, energy and report surfaces.
 *
 * One rule governs all of them, and it is the whole point of the phase: **the
 * screen never shows a number without showing what it is a number of.** A
 * value, its unit, its period and its coverage travel together or none of them
 * appears.
 *
 * That is not decoration. Six of the audit's defects turn *absent* into a
 * number, and every one of them produces something that looks like a reading:
 * an empty response drawn inside a populated axis, a six-hour outage drawn as a
 * steady line, an unreadable fault contact recorded as healthy, a month with
 * half its meters offline reported as a smaller cost. None of those looks
 * broken. Only what the product says about its own answer separates them from
 * the truth.
 *
 * Three consequences, from the UI contract:
 *
 * **A gap is a break, never a line.** Not dashed, not lighter, not a tooltip.
 * On a monochrome kiosk and in forced colours those are all the same line, and
 * the whole point is that the reader must not be able to mistake absence for a
 * measurement.
 *
 * **Coverage is stated even at 100 %.** If the badge only appeared when
 * something was missing, its absence would come to mean "we forgot to check".
 *
 * **Every chart has a tabular alternative reachable by keyboard.** Phase 4
 * established that the control-room kiosk has no pointer at all; there the
 * table is the only way to read a trend, and a chart-only trend is one that
 * installation cannot use. A gap is a marked row carrying its interval, not a
 * blank cell and not an omitted one.
 *
 * Operator text -- an equipment name, a KPI label, a report name -- is set as
 * text content and never interpolated into markup.
 */

import { defineElement } from "./element-registry.mjs";
import { hasWording, text as catalogText } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";

import { labelFor } from "./period-vocabulary.mjs";

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
  "coverage": "trends.coverage",
  "instantColumn": "trends.instant_column",
  "report_name": "trends.report_name",
  "report_period": "trends.report_period",
  "report_schedule": "trends.report_schedule",
  "tableLabel": "trends.table_label",
  "coverageGaps": "trends.coverage_gaps",
  "gapOne": "trends.gap_one",
  "gapOther": "trends.gap_other",
  "gapRow": "trends.gap_row",
  "noData": "trends.no_data",
  "spanDay23": "trends.span_day23",
  "spanDay25": "trends.span_day25",
  "spanMonth": "trends.span_month",
  "unreadable": "trends.unreadable",
});

for (const catalogKey of Object.values(KEYS)) {
  for (const language of LANGUAGES) {
    if (!hasWording(catalogKey, language)) {
      throw new Error(`trend surfaces: ${catalogKey} has no ${language} wording`);
    }
  }
}

/**
 * Resolve one trend string through the catalog.
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

function percentOf(coverage) {
  return Math.round((Number(coverage) || 0) * 100);
}

/**
 * The coverage sentence, whose plural is data rather than a conditional.
 *
 * This was the product's only inline plural: `gaps === 1 ? "Lücke" : "Lücken"`.
 * Correct for German and English, a code edit for every other locale, and wrong
 * outright for any language with more than two plural forms. The two forms are
 * catalog entries now and the selection is a lookup, which is the shape a
 * locale can be supplied in.
 */
function coverageText(language, percent, gaps) {
  if (gaps === 0) return text("coverage", language, { percent });
  return text("coverageGaps", language, {
    gapWord: text(gaps === 1 ? "gapOne" : "gapOther", language),
    gaps,
    percent,
  });
}

/**
 * Coverage, as text, on every chart and every total.
 *
 * Its own element so a surface cannot render a number without one: adding a
 * chart means adding a badge, and forgetting is visible in the markup rather
 * than invisible in a helper nobody called.
 */
class CoverageBadge extends HTMLElement {
  set props({ coverage, gaps = [], language = "de" }) {
    this.replaceChildren();
    this.setAttribute("data-coverage", String(coverage ?? 0));
    append(this, "span", coverageText(language, percentOf(coverage), gaps.length), {
      "data-coverage-text": "",
    });
  }
}

/**
 * A chart, drawn with the gaps broken.
 *
 * The segments are emitted as separate paths rather than one path with moves,
 * so a break is structurally visible: a test can count them, and a renderer
 * cannot accidentally join two across a gap by changing a fill rule.
 */
/**
 * Does a declared gap fall between these two readings?
 *
 * An unreadable timestamp on either side answers yes: joining two readings
 * whose order we cannot establish would draw a continuity nobody measured.
 */
function crossesGap(previousAt, at, gaps) {
  const from = Date.parse(previousAt ?? "");
  const to = Date.parse(at ?? "");
  if (Number.isNaN(from) || Number.isNaN(to)) return true;
  return (gaps ?? []).some((gap) => {
    const start = Date.parse(gap?.start ?? "");
    const end = Date.parse(gap?.end ?? "");
    if (Number.isNaN(start) || Number.isNaN(end)) return true;
    return start < to && end > from;
  });
}

class TrendChart extends HTMLElement {
  set props({ series = [], coverage = 0, gaps = [], period = null, source = null, language = "de" }) {
    this.replaceChildren();
    this.setAttribute("data-source", String(source ?? "unavailable"));

    const badge = document.createElement("glt-flow-card-coverage-badge");
    this.append(badge);
    badge.props = { coverage, gaps, language };

    if (period) {
      // The period, resolved, with its span. A month is not always 720 hours
      // and the engineer must be able to see which month, in which zone.
      const spanNote = document.createElement("span");
      spanNote.setAttribute("data-period", "");
      spanNote.textContent = `${labelFor("period", period.name ?? "custom", language)} · ` +
        `${period.start} → ${period.end} · ${period.span_hours} h`;
      this.append(spanNote);
      const unusual = unusualSpan(period, language);
      if (unusual) append(this, "span", unusual, { "data-span-note": "" });
    }

    const plot = document.createElement("div");
    plot.setAttribute("data-plot", "");
    this.append(plot);

    for (const entry of series) {
      // A segment per run of consecutive readings. Absent points end a segment
      // rather than being skipped over, which is what makes a gap a break.
      let segment = null;
      let previousAt = null;
      for (const point of entry.points ?? []) {
        if (point.value === null || point.value === undefined || point.state === "indeterminate") {
          segment = null;
          previousAt = null;
          continue;
        }
        // A declared gap ends the segment even when both readings around it are
        // present. The series is not promised to be padded with nulls across a
        // hole, so a break that depended on that padding would close the line
        // over exactly the absence the Companion just reported.
        if (previousAt !== null && crossesGap(previousAt, point.at, gaps)) segment = null;
        previousAt = point.at ?? null;
        if (segment === null) {
          segment = document.createElement("span");
          segment.setAttribute("data-segment", entry.label ?? "");
          // Shape and label as well as colour: a control room may be
          // monochrome, and forced colours discard the palette entirely.
          segment.setAttribute("data-marker", entry.marker ?? "●");
          plot.append(segment);
        }
        append(segment, "span", point.value, { "data-point": point.at ?? "" });
      }
    }

    for (const gap of gaps) {
      append(plot, "span", text("gapRow", language, { end: gap.end, start: gap.start }), { "data-gap": "" });
    }
    if (!series.some((entry) => (entry.points ?? []).some((point) => point.value !== null))) {
      append(plot, "span", text("noData", language), { "data-empty": "" });
    }
  }
}

/** Return the sentence a reader cannot derive from a date field, or null. */
function unusualSpan(period, language) {
  const hours = Number(period?.span_hours);
  if (period?.name === "day" && hours === 23) return text("spanDay23", language);
  if (period?.name === "day" && hours === 25) return text("spanDay25", language);
  if (period?.name === "month" && hours !== 720 && Number.isFinite(hours)) {
    return text("spanMonth", language, { hours });
  }
  return null;
}

/**
 * The keyboard-reachable table behind every chart.
 *
 * Exposes exactly the values the chart plots, not a rounded summary. A gap is a
 * row marked as a gap and carrying its interval — a blank cell reads as a
 * measurement of nothing, and an omitted row reads as a shorter period.
 */
class TrendTable extends HTMLElement {
  set props({ series = [], gaps = [], language = "de" }) {
    this.replaceChildren();
    this.setAttribute("tabindex", "0");
    // Focusable, so named. This table *is* the accessible form of the chart —
    // Phase 7 built it for exactly that reason — and an unnamed focus stop is a
    // reader arriving somewhere with no idea what they have reached.
    this.setAttribute("aria-label", text("tableLabel", language));
    this.setAttribute("role", "group");
    const table = document.createElement("table");
    this.append(table);
    const head = document.createElement("tr");
    table.append(head);
    append(head, "th", text("instantColumn", language), { scope: "col" });
    for (const entry of series) append(head, "th", entry.label ?? "");

    const instants = [...new Set(series.flatMap((entry) =>
      (entry.points ?? []).map((point) => point.at)))].sort();
    for (const instant of instants) {
      const row = document.createElement("tr");
      table.append(row);
      append(row, "td", instant);
      for (const entry of series) {
        const point = (entry.points ?? []).find((candidate) => candidate.at === instant);
        if (point && point.value !== null && point.state !== "indeterminate") {
          append(row, "td", point.value);
        } else {
          append(row, "td", text("unreadable", language), { "data-unreadable": "" });
        }
      }
    }
    for (const gap of gaps) {
      const row = document.createElement("tr");
      row.setAttribute("data-gap-row", "");
      table.append(row);
      const cell = append(row, "td", text("gapRow", language, { end: gap.end, start: gap.start }));
      cell.setAttribute("colspan", String(series.length + 1));
    }
  }
}

/** Named periods with their resolved boundaries, shown before the query runs. */
class PeriodPicker extends HTMLElement {
  set props({ periods = [], selected = null, resolved = null, language = "de" }) {
    this.replaceChildren();
    for (const name of periods) {
      const option = append(this, "button", labelFor("period", name, language), {
        "data-period-option": name,
        "aria-pressed": String(name === selected),
        type: "button",
      });
      void option;
    }
    if (resolved) {
      append(this, "span", `${resolved.start} → ${resolved.end} · ${resolved.span_hours} h`, {
        "data-resolved": "",
      });
      const unusual = unusualSpan(resolved, language);
      if (unusual) append(this, "span", unusual, { "data-span-note": "" });
    }
  }
}

/** One row per medium, never one number across media. */
class EnergySummary extends HTMLElement {
  set props({ rows = [], total = null, language = "de" }) {
    this.replaceChildren();
    for (const row of rows) {
      const line = document.createElement("div");
      line.setAttribute("data-medium", row.medium ?? "");
      this.append(line);
      append(line, "span", row.name ?? row.id ?? "", { "data-name": "" });
      if (row.refused) {
        // A refusal, with its reason. Phase 5 established that a bare refusal
        // tells an engineer the tool disagrees with them, while a reason tells
        // them which of the two is wrong.
        append(line, "span", labelFor("refusal", row.refused, language), { "data-refused": row.refused });
        continue;
      }
      append(line, "span", row.value === null || row.value === undefined
        ? text("noData", language)
        : `${row.value} ${row.unit ?? ""}`.trim(), { "data-value": "" });
      const badge = document.createElement("glt-flow-card-coverage-badge");
      line.append(badge);
      badge.props = { coverage: row.coverage ?? 0, gaps: row.gaps ?? [], language };
    }

    if (total) {
      const line = document.createElement("div");
      line.setAttribute("data-total", "");
      this.append(line);
      append(line, "span", total.value === null || total.value === undefined
        ? text("noData", language)
        : `${total.value} ${total.unit ?? ""}`.trim(), { "data-value": "" });
      const badge = document.createElement("glt-flow-card-coverage-badge");
      line.append(badge);
      badge.props = { coverage: total.coverage ?? 0, gaps: total.gaps ?? [], language };
      // The exclusions, in the total's own row rather than a footnote. A total
      // that quietly left something out is a smaller number with the same
      // confidence as a whole one.
      for (const excluded of total.excluded ?? []) {
        append(line, "span", `${excluded.id ?? ""}: ${excluded.reason ?? ""}`, {
          "data-excluded": excluded.reason ?? "",
        });
      }
    }
  }
}

/**
 * Report definitions and their runs, authored with form fields.
 *
 * Not `window.prompt`. The three prompts on this path collected a name, a
 * period and a schedule, validated none of them, and stored a schedule string
 * nothing ever parsed.
 */
class ReportDesigner extends HTMLElement {
  set props({ definitions = [], runs = [], language = "de" }) {
    this.replaceChildren();
    const form = document.createElement("form");
    form.setAttribute("data-report-form", "");
    this.append(form);
    for (const [name, type] of [["name", "text"], ["period", "text"], ["schedule", "text"]]) {
      // Each field carries a real `<label for>`. It had none: a screen reader
      // announced three "edit text" stops with nothing to tell them apart, and
      // a placeholder would not have fixed that — it disappears the moment
      // someone types, which is exactly when they need to know which field
      // they are in.
      const row = append(form, "p");
      const id = `glt-report-${name}`;
      append(row, "label", text(`report_${name}`, language), { for: id });
      append(row, "input", null, {
        "data-field": name,
        id,
        name,
        required: name === "name" ? "" : null,
        type,
      });
    }

    for (const definition of definitions) {
      const row = document.createElement("div");
      row.setAttribute("data-definition", definition.id ?? "");
      this.append(row);
      append(row, "span", definition.name ?? definition.id ?? "", { "data-name": "" });
      append(row, "span", labelFor("period", definition.period?.name ?? "custom", language), {
        "data-period": "",
      });
    }

    for (const run of runs) {
      const row = document.createElement("div");
      row.setAttribute("data-run", run.report_id ?? "");
      this.append(row);
      // The inputs the run recorded, so a reader can see what produced the
      // number rather than being asked to trust it.
      append(row, "span", `${run.window?.start ?? ""} → ${run.window?.end ?? ""}`, { "data-window": "" });
      append(row, "span", run.timezone ?? "", { "data-timezone": "" });
      const badge = document.createElement("glt-flow-card-coverage-badge");
      row.append(badge);
      badge.props = { coverage: run.coverage ?? 0, gaps: [], language };
      for (const changed of run.changed_inputs ?? []) {
        append(row, "span", changed, { "data-changed-input": changed });
      }
    }
  }
}

const ELEMENTS = [
  ["glt-flow-card-coverage-badge", CoverageBadge],
  ["glt-flow-card-trend-chart", TrendChart],
  ["glt-flow-card-trend-table", TrendTable],
  ["glt-flow-card-period-picker", PeriodPicker],
  ["glt-flow-card-energy-summary", EnergySummary],
  ["glt-flow-card-report-designer", ReportDesigner],
];

for (const [name, constructor] of ELEMENTS) {
  defineElement(name, constructor);
}

export { ELEMENTS };
