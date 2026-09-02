/**
 * Screen, CSV and print derive from one model (T7-16, T7-17).
 *
 * D21: `printReport` calls `reportCsv`, then rebuilds rows with
 * `csv.split("\n")` and cells with `line.split(";")`, then strips surrounding
 * quotes with a regex. Any value containing a semicolon -- a German decimal
 * list, an equipment name, an acknowledgement comment -- becomes extra columns,
 * and any value containing a newline becomes extra rows. The quoting that
 * `csvCell` correctly applied is discarded rather than parsed.
 *
 * Deriving one rendering from another's serialisation is the defect, not the
 * symptom, so the test uses exactly the values a naive round-trip destroys.
 *
 * D22: `trendCsv` joins series by nearest neighbour with `Math.abs` and no
 * maximum distance, so a sample from four hours away is written into this
 * minute's row with no marker. The file states values that were never measured
 * at the times it attributes them to.
 */
import assert from "node:assert/strict";
import test from "node:test";

const RED_MARKER =
  "EXPECTED_RED[phase7-report-renderings]: one model behind the screen, CSV and print renderings is unavailable";
const EFFECT_PREFIX = "PHASE7_RENDER_EFFECTS ";

/** The values a serialisation round-trip breaks. Each one is a real field. */
const HOSTILE = [
  { label: "semicolon", value: "Pumpe 1; Pumpe 2" },
  { label: "newline", value: "Zeile 1\nZeile 2" },
  { label: "quote", value: 'Ventil "A"' },
  { label: "comma decimal", value: "12,5" },
];

test("[expected-red:phase7-report-renderings] three renderings, one model", async () => {
  console.log(EFFECT_PREFIX + JSON.stringify({
    hostile: HOSTILE.length, network: 0, service: 0,
  }));
  const gaps = [];

  let renderings = null;
  try {
    renderings = await import("../src/v100/report-renderings.mjs");
  } catch {
    gaps.push("src/v100/report-renderings.mjs does not exist");
  }

  if (renderings) {
    const model = {
      columns: ["Bereich", "Name", "Wert"],
      rows: HOSTILE.map((entry) => ["KPI", entry.value, "1"]),
    };

    for (const rendering of ["screen", "csv", "print"]) {
      if (typeof renderings[rendering] !== "function") {
        gaps.push(`report-renderings exposes no ${rendering} rendering`);
      }
    }

    if (gaps.length === 0) {
      // The three must agree on values a round-trip would break. Comparing the
      // *cells* rather than the text is the point: the CSV is allowed to quote,
      // the print view is not allowed to re-split.
      const screen = renderings.screen(model).rows;
      const printed = renderings.print(model).rows;
      for (const [index, entry] of HOSTILE.entries()) {
        if (screen[index]?.[1] !== entry.value) {
          gaps.push(`the screen rendering altered a ${entry.label}`);
        }
        if (printed[index]?.[1] !== entry.value) {
          gaps.push(
            `the print rendering altered a ${entry.label}; it is re-parsing the CSV ` +
            "rather than rendering the model",
          );
        }
        if (printed[index]?.length !== model.columns.length) {
          gaps.push(`a ${entry.label} changed the print rendering's column count`);
        }
      }
      if (printed.length !== model.rows.length) {
        gaps.push("a value containing a newline changed the print rendering's row count");
      }
    }

    // D22. No exported row carries a value borrowed from another interval.
    const exportSeries = renderings.exportSeries;
    if (typeof exportSeries !== "function") {
      gaps.push("report-renderings exposes no exportSeries");
    } else {
      const exported = exportSeries({
        interval: 60_000,
        series: [{
          label: "A",
          points: [{ time: Date.parse("2027-06-01T00:00:00Z"), value: 5 }],
        }],
        timestamps: [
          Date.parse("2027-06-01T00:00:00Z"),
          Date.parse("2027-06-01T04:00:00Z"),
        ],
      });
      if (exported.rows?.[1]?.[1] === 5 || exported.rows?.[1]?.[1] === "5") {
        gaps.push(
          "a sample four hours away was written into this minute's row, so the file " +
          "states values that were never measured at the times it attributes them to",
        );
      }
      // And the file says what produced it, or it cannot be reproduced or even
      // interpreted later.
      for (const field of ["aggregate", "bounds", "coverage", "deadband", "period", "timezone"]) {
        if (!(field in (exported.provenance ?? {}))) {
          gaps.push(`an export does not state its ${field}`);
        }
      }
    }
  }

  if (gaps.length > 0) {
    console.log(RED_MARKER);
    for (const gap of gaps) console.log(`  gap: ${gap}`);
  }
  assert.deepEqual(gaps, [], "one model behind three renderings is unavailable");
});
