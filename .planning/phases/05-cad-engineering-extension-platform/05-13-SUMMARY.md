# 05-13 — A paste that copies instead of aliasing

**Status:** complete
**Requirements:** CAD-01 · **Threat:** T5-10 GREEN

## The line this replaces

```js
o.id = `${o.id || c.kind}_${Date.now().toString(36)}_${Math.random()...}`
```

Two things are wrong with it, and the second is why the first went unnoticed.

It mints a new id and rewrites **nothing** that referred to the old one, so a
pasted connection still points at the objects it was copied from — two diagrams
silently sharing state. And it seeds from the clock and a random number, so the
same paste is not reproducible, which makes the bug hard to demonstrate twice
and impossible to diff.

## What shipped

`src/v100/designer-clipboard.mjs`: `serializeSelection`, `pasteSelection`,
`danglingReferences`, `CLIPBOARD_MAX_BYTES`, and a self-describing payload
format with its own version.

## The decisions

**A paste is a pure function of the payload and a seed.** The same selection
pasted with the same seed produces the same bytes on every machine, which is
what lets two people paste the same subsystem and get a merge with nothing in
it. Determinism is a collaboration property here, not a testing convenience.

**No seed means refuse, not default.** A default seed would be one more place a
clock could get back in, and the caller is the only one who knows what makes
*this* paste distinct from the last one.

**A collision is resolved by counting, not by re-seeding.** Re-seeding from
anything the environment supplies would put the clock back where it was.

**Every reference kind is rewritten from one map** — connection endpoints, group
membership, master references, layer assignment, group nesting — and each of
those was a separate way the previous version dangled.

**Port ids are not rewritten.** They are scoped to a profile, and the profile is
not being copied.

**The bound runs on the bytes.** A clipboard is an input from outside: a person
can paste anything a person can copy, from anywhere. Copying is bounded at the
same size as pasting, so a selection that could not be pasted cannot be produced
either.

**The payload declares its own format and version.** A payload from a different
tool, or from a future version of this one, is refused rather than half-read.

## Evidence

`node --test test/designer-clipboard.test.mjs` — 10 tests, all passing.

- `danglingReferences` enumerates every reference in a pasted project and finds
  nothing — and the test that it *can* find something deliberately re-points two
  references at source ids and requires both to be reported. A check that has
  never failed is not evidence that it can.
- Pasting into the source project doubles the objects, produces no colliding
  ids, joins the copied connection to the copies rather than the originals, and
  leaves the source untouched.
- Two seeds give two different copies; one seed gives the same copy twice.
- Four malformed payloads — not JSON, wrong format, unsupported version, not an
  object — are each refused with their own message before anything is read.
- The size bound is asserted at both ends, on the bytes rather than on the
  parsed value.
