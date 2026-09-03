/* Measure the declared capacity scenarios, and say where each number came from.
 *
 * The roadmap names the defect this replaces: *a 2,000-object diagnostics
 * micro-test presented as platform capacity*. The correction is not a bigger
 * micro-test — it is a number that carries the conditions it was produced
 * under, so it can be compared to a later one and cannot be quoted as
 * something it is not.
 *
 * ## Two rules
 *
 * **A scenario that builds nothing fails.** Every measurement carries the
 * object count actually built and asserts it against the declared size. A
 * capacity test that finishes in three milliseconds because it built no objects
 * reports comfortably under budget, and every downstream artifact repeats that
 * number as a fact about the product. It is this phase's vacuous pass and the
 * most believable of the four, because it looks like good news.
 *
 * **A number carries its environment.** CPU model and count, memory, whether a
 * CPU allocation is declared, and Node's version — plus a `representative` flag
 * that **nothing in this file can set true.** It is set by a person running the
 * harness on named hardware, because that is the only thing the flag actually
 * means. A budget measured on an unnamed machine cannot be compared to anything
 * and invites a reader to plan a plant around it.
 */
import { createHash } from "node:crypto";
import { cpus, totalmem } from "node:os";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCENARIOS = path.join(ROOT, "test/fixtures/capacity-scenarios.json");

/**
 * The environment a measurement was taken in.
 *
 * `representative` is read from an explicit environment variable naming the
 * host, never inferred. An inferred flag is a flag that turns true by accident
 * on the machine where it matters least.
 */
export function environmentFingerprint() {
  const cores = cpus();
  const named = process.env.GLT_CAPACITY_HOST?.trim() ?? "";
  return {
    cpu_count: cores.length,
    cpu_model: cores[0]?.model?.trim() ?? "unknown",
    memory_bytes: totalmem(),
    node_version: process.version,
    platform: `${process.platform}-${process.arch}`,
    // A shared cloud container declares no CPU allocation, so a number measured
    // here supports "this scenario is bounded and runs" and nothing more.
    representative: named !== "",
    representative_host: named === "" ? null : named,
  };
}

/** A stable id for one environment, so two runs can be told apart. */
export function fingerprintId(fingerprint) {
  return createHash("sha256")
    .update(JSON.stringify(fingerprint, Object.keys(fingerprint).sort()))
    .digest("hex")
    .slice(0, 16);
}

/** Read the committed scenario corpus. */
export async function loadScenarios(file = SCENARIOS) {
  const corpus = JSON.parse(await readFile(file, "utf8"));
  if (corpus.format !== "glt-flow-card-capacity-scenarios") {
    throw new Error(`capacity: ${file} is not a scenario corpus`);
  }
  if (!Array.isArray(corpus.scenarios) || corpus.scenarios.length === 0) {
    throw new Error("capacity: the scenario corpus is empty");
  }
  if (!Array.isArray(corpus.sizes) || corpus.sizes.length === 0) {
    throw new Error("capacity: the scenario corpus declares no sizes");
  }
  return corpus;
}

/**
 * Refuse a measurement that did not build what it declared.
 *
 * Exported so a harness can call it the moment the objects exist, rather than
 * only when the result is written — by then the timing is already recorded and
 * the wrong number is the one in hand.
 */
export function requireBuiltWhatItDeclared(id, declared, built) {
  if (!Number.isInteger(declared) || declared <= 0) {
    throw new Error(`capacity ${id}: declared must be a positive integer, got ${JSON.stringify(declared)}`);
  }
  if (!Number.isInteger(built) || built < 0) {
    throw new Error(`capacity ${id}: built must be a non-negative integer, got ${JSON.stringify(built)}`);
  }
  if (built !== declared) {
    throw new Error(
      `capacity ${id}: declared ${declared} objects and built ${built}. `
      + "A scenario that did not build what it declared has not measured what its budget describes.",
    );
  }
}

/** The work each scenario does. Pure, deterministic, and no I/O. */
const WORK = {
  editing(size) {
    const objects = buildObjects(size);
    const undo = [];
    for (const object of objects) {
      undo.push({ from: { x: object.x, y: object.y }, id: object.id });
      object.x += 8;
      object.y += 8;
      if (undo.length > 64) undo.shift();
    }
    for (const entry of undo.reverse()) {
      const object = objects.find((candidate) => candidate.id === entry.id);
      if (object) Object.assign(object, entry.from);
    }
    return objects.length;
  },
  persistence(size) {
    const document = { objects: buildObjects(size), schema_version: 7 };
    const serialised = JSON.stringify(document);
    const parsed = JSON.parse(serialised);
    return parsed.objects.length;
  },
  "remote-partial"(size) {
    const objects = buildObjects(size);
    const perSite = Math.max(1, Math.ceil(objects.length / 5));
    const answered = [];
    const absent = [];
    for (let site = 0; site < 5; site += 1) {
      const slice = objects.slice(site * perSite, (site + 1) * perSite);
      if (site === 3) absent.push({ reason: "timeout", site_id: `site-${site}` });
      else answered.push({ site_id: `site-${site}`, total: slice.reduce((sum, o) => sum + o.value, 0) });
    }
    const total = answered.reduce((sum, entry) => sum + entry.total, 0);
    void total;
    return objects.length;
  },
  render(size) {
    const objects = buildObjects(size);
    const rows = objects.map((object) => `${object.id}\t${object.name}\t${object.value.toFixed(1)}`);
    return rows.length;
  },
  routing(size) {
    const objects = buildObjects(size);
    const routes = [];
    for (let index = 1; index < objects.length; index += 1) {
      const from = objects[index - 1];
      const to = objects[index];
      routes.push([[from.x, from.y], [to.x, from.y], [to.x, to.y]]);
    }
    return objects.length;
  },
  updates(size) {
    const objects = buildObjects(size);
    for (const object of objects) object.value = (object.value + 1) % 100;
    return objects.length;
  },
};

function buildObjects(size) {
  const objects = [];
  for (let index = 0; index < size; index += 1) {
    objects.push({
      id: `object-${index}`,
      name: `Aggregat ${index}`,
      value: index % 100,
      x: (index % 40) * 24,
      y: Math.floor(index / 40) * 24,
    });
  }
  return objects;
}

/** Run one scenario at one size, and refuse a measurement of nothing. */
export function measure(scenario, size, { repeats = 3 } = {}) {
  const work = WORK[scenario.id];
  if (!work) throw new Error(`capacity: no work defined for scenario ${scenario.id}`);
  const samples = [];
  let built = 0;
  for (let round = 0; round < repeats; round += 1) {
    const started = process.hrtime.bigint();
    built = work(size);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  requireBuiltWhatItDeclared(`${scenario.id}@${size}`, size, built);
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    built,
    declared: size,
    dimension: scenario.dimension,
    fastest_ms: Number(sorted[0].toFixed(3)),
    median_ms: Number(sorted[Math.floor(sorted.length / 2)].toFixed(3)),
    repeats,
    scenario: scenario.id,
    slowest_ms: Number(sorted.at(-1).toFixed(3)),
  };
}

/** Run every scenario at every size, with the environment attached once. */
export async function runAll(options = {}) {
  const corpus = await loadScenarios(options.file);
  const environment = environmentFingerprint();
  const measurements = [];
  for (const scenario of corpus.scenarios) {
    for (const size of corpus.sizes) measurements.push(measure(scenario, size, options));
  }
  return {
    environment,
    environment_id: fingerprintId(environment),
    format: "glt-flow-card-capacity-measurements",
    measurements,
    version: 1,
  };
}

async function main() {
  const result = await runAll();
  console.log(JSON.stringify(result, null, 2));
  if (!result.environment.representative) {
    console.error(
      "\nNOTE: this environment is not marked representative, so these numbers support\n"
      + "\"the scenario is bounded and runs\" and never \"the platform handles N objects\".\n"
      + "Set GLT_CAPACITY_HOST to the named hardware to record a representative run.",
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
