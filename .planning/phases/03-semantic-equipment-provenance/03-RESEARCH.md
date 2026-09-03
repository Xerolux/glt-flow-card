---
phase: 03-semantic-equipment-provenance
status: complete
researched: 2026-09-02
requirements: [OPS-01, SEM-01, MAP-01, PROF-01, PROTO-01]
---

# Phase 03 Research

Evidence markers: **[VERIFIED]** confirmed against this repository or against Home
Assistant APIs the supported lanes already exercise. **[ASSUMED]** a reasoned
decision that execution must prove with a test. **[OPEN]** genuinely undecided.

---

## 1. Where the semantic model has to live

**[VERIFIED]** Schema 2 cannot carry it. `rawProject.semantic_model` resolves to
`openObject`; `sites` items resolve to `identifiedObject`, whose only property is
`id`; `datapoint` has `id`, `entity`/`entity_id`, `layer` and `positions`; `profile`
has `id`, `equipment_type`, `extends` and `slots`. There is no building, floor,
system or subsystem concept anywhere in the contract.

**[VERIFIED]** The migration machinery is ready for one more step.
`PROJECT_MIGRATIONS` is a `Map` keyed by source version with `{from, to, migrate}`
entries, `migrateProjectDocument` walks it sequentially, and every step emits a
receipt with source and candidate digests. Adding `[2, {from: 2, to: 3, …}]` and
bumping `CURRENT_PROJECT_SCHEMA_VERSION` is the whole structural change.

**[VERIFIED]** `tools/generate-project-validators.mjs` compiles a list of
`[name, path]` schema specs into the generated validators both runtimes share, so a
`schemas/project/3.schema.json` reaches Node and Python from one source.

**Decision.** Introduce schema 3. Freeze schema 2 as a historical version that the
migration reads and never writes. **[ASSUMED]** the 2→3 step is lossless for every
existing fixture, which the corpus round-trip test must prove rather than assert.

---

## 2. The containment hierarchy

**Decision.** One typed containment tree, one parent per node, levels
`site → building → floor → system → subsystem → equipment → datapoint`.

Two candidate encodings were considered:

| Encoding | Why not / why |
|---|---|
| Nested objects | Reads well, but every existing tool — diff, dependency closure, id collections, bundle handling — is built for flat identified collections. Nesting would fork all of them. |
| **Flat collections with a `parent` reference** | Chosen. Each node names its parent; the tree is derived. Existing diff, closure and reference-edge machinery applies unchanged. |

**[VERIFIED]** `project-contract.mjs` already validates reference edges through
`REFERENCE_EDGES` (`[collection, fields, targetCollection]`) and unique ids through
`ID_COLLECTIONS`. Parent references extend that table; they do not need new code.

**What is genuinely new:** cycle detection. A reference edge check proves a parent
exists; it does not prove the graph is acyclic. A parent chain that loops must be a
contract error with the stable path of the node that closes the loop.

**Decision.** The semantic path (`site/building/floor/…`) is *derived* on read and
never stored. A stored path is a second source of truth that can disagree with the
parents that produced it, and reconciling the two is a bug generator with no upside.

**[ASSUMED]** A skipped level is legal — a small plant may have a site and equipment
with no building or floor. Requiring every level would make the model unusable for
the single-plant installations this product mostly serves. The *order* of levels is
still enforced: equipment may not contain a building.

---

## 3. Closed vocabularies

**Decision.** Tags, units, media and directions are declared, closed sets validated
by the schema.

- **Units.** An unvalidated unit string is a number nobody can convert. The set is
  authored in the schema with its dimension, so `°C` and `K` are known to be the same
  dimension and `kWh` is not.
- **Media.** The existing `paths` already carry a medium concept for drawing; Phase 3
  makes it a validated vocabulary shared by paths and datapoints so a heating flow
  path and a heating flow temperature agree on what "heating flow" is.
- **Directions.** `input`, `output`, `bidirectional` for ports and datapoints.
- **Tags.** Free-form tags stay free-form, but *semantic* tags come from the closed
  set. **[ASSUMED]** two tag namespaces is clearer than forcing every existing free
  tag through a vocabulary that did not exist when it was authored.

**[OPEN]** The initial unit set is a judgement call. Execution seeds it from the
units the existing fixtures and the iDM profiles actually use, and extends it only
with evidence — an over-large vocabulary is as unhelpful as an absent one.

---

## 4. Provenance from Home Assistant registries (PROTO-01)

**[VERIFIED]** No registry is read anywhere in the Companion today. This is entirely
new surface.

Home Assistant exposes exactly what PROTO-01 needs, and the supported lanes
(2024.8.0 minimum, 2026.8.3 current) both provide it:

| Source | Helper | Fields this phase uses |
|---|---|---|
| Entity registry | `entity_registry.async_get(hass)` | `entity_id`, `platform` (the owning integration), `config_entry_id`, `device_id`, `area_id`, `device_class`/`original_device_class`, `unit_of_measurement`, `entity_category`, `disabled_by`, `hidden_by` |
| Device registry | `device_registry.async_get(hass)` | `id`, `identifiers`, `connections`, `manufacturer`, `model`, `name`, `sw_version`, `hw_version`, `via_device_id`, `area_id` |
| Area registry | `area_registry.async_get(hass)` | `id`, `name`, and `floor_id` where the installation has floors |
| Config entries | `hass.config_entries.async_get_entry(id)` | `domain`, `title`, `state`, `source` |
| State machine | `hass.states.get(entity_id)` | `state`, `last_changed`, `last_updated`, availability |

**Decision — protocol identification.** The protocol *is* the owning integration
domain from the entity registry's `platform`. The card maps a small set of known
domains (`modbus`, `knx`, …) to a display label and reports every other domain as
itself. It never parses an entity id or a friendly name.

**[VERIFIED]** This matters more than it looks: of the four protocols PROTO-01 names,
`modbus` and `knx` are Home Assistant core integrations, while BACnet and OPC UA are
served by custom integrations whose domains vary by installation. A hardcoded list
claiming to "support BACnet" would be a claim the code cannot keep. Reporting the
real domain is both more honest and more useful.

**Decision — communication health.** Derived from what Home Assistant reports:
the entity's presence in the state machine, `unavailable`/`unknown`, `disabled_by`,
the config entry's state, and the age of `last_updated` against a freshness budget.
The card opens no connection of its own. **[ASSUMED]** the freshness budget belongs
on the datapoint, defaulting per medium, because a room temperature and a burner
status age at very different rates.

**Decision — authorization.** Provenance is a shared read behind the Phase-2
boundary. A lookup naming an entity in a project the caller cannot see answers
exactly as a missing project does.

**[ASSUMED]** Registry reads are cheap enough to serve per request with a short
per-generation cache. If a large installation proves otherwise, the cache grows a
bound — but a measured bound, not a guessed one.

---

## 5. Versioned parametric profiles (PROF-01)

**[VERIFIED]** Today's `profile` has four fields and no version, so two projects
instantiating "the same" profile can silently mean different things.

**Decision.** A profile carries `id`, `version`, identity metadata, `slots`,
`controls`, `state_signals`, `alarms`, `ports`, `diagnostics`, `maintenance` and
`symbols`. An instance stores `profile`, `profile_version` and only its overrides.

**Decision — upgrades.** Instantiating twice is identical. Upgrading a version
preserves every override that still addresses something the new version has, and
*reports* the ones it cannot carry. **[ASSUMED]** reporting beats both alternatives:
dropping an override silently loses engineering work, and refusing the upgrade
strands the project on an old version forever.

**Decision — controls.** A profile control is a Phase-2 configured control. The
profile names a control id, its bounded input schema and its gates; the Companion
still resolves domain, service and target from the verified head. A profile must not
become a second way to name an effect, because that is precisely the authority
Phase 2 removed from the browser.

---

## 6. Ranked mapping with acceptance (MAP-01)

**Decision.** Ranking is a pure function of declared evidence, running identically in
both runtimes. Signals, roughly in descending weight:

1. an existing manual override (always wins, and is never re-ranked away);
2. device membership — the entity's device already carries other mapped datapoints;
3. profile expectation — the slot declares a device class, unit and direction that
   the candidate matches;
4. area/floor agreement with the equipment's semantic position;
5. integration provenance agreement with sibling datapoints;
6. unit and device-class compatibility;
7. name similarity — **last, and never sufficient alone.**

**Decision.** Every candidate carries the reasons that produced its score. A ranking
you cannot argue with is a ranking you have to trust blindly, which is the thing this
requirement exists to prevent.

**Decision.** Nothing binds automatically. The flow is rank → explain → preview a
semantic diff → human acceptance → undo available. **[VERIFIED]** the preview reuses
`project-diff.mjs` unchanged, which also means an accepted mapping goes through the
same dependency closure as any other change.

**[ASSUMED]** Manual overrides survive re-ranking by being stored as decisions rather
than as scores. A score-based override would decay the moment the ranking changed.

---

## 7. One deterministic operational state (OPS-01)

The requirement names sixteen conditions. Resolving them with nested conditionals
produces a function nobody can verify.

**Decision.** A fixed, ordered precedence table, resolved by data:

| Rank | State | Beats everything below because |
|---|---|---|
| 1 | `communication_error` | Nothing the card shows can be trusted. |
| 2 | `invalid` | A value outside its declared range is not a reading. |
| 3 | `stale` | An old value presented as live is the most dangerous display in the product. |
| 4 | `fault` | An active fault outranks any activity. |
| 5 | `interlock` | The plant is prevented from acting. |
| 6 | `locked` | A person has prevented it from acting. |
| 7 | `maintenance` | Declared out of normal service. |
| 8 | `local` / `manual` | Not under the control the operator is looking at. |
| 9 | `command_failed` | The last thing a person asked for did not happen. |
| 10 | `command_pending` | Something is in flight; the reading is provisional. |
| 11 | `warning` | Degraded but operating. |
| 12 | `running` / `standby` / `off` | Ordinary activity, only when nothing above applies. |

**Decision.** Safety and trust outrank activity. A datapoint with a communication
error is never `running`, however recently it said so, because the card does not
know that it is.

**Decision.** The resolver returns state, severity rank, quality, freshness, DE/EN
accessible label and the evidence that produced it. Symbol, colour, label and
drill-down are projections of that one value, so they cannot disagree — which is
exactly what OPS-01 asks to be proven.

**[ASSUMED]** `auto` and `remote` are *modes*, not states: they qualify a running
plant rather than replacing its state. They are reported alongside, so an operator
sees "running, remote" rather than losing one of the two.

---

## 8. Risks

| Risk | Handling |
|---|---|
| Schema 3 breaks an existing project | The 2→3 migration is dry-run first with a receipt, and the whole fixture corpus round-trips before the phase closes. |
| Registry access differs across the two HA lanes | Both lanes run the provenance suite; anything absent on the minimum lane degrades to `unknown` rather than raising. |
| The vocabulary is wrong | Seeded from real fixtures, extended on evidence. An error is recoverable; a silent passthrough is not. |
| Ranking looks authoritative | Reasons are always shown, nothing binds without acceptance, and every acceptance is undoable. |
| Route count and packaging drift | Phase 2's registration oracle and packaging drift guard already fail closed on both. |
