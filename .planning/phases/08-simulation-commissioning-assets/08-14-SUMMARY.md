# 08-14 — The surfaces

**Status:** complete. Closes T8-09, T8-23 and T8-24.

Seven custom elements in German and English, rendering what the Companion
decided.

**`simulated` is asserted with colour removed.** The test injects a stylesheet
forcing every colour to black on white and requires the word *and* the shape to
survive. Mutation-verified: marking by colour alone fails with "the word is
missing with colour removed". A tint conveys nothing on a monochrome
control-room kiosk, in forced colours, or to a screen reader.

The opposite case is asserted too — a *measured* value must not be marked. A
surface that marked everything would pass the first test while telling the
operator nothing.

The provider travels **next to the value**, not only in a banner, because a
banner scrolls away and a value does not.

**An expired session says so rather than disappearing.** A banner that vanishes
is indistinguishable from one that was never there, and the operator needs to
know the plant is live again — that transition is exactly when the belief this
phase guards against is most likely to be wrong.

Form fields, never `prompt()`: the third surface in this project to replace one.

Injection is asserted **structurally** — no elements created, no `on*`
attributes, no global written — and separately that the operator's text still
reaches the reader, ampersand and quotes included.
