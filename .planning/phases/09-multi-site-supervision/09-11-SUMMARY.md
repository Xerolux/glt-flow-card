# 09-11 — A view that is missing a site says so, in the view

**Status:** complete. Closes T9-18 and T9-19.

Not in a console, not behind a hover, not as a subtly different shade. The whole
value of a central supervision screen is that a person stops looking at five
screens — and the moment they do, an unnoticed missing site is a plant nobody is
watching.

**Every remote value carries its age and its site's health.** A value read an
hour ago from a site unreachable since reads exactly like a current one
otherwise. Both travel with the value rather than only in a banner, because a
banner scrolls away and a value does not.

**`unreachable` and `circuit_open` get different words *and* different shapes.**
One was asked and did not answer; the other was **not asked**, because it has
been failing. Showing them identically hides how long the problem has existed —
the difference between "check the network" and "that plant has been off since
Tuesday". Asserted with colour removed, because a tint conveys nothing on a
monochrome control-room kiosk, in forced colours, or to a screen reader.

**A complete roll-up still states its completeness.** If the note appeared only
when something was missing, its absence would come to mean "we did not check" —
the same reasoning as Phase 7's coverage badge at 100 %.

**Absent sites are named, not counted.** A count tells a reader something is
missing; a name tells them where to go and look.

**Nothing offers a retry beside an unknown effect.** The tempting addition is
exactly the dangerous one, so the test asserts zero buttons and zero links
beside `effect_unknown`, and asserts that the text does not say "wiederholen" or
"retry" — and that it does say what to do instead.

**Remote text is set as text content, never interpolated.** A site name is
authored somewhere this installation does not control, which makes it the most
hostile input the product handles. Asserted structurally — zero `img` elements,
zero `on*` attributes, no `window.__pwned` — because escaped text still contains
`onerror=` as characters and a substring assertion would pass on markup that
executed.

The name still has to reach the reader, ampersand and quotes included, so the
test asserts the hostile string appears verbatim as text.

**A runner defect found here, not by these tests.** The exact-dist runner
carried a hardcoded spec list, so new spec files were silently skipped — a
suite that reports success for tests it never ran. It now compares the list
against `test/e2e` on disk and throws on either direction of drift, verified by
mutation.
