/**
 * Screen, CSV and print are three renderings of one model.
 *
 * D21: `printReport` calls `reportCsv`, then rebuilds rows with
 * `csv.split("\n")` and cells with `line.split(";")`, then strips surrounding
 * quotes with a regex. Any value containing a semicolon — a German decimal list,
 * an equipment name, an acknowledgement comment — becomes extra columns, and any
 * value containing a newline becomes extra rows. The quoting that `csvCell`
 * correctly applied is discarded rather than parsed.
 *
 * **Deriving one rendering from another's serialisation is the defect, not the
 * symptom.** A better CSV parser in the print view would fix these four values
 * and leave the next four to be discovered by whoever types them. All three
 * render from the model, and none reads another's output.
 *
 * D22: `trendCsv` joins series by nearest neighbour with `Math.abs` and no
 * maximum distance, so a sample from four hours away is written into this
 * minute's row with no marker. The file states values that were never measured
 * at the times it attributes them to.
 */

/** Escape one cell for CSV. The only place quoting is decided. */
function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Render the model for the screen.
 *
 * Cells are returned as values, not as markup or as a joined string. Whatever
 * displays them sets them as text content — operator text reaching the DOM as
 * markup is T7-19, and a rendering that hands back a string invites exactly
 * that.
 */
export function screen(model) {
  return {
    columns: [...(model?.columns ?? [])],
    provenance: { ...(model?.provenance ?? {}) },
    rows: (model?.rows ?? []).map((row) => [...row]),
  };
}

/** Render the model as CSV. The only rendering that quotes anything. */
export function csv(model) {
  const header = (model?.columns ?? []).map(csvCell).join(";");
  const rows = (model?.rows ?? []).map((row) => row.map(csvCell).join(";"));
  return { provenance: { ...(model?.provenance ?? {}) }, text: [header, ...rows].join("\n") };
}

/**
 * Render the model for print.
 *
 * From the model, never from `csv().text`. That is the whole of D21, and the
 * reason the signature takes a model rather than a string: a print view that
 * accepts a string can always be handed a serialisation, and then someone has
 * to remember not to.
 */
export function print(model) {
  return {
    columns: [...(model?.columns ?? [])],
    provenance: { ...(model?.provenance ?? {}) },
    rows: (model?.rows ?? []).map((row) => [...row]),
  };
}

/** What an export must state about itself, or it cannot be interpreted later. */
export const PROVENANCE_FIELDS = Object.freeze([
  "aggregate", "bounds", "coverage", "deadband", "period", "timezone",
]);

/**
 * Export series against a timestamp grid, never borrowing a value.
 *
 * D22 is a nearest-neighbour join at unbounded distance. Here a cell is filled
 * only by a sample inside that interval; anything else is an explicit blank.
 *
 * A blank is not a smaller claim than a borrowed value — it is a *different*
 * one, and the honest one. "We did not measure this here" and "it was five" are
 * different statements, and only the first is true.
 */
export function exportSeries({ interval, series, timestamps, provenance }) {
  const width = Number(interval) > 0 ? Number(interval) : 0;
  const grid = [...(timestamps ?? [])];
  const columns = ["timestamp", ...(series ?? []).map((entry) => entry.label)];

  const rows = grid.map((stamp) => {
    const cells = (series ?? []).map((entry) => {
      const inside = (entry.points ?? []).filter((point) => {
        const at = Number(point.time);
        return Number.isFinite(at) && at >= stamp && at < stamp + width;
      });
      if (inside.length === 0) return null;
      // More than one sample in the interval is an aggregation question, not a
      // choice: the last one is the state at the end of the interval, which is
      // what a grid cell means.
      return inside[inside.length - 1].value;
    });
    return [new Date(stamp).toISOString(), ...cells];
  });

  const stated = {};
  for (const field of PROVENANCE_FIELDS) stated[field] = provenance?.[field] ?? null;

  return { columns, provenance: stated, rows };
}
