# Future Roadmap — candidates beyond v1.1

**Created:** 2026-09-02
**Status:** Not planned, not scheduled, not authorized. This file exists so that
a decision deliberately not taken stays visible instead of being rediscovered as
a gap.

Nothing here is part of the v1.1 milestone. Each entry records what was decided,
what was *not* chosen and why, what it would cost, and what would make it worth
revisiting.

---

## F-01 — Executable extension contributions (SDK option B)

**Owner requirement if adopted:** a successor to SDK-01
**Decided against for v1.1:** 2026-09-02, during Phase 5 planning
**Decision confirmed by the user:** 2026-09-02 — stay on option A, record B here

### What v1.1 ships instead (option A)

A contribution is **data**. A symbol pack contributes geometry declarations; a
renderer, widget or panel contributes a declarative descriptor that first-party
code interprets. No contributed JavaScript is loaded, evaluated or executed, in
any realm. The manifest validator allowlists SVG elements and attributes, and the
browser effect ledger asserts zero evaluation and zero contributed network with a
seeded violation proving the assertion can fail.

### What that forecloses, concretely

Any contribution whose appearance is *computed* rather than *described*:

- a level indicator whose bar height comes from a vendor's own characteristic
  curve rather than a linear mapping;
- a widget that combines several entities under a rule the card does not already
  implement;
- a renderer that draws differently depending on values, beyond the declarative
  expressions the card defines.

The boundary is precise: **every computation must be expressible in the
vocabulary the card defines.** Declarative expressions can be extended
(`height = linear(value, 0..100)` and similar), but a genuinely new *kind* of
computation requires a first-party release, not a third-party pack.

### What option B would be

Contributed code executing in a Worker behind a message contract: the card sends
inputs, the Worker returns geometry, and nothing else crosses the boundary.

### What it would cost — the reason it is a phase, not an add-on

- **A message contract that becomes a compatibility commitment.** Whatever shape
  ships must keep being read by every later version.
- **Validation in both directions.** Inbound messages are already untrusted;
  outbound geometry from a Worker is untrusted too, and must be validated against
  the same allowlist as declarative contributions.
- **Resource bounds:** CPU, memory, and a timeout, with a defined behavior when a
  Worker exceeds them mid-render.
- **A data-exposure decision.** A Worker rendering a symbol needs the value. Does
  it get the entity id? The unit? The project? Each answer is a permanent
  disclosure boundary, and Phase 2's filter-before-serialization rule applies.
- **A Worker is not a sandbox.** It has no DOM, but `fetch` works there. Network
  must be actively denied by CSP rather than assumed absent — the same mistake as
  treating same-realm JavaScript as isolated, one layer down.
- **An installation and review policy.** Option A needs none, because there is
  nothing to review beyond schema conformance.

### Why deferring is cheap

Contributions are namespaced and versioned, and each declares the project schema
versions it supports. A `worker` contribution kind can be added later as a new
kind without breaking any pack written against option A. Choosing A now is
reversible; shipping B and later restricting it would not be.

### What would make this worth revisiting

- A concrete third-party integrator asking for computed rendering, with a named
  use case rather than a general wish.
- Evidence that the declarative expression vocabulary keeps growing one
  first-party release at a time to serve individual vendors — that is option B
  arriving slowly and without its safeguards.

---

## F-02 — Public distribution of symbol packs

**Decided against for v1.1:** 2026-09-02, during Phase 5 planning

v1.1 supports **local installation only**. Publishing a pack — a public
repository, a registry, a discovery mechanism — requires an exact target and
separate explicit authorization, and none has been given. The same standing
constraint already applies to public HACS repositories, GitHub releases and Pages
deployments.

Revisiting this means answering who signs a pack, who hosts it, what happens when
a published pack is withdrawn, and how an installation learns that a pack it
already trusts has been revoked. None of those questions is answered by the
installation format alone, which is why the format ships first and distribution
does not ship with it.

---

## How to use this file

An entry moves out of here by being promoted into `ROADMAP.md` as a numbered
phase with its own requirements, or by being closed with a recorded reason. It
does not move by being implemented quietly: each entry names a decision someone
made, and unmaking it is also a decision.
