# Phase 10 — Product-Wide Usability and Release Evidence

**Status:** closed. 15 of 17 threats verified, each from its own owner command
run at head. **T10-03 is `not met`** — the phase's own discipline applied to
itself — and T10-16 is blocked by the environment, recorded with its exact
failure.

**Evidence at head:** 521 Node, 691 Python, 92 exact-dist browser,
`verify-docs-site` 28 sources / 41 byte-identical site files, claim registry
12 passed / 1 failed / 4 not exercised.

## What this phase was about

Each phase has had a characteristic way of being wrong:

- Phase 6: an effect that fails silently.
- Phase 7: a number wrong in a plausible direction.
- Phase 8: a belief about the plant that is comforting and false.
- Phase 9: an answer that is incomplete and does not say so.
- **Phase 10: a claim about the product that nothing behind it supports.**

Localization, accessibility and release evidence look unrelated. They are the
same defect from three angles:

- *"The product is localized"*, when 5,561 lines of the shipped card hardcode
  German and a third locale needs code edits.
- *"The product is accessible"*, when the runtime contains zero `aria-label`
  attributes and no automated check has ever run.
- *"The product handles 2,000 objects"*, when the number came from a
  diagnostics micro-test and no budget was ever recorded.

## The headline

**The registry is the phase, and its run is honest about this product:
12 passed, 1 failed, 4 not exercised.**

Every published claim cites a command and what that command said. Three rules,
each closing a row:

- **A claim with no evidence fails the build.** Not a warning. The failure mode
  was already in the repository: `README.md` said "`test/` – lightweight
  validation tests" while the suite was 521 Node and 92 browser tests. Harmless
  in that direction; the same staleness the other way is an operator trusting
  something that stopped being true.
- **A failed claim is published as failed.** Omitting it lets its absence read
  as "not applicable" — Phase 9's counting-oracle shape, one level up.
- **Automated and manual accessibility evidence cannot merge into conformance.**
  There is no field in which they combine. The merge is not a policy someone can
  override; it is a structure with nowhere to put the result.

T10-10 and T10-13 are **this phase auditing itself**: both describe a claim this
work was in a position to make and would have been believed about. That is why
the registry is a build step — a document is edited by whoever wants the claim.

## What else shipped

**A locale is data now.** Wording lived in fourteen modules as `{ de, en }`
pairs, which made adding French an edit to every module that renders anything.
683 keys in two flat catalogs, and the lookup **refuses**: the three spellings
of `?? COPY.en[key] ?? key` it replaces showed a German operator an English
sentence, indistinguishable from a term deliberately left in English, or the raw
key as UI text. A pseudo-locale generated at test time proves the refusal is
reachable.

**The English half of the symbol vocabulary did not exist.** 208 labels —
symbols, profiles, slots, controls, styles, domains, and the legacy card's own
separate symbol library — were German only. Moving them was also authoring them.

**Templates, not functions.** `de: (seconds) => …` cannot be supplied as data,
which made a locale a code edit even where the wording was already bilingual.
Placeholders are named rather than positional, because `(answered, total)` and
`(total, answered)` are the same call and a different sentence.

**Plurals became data**, checked against Polish (four forms) and Arabic (six) —
German and English are the easy pair that made the conditional look fine.

**Formatting refuses rather than guessing.** The fallback to
`new Date(value).toLocaleString()` put the viewer's locale on a screen using the
configured one: `03/09` and `09/03` are the same instant written two ways, and
nothing said which.

**Accessibility went from nothing to asserted.** Every focusable element has a
role and a name; focus survives colour removal; nothing traps the keyboard; the
page reflows at 320 px; an automated sweep covers every registered surface with
no rule disabled. Coverage is self-maintaining: elements record themselves as
they are defined, so a surface added later is swept without anyone remembering.

**Five real accessibility defects, found and fixed rather than silenced** — the
status palette failing contrast on every light screen (1.87:1 where AA asks
4.5), a staleness strip dimmed to 60 % opacity so the line saying "not live" was
the least legible thing on screen, a `role="grid"` announcing its empty state as
a row, two tables with blank column headers, and three form inputs with no
labels at all.

**Capacity is a shape, not a number.** Six scenarios at three sizes, committed
before anything measured them, each carrying the object count it actually built
— and every measurement carrying the environment it was taken in, where nothing
in the harness can mark one representative.

## Defects found in the work rather than in the product

**A vacuous pass that every suite missed.** After the symbol catalog moved to
`{de, en}` pairs, 517 Node and 92 browser tests passed while the symbol browser
rendered `[object Object] · [object Object]` in four places. The assertions
checked that *something* was rendered rather than what. Fourth occurrence of
that shape in this codebase, and found by looking at the screen.

**Phase 5's contrast floor measured against a ground the page never paints.** It
read `getComputedStyle(document.body).backgroundColor`, got `rgba(0,0,0,0)`, and
parsed transparent as black — so a bright colour looked compliant and a dark one
looked broken.

**The accessibility test's own first version was wrong.** It checked three name
sources and reported six correctly labelled inputs as unnamed. A check that
reports work already done is a check people learn to ignore.

**A no-break space arrived by accident and was nearly kept by accident.** It is
the right character between a value and its unit — a number that wraps away from
its unit is a number with no unit on the line being read — so it is now named,
escaped and asserted rather than invisible in a diff.

**The sweep's first version produced 444 findings**, burying the ones that
mattered under js-yaml's parser diagnostics and ajv's schema text. Scope is
decided by provenance now, using the bundler's own module banners.

## What this phase did not finish

**T10-03 is `not met`, and that is stated rather than rounded off.** 132
user-facing strings in the shipped artifact still do not come from a catalog:
the legacy card's two generated bases and the entry module. The sweep names each
one — with a list, not a count, so the number cannot creep back up unnoticed and
every line is one thing to move.

It is not left `planned` either. `planned` reads as work not started; this work
started and did not finish.

## Limits of what this phase proves

- **No manual accessibility evidence exists.** No assistive technology can be
  driven here. A test asserting that something "would be announced correctly" is
  asserting a belief, and none was written. **No conformance statement is
  supportable**, regardless of what the automated sweep reports.
- **The capacity numbers are not capacity.** A shared container with no declared
  CPU allocation. They support "this scenario is bounded and runs" and the
  budget file says so in the data rather than in a comment.
- **The composed release leaf did not run.** No Docker engine; nothing here
  demonstrates the artifact installing on either pinned Home Assistant lane.
- **Release provenance is blocked** for this session, which blocks the Phase-1
  gate and every gate recursing into it — so no phase gate from 2 upward has
  ever completed its recursion in this environment.
- **Automated checks decide a minority of WCAG criteria by construction.** That
  is not a caveat on this phase's result; it is the reason the result is phrased
  the way it is.
