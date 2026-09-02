# 10-05 — Formatting that refuses, and plurals that are data

**Status:** complete. Closes T10-04 and T10-05.

```js
catch (_err) { return new Date(value).toLocaleString(); }
```

On any error the timestamp was formatted in the **browser's** locale while the
rest of the screen used the configured one. `03/09` and `09/03` are the same
instant written two ways and nothing said which was which — an ambiguity defect
on a plant display. The hardcoded `"de-DE"` default had the same shape: a locale
the installation never chose.

A formatter that cannot format returns the marked-unreadable sentinel Phase 7
already established, rather than inventing a second behaviour for the same
situation.

**Plurals became data.** `gaps === 1 ? "Lücke" : "Lücken"` is a code edit per
locale and wrong outright above two forms. `pluralCategory` returns a CLDR
category, asserted against Polish (four) and Arabic (six).

**The unit separator is a no-break space, deliberately.** It arrived in this
file by accident and was nearly kept by accident; it is now named, escaped and
asserted, because an invisible character that matters is one nobody can review
in a diff — and a number that wraps away from its unit is a number with no unit
on the line the reader is looking at.

The legacy base is concatenated before the v1 bundle and cannot import, so it
reads the formatters off the SDK at call time. Sharing one formatter is the
point: two formatters is how the two date formats appeared.
