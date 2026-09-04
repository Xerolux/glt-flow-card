/* Entity bridge, owned here so both runtimes — the HA card core and the
 * standalone online designer — share one validation instead of two that
 * agree today and drift tomorrow. The card core re-exports these. */

/* Entity bridge between a live Home Assistant and a designer without one.
 * The payload is deliberately boring: entity id, display name, domain, unit.
 * No state values travel with it, so an exported file is reusable and safe to
 * share, and the format stays diff-friendly. */

const ENTITY_ID_PATTERN = /^[a-z0-9_]+\.[a-z0-9_]+$/u;
const ENTITY_IMPORT_LIMIT = 5000;

/** Build the export payload from a Home Assistant state map. */
export function entityExportPayload(hassStates = {}) {
  const entities = Object.values(hassStates)
    .filter((state) => state && typeof state.entity_id === "string" && ENTITY_ID_PATTERN.test(state.entity_id))
    .map((state) => ({
      entity_id: state.entity_id,
      name: typeof state.attributes?.friendly_name === "string" ? state.attributes.friendly_name : state.entity_id,
      domain: state.entity_id.split(".")[0],
      unit: typeof state.attributes?.unit_of_measurement === "string" ? state.attributes.unit_of_measurement : "",
    }))
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  return { format: "glt-flow-card-entities", version: 1, count: entities.length, entities };
}

/** Validate and normalise an import, whatever shape it arrived in.
 *
 * Rejects malformed rows rather than repairing them: a silently "repaired"
 * entity id would reappear in a saved project and fail there instead. */
export function normalizeEntityImport(data, options = {}) {
  const limit = options.limit ?? ENTITY_IMPORT_LIMIT;
  const rows = Array.isArray(data) ? data : Array.isArray(data?.entities) ? data.entities : [];
  const seen = new Set();
  const entities = [];
  let rejected = 0;
  for (const row of rows) {
    const id = typeof row?.entity_id === "string" ? row.entity_id : "";
    if (!ENTITY_ID_PATTERN.test(id) || seen.has(id)) {
      rejected += 1;
      continue;
    }
    seen.add(id);
    entities.push({
      entity_id: id,
      name: typeof row.name === "string" && row.name.trim() ? row.name : id,
      domain: id.split(".")[0],
      unit: typeof row.unit === "string" ? row.unit : "",
    });
    if (entities.length >= limit) break;
  }
  entities.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  return { format: "glt-flow-card-entities", version: 1, count: entities.length, rejected, entities };
}
