---
phase: 3
slug: semantic-equipment-provenance
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-02
sources:
  - .planning/phases/03-semantic-equipment-provenance/03-CONTEXT.md
  - .planning/phases/03-semantic-equipment-provenance/03-RESEARCH.md
  - .planning/phases/02-authoritative-policy-controls-collaboration/02-UI-SPEC.md
  - src/v100/project-safety.js
---

# Phase 3 — UI Design Contract

> Visual, interaction and accessibility contract for the semantic hierarchy, datapoint
> provenance, versioned profiles, explained entity mapping and the single operational
> state. Phase 3 extends the existing designer and Project Safety surfaces; it does not
> build the Phase-4 object panel.

---

## Design Intent

Phase 3 makes the model *legible*. Before acting, a user must be able to answer:

1. Where is this equipment in the plant, and what contains it?
2. Where does this value come from, and is it actually live?
3. What profile is this, at what version, and what did I change about it?
4. Why is this entity the suggested mapping, and what happens if I accept it?
5. What state is this equipment in, and what evidence says so?

Every one of those answers is shown with the evidence that produced it. A ranking
without reasons, a state without freshness, or a provenance claim without a source is
not shippable in this phase — the whole point is to remove blind trust.

### Locked product language

- Preserve the three-column designer, the compact toolbar, the themes, the single
  **Project safety** entry and its exact five tabs. Phase 3 adds no sixth tab.
- The semantic hierarchy appears in the existing left-hand structure column, not in a
  new window.
- Provenance and operational state appear where the datapoint or equipment already
  lives. Phase 3 supplies the primitives; Phase 4 assembles the object panel.
- Mapping is a review surface, never a background process. Nothing binds without an
  explicit acceptance.
- German and English are complete and equal. Every new state, reason code and error
  has copy in both before the phase closes.

### Principal-state hierarchy

| Principal state | Focal point | Required subordinate information |
|---|---|---|
| Browsing the model | The node's name and its derived semantic path | Level, parent, child count |
| Reading a datapoint | Current value with its quality and freshness | Integration, device, config entry, health |
| Reviewing a mapping | The ranked candidate list | Score, reasons, what acceptance would change |
| Instantiating a profile | Profile name and version | Slots to fill, overrides carried, overrides that cannot be carried |
| Reading a state | The resolved state token | Severity, quality, freshness, evidence, mode qualifiers |

---

## Design System

Unchanged from Phases 1 and 2: existing native Web Components and Shadow DOM, the
Neo 2030 dark and Clean/Operations Light themes, existing `.glt-safe-*` and
`.glt-v1-*` patterns, Inter for interface text and `ui-monospace` for identifiers.
No React, Tailwind, shadcn or external registry is introduced. Spacing stays on the
4-based scale, touch targets stay at 44×44 px, focus outlines stay 2 px with 2 px
offset.

---

## Component Inventory

| Component | Purpose | Required states |
|---|---|---|
| `SemanticTree` | Navigate the containment hierarchy | loading, ready, empty, filtered, invalid-node, over-bounds |
| `SemanticPathBreadcrumb` | Show a node's derived path | complete, partial (levels skipped), unresolved |
| `ProvenanceCard` | Where a datapoint's value comes from | registry-complete, partial, unknown-integration, entity-missing, disabled, unauthorized |
| `CommunicationHealthChip` | Is this value live | live, degraded, stale, unavailable, disabled, unknown |
| `ProfileVersionBadge` | Which profile version this instance is | current, upgradable, ahead, unknown |
| `ProfileUpgradePreview` | What an upgrade would do to overrides | carried, adjusted, cannot-carry, blocked |
| `MappingCandidateList` | Ranked candidates with reasons | ranking, ready, empty, manual-override, accepted, undone |
| `MappingReasonList` | Why a candidate scored as it did | evidence rows, always visible, never truncated without a full view |
| `EquipmentStateBadge` | The one resolved state | the 15 precedence states plus mode qualifiers |
| `StateEvidencePanel` | What produced the state | inputs, precedence rank, quality, freshness |

All interactions use native buttons, fields, selects, tables, disclosures and dialog
semantics. A styled `<div>` is not a button, a tab or an alert.

---

## Semantic hierarchy

- The tree shows one parent per node and the level of each node as text, not only as
  indentation — indentation alone is invisible to a screen reader and to anyone
  scrolling a deep tree.
- A node whose parent is missing or whose chain loops renders in an explicit
  `invalid-node` state naming the stable contract path, and never silently disappears.
- A skipped level is normal and is shown as a gap in the breadcrumb, not as an error.
- Keyboard: arrow keys move within the tree, Home/End jump to first/last sibling, and
  the tree exposes `aria-level`, `aria-setsize` and `aria-posinset`.
- The tree never shows a node from a project the viewer cannot read, and never shows a
  count that includes one.

## Datapoint provenance

- The card names the **integration domain** exactly as Home Assistant reports it, with
  a friendly label only for domains the card knows. An unknown domain is shown as
  itself and labelled `unknown protocol` — never guessed from the entity id.
- Every provenance row states its source: entity registry, device registry, area
  registry, config entry or state machine. A row with no source is not rendered.
- Device identifiers and connections are bounded and truncated with a full-value
  disclosure. They are never echoed wholesale into the DOM.
- `CommunicationHealthChip` is derived, never authored: availability, disabled state,
  config-entry state and the age of `last_updated` against the freshness budget.
  `stale` and `unavailable` are visually distinct from `live` by shape and text, not
  only by colour.

## Profiles

- The version badge is always present. An instance whose profile version is unknown
  says so rather than showing the profile's current version.
- `ProfileUpgradePreview` lists three groups explicitly: overrides carried, overrides
  adjusted, and overrides that cannot be carried with the reason for each. Upgrading
  requires acknowledging the third group when it is non-empty.
- Slots and controls declared by a profile are read-only in the instance. An instance
  edits its overrides, never the profile.

## Mapping review

- Candidates are listed highest first with score, and every candidate shows its
  reasons inline. A reason list is never collapsed behind a hover.
- A manual override is visually marked as a decision, sorts first, and is not
  re-ranked. Removing it returns the candidate to the ranked list.
- **Accept** opens the standard semantic diff preview and requires confirmation. The
  confirmation names the number of operations and the equipment affected.
- **Undo** is available after acceptance for the whole accepted batch, and says what
  it will revert.
- Name similarity, where it contributed, is always labelled as the weakest evidence,
  so a mapping that rests only on a name is visibly weak.

## Operational state

- One badge per equipment, carrying the state token, a shape or glyph, and text. Never
  colour alone.
- Quality and freshness are adjacent to the state, not behind a hover.
- Mode qualifiers (`auto`, `remote`) render beside the state, so an operator reads
  "running · remote" rather than losing one of the two.
- `StateEvidencePanel` lists every input that was considered, marks the one that won
  and its precedence rank. That panel is the drill-down OPS-01 requires to agree with
  the badge — both read the same resolved value.

---

## Accessibility

- German and English copy is complete for every state, reason code, health value and
  error before the phase closes.
- Every state and health value has a non-colour cue.
- The tree, the candidate list and the evidence panel are fully keyboard operable with
  visible focus.
- Reflow at 320 px and at 200 % zoom without horizontal scrolling of the page body;
  wide tables scroll inside their own container.
- Forced-colors and reduced-motion are honoured, following the Phase-1 and Phase-2
  media-query patterns already in `project-safety.js`.

## Prohibited

- No colour-only state. No hover-only reason or disabled explanation. No inferred
  protocol. No automatic binding. No count or node from an unauthorized project. No
  provenance row without a source. No stored semantic path.
