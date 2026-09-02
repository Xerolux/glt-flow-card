---
phase: 10-usability-release-evidence
requirements: [I18N-01, A11Y-01]
---

# Phase 10 UI Specification

This phase adds almost no new surface. It changes how every existing surface
behaves for a person who is not reading it with a mouse, in German, on a
desktop.

## The rule

**Everything a sighted mouse user can perceive, someone else can perceive
too — by a different route, not a degraded one.**

Every earlier phase already asserted the *hard* half of this: state is conveyed
without colour, gaps are breaks rather than lines, `unreachable` and
`circuit_open` are different words and shapes. What is missing is the routine
half — names, roles and focus — which is the half automated checks can reach and
which this product has none of.

## Names and roles

Every interactive element has:

- a **role** that matches what it does, from the element itself wherever
  possible (`<button>`, not `<span role="button">`);
- an **accessible name** that says what it does, not what it is. "Alarm
  quittieren" rather than "Schaltfläche";
- a name that survives translation, because it comes from the catalog.

A `title` attribute is not a name and a `placeholder` is not a label. Both
already appear in the legacy base and both are replaced rather than supplemented.

Structures that carry meaning carry a role. The list of absent sites in a
Phase-9 roll-up is a list and is announced as one; the count of missing sites is
part of the roll-up's own accessible description, not a separate visual
fragment.

## Focus

- Focus is **visible** against both themes, and the indicator is not the only
  thing distinguishing it — a focused control that only changes colour is
  invisible in forced-colours mode.
- Focus is never **obscured** by a sticky header, a panel or an overlay.
- There is no **trap**: everything reachable by keyboard is leavable by
  keyboard, dialogs included.
- Focus order matches reading order. Where a drag interaction exists in the
  designer, a keyboard alternative exists and is discoverable — a drag with no
  alternative is a feature only some people have.

## Announcements

A change a sighted user notices because it moved must be announced. Specifically:

- a control outcome (`accepted`, `sent`, `confirmed`, `effect_unknown`,
  `failed`) is announced when it arrives, and `effect_unknown` announces its
  full sentence rather than the word;
- a roll-up that becomes incomplete announces that it became incomplete;
- an alarm arriving announces once, not per re-render.

Announcements are polite by default. The exception is a safety-relevant outcome,
which is assertive — an operator must not learn from the next screen refresh
that a command's effect is unknown.

## Reflow, zoom and touch

- 200 % zoom and a 320 px viewport both reflow without horizontal scrolling of
  the page. Wide content — tables, charts, diagrams — scrolls **inside its own
  container**.
- Touch targets are large enough to hit on a tablet in a plant room, which is
  the environment the product is actually used in.
- Reduced motion is honoured. A transition that conveys nothing is removed
  rather than shortened.

## Language

- Every string comes from a catalog, in both languages, with the missing-key
  check that fails at load.
- The document's language is declared and changes with the configured language,
  so a screen reader pronounces German as German.
- Text direction is not hardcoded. RTL readiness means the layout does not
  assume left-to-right; it does not mean an RTL locale ships.

## What this phase does not add

- No new panels, no new controls, no visual redesign.
- No accessibility settings screen. Accessibility that has to be switched on is
  a feature for people who know to look for it.
- No RTL locale. Readiness is proven; a locale is data someone else can add.
