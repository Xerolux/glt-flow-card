# Phase 3: Semantic Equipment & Provenance - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning
**Mode:** Continuing the non-interactive full-delivery instruction that carried Phases 1 and 2

<domain>
## Phase Boundary

This phase gives the product one validated semantic equipment model. It defines the
Site → Building → Floor → System → Subsystem → Equipment → Datapoint hierarchy with
validated tags, units, media and directions; derives datapoint provenance and
communication health from Home Assistant's own registries rather than from names;
makes equipment profiles versioned, parametric and instantiable with migration-safe
overrides; ranks and explains entity-mapping candidates behind a human acceptance
step; and resolves one deterministic severity-ranked operational state per equipment.

It does **not** build the profile-driven object panel, deep-link navigation or
reconnect resynchronization — those are Phase 4 and consume the contracts settled
here. It does not implement fieldbus drivers: Home Assistant integrations remain the
only source of live values, and this phase reads what those integrations already
declare about themselves.

</domain>

<decisions>
## Implementation Decisions

### Schema version 3 and the semantic hierarchy
- The semantic model cannot be expressed in schema 2: `semantic_model` is an
  unvalidated open object, `sites` carries only an id, `datapoint` has no unit,
  direction, medium or provenance, and `profile` has neither version nor controls.
  Phase 3 therefore introduces schema version 3 with a sequential 2→3 migration,
  using the Phase-1 machinery (dry-run receipts, semantic diff, dual-runtime
  validators) rather than inventing a second migration path.
- The hierarchy is a typed containment tree with exactly one parent per node. Every
  reference is validated in both runtimes; a dangling reference and a containment
  cycle are contract errors with stable bounded paths, not warnings.
- Tags, units, media and directions are closed, declared vocabularies. An unknown
  unit is a validation error rather than a passthrough string, because a unit nobody
  validates is a number nobody can convert.
- A semantic path is derived from the tree, never authored twice. Nothing may store a
  denormalized path that can disagree with its parents.

### Provenance from Home Assistant registries
- Provenance is read from the entity, device and area registries and from config
  entries: integration domain, config entry title and id, device identifiers,
  connections, manufacturer/model, and the entity's availability. It is never
  inferred from an entity id, a friendly name or a naming convention.
- Protocol identification names the Home Assistant integration that owns the entity
  (`bacnet`, `modbus`, `knx`, `opcua`, …). Where an integration is unknown to the
  card, it is reported as unknown rather than guessed. "Looks like a Modbus point"
  is not evidence.
- Communication health is derived from what Home Assistant actually reports —
  entity availability, `unavailable`/`unknown` states, last-changed and last-updated
  — plus the card's own freshness budget. The card never opens a socket of its own.
- Provenance is served by the Companion and authorized per project, exactly like
  every other shared read. A registry lookup for an entity the caller may not see
  answers the same way a hidden project does.

### Versioned parametric profiles
- A profile carries an identity, a semantic version, slots, controls, state signals,
  alarms, typed ports, diagnostics, maintenance metadata and compatible symbols. It
  is authored once and instantiated many times.
- An instance stores only its overrides plus the profile id and version it was
  instantiated from. Instantiating twice from the same profile produces the same
  result; a profile upgrade preserves overrides that still apply and reports the ones
  it cannot carry, rather than dropping them silently.
- Control definitions inside a profile are the same configured controls Phase 2
  resolves server-side. A profile never gains a way to name a domain, a service or a
  target that Phase 2's boundary would refuse.

### Ranked mapping with human acceptance
- Mapping candidates are ranked from registry evidence, device and area membership,
  integration provenance, declared units, device classes and profile expectations.
  Each candidate carries the reasons that produced its score, so a ranking can be
  argued with rather than merely trusted.
- Nothing is bound automatically. The designer previews a semantic diff, a person
  accepts it, manual overrides survive re-ranking, and every acceptance is undoable.
- Ranking is pure and runs in both runtimes with identical results, so a mapping
  reviewed in the browser is the mapping the Companion applies.

### One deterministic operational state
- Sixteen inputs — auto, manual, local, remote, fault, warning, locked, interlock,
  maintenance, communication error, invalid, stale, command pending, command failed,
  running, standby, off — resolve through a fixed precedence to exactly one state.
  The precedence is data, tested exhaustively, not a chain of conditionals.
- Safety and trust outrank activity: a communication error or a stale value is never
  presented as `running`, because the card cannot know that it is.
- The state carries its quality, its freshness, its German and English accessible
  label and the evidence that produced it. Symbol, colour, label and drill-down are
  projections of the same resolved value, so they cannot disagree.
- Colour is never the only carrier of a state. Every state has a shape or a text cue.

### the agent's Discretion
- Module and vocabulary identifiers, the exact confidence formula and its weights,
  the internal representation of the containment tree, and the placement of the new
  designer surfaces may follow existing repository patterns.
- The provenance cache's shape and lifetime are free, provided a cached entry can
  never outlive the runtime generation that produced it.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/v100/project-migrations.mjs` already sequences migrations with canonical
  receipts and per-step digests; schema 3 needs one more entry, not new machinery.
- `tools/generate-project-validators.mjs` compiles each schema into both runtimes
  from one source, so a schema-3 file yields JS and Python validators together.
- `src/v100/project-diff.mjs` already produces semantic diff categories and
  dependency closure, which the mapping acceptance preview consumes unchanged.
- Phase 2's policy boundary, configured-control resolution and trusted evidence give
  provenance reads and profile-driven controls an authorization story that needs no
  new privileges.

### Established Patterns
- Raw-first validation: errors are reported against the authored document with
  stable bounded paths before any normalization.
- Dual-runtime parity: every contract rule is proven identical in Node and Python
  against one shared fixture corpus.
- Authored modules under `src/v100/` and `custom_components/` are the source; `dist/`,
  the Companion `www` copy and the editor bundle are generated and byte-compared.
- A phase closes on executable evidence: named owner commands, non-skipped counts and
  exact artifacts, never source-token matches or screenshots.

### Gaps This Phase Must Close
- `semantic_model` is `openObject` — completely unvalidated.
- `sites` is `identifiedObject` — an id and nothing else. No building, floor, system
  or subsystem level exists at all.
- `datapoint` has `id`, `entity`, `layer`, `positions` — no unit, direction, medium,
  provenance or health.
- `profile` has `id`, `equipment_type`, `extends`, `slots` — no version, controls,
  state signals, alarms, ports, diagnostics, maintenance metadata or symbols.
- No Home Assistant registry is read anywhere in the Companion today.
</code_context>
