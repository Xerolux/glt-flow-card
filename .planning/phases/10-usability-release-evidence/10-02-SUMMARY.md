# 10-02 — One catalog per language, and a lookup that refuses

**Status:** complete. Closes T10-01.

406 keys at the time of this plan, from eight modules. **A third locale was a
code edit** and that is what this fixes: strings written as `{ de, en }` pairs
inside modules mean adding French means editing every module that renders
anything, so I18N-01's "more locales can be added without code edits" was false
for the whole product.

**The lookup has no fallback.** The three spellings it replaces —
`table[key] ?? COPY.en[key] ?? key`, `TEXT[key]?.[language] ?? TEXT[key]?.en`,
`COPY[locale]?.[key] ?? COPY.en[key] ?? key` — resolved a missing German string
to the English one, indistinguishable from a term deliberately left in English,
or one fallback further to the raw key rendered as UI text. Both are invisible
to everyone except the operator they fail.

**Wording that takes values is a template, not a function.** A function cannot
be supplied as data. Placeholders are named rather than positional, because
`(answered, total)` and `(total, answered)` are the same call and a different
sentence, and a translator working from the German string cannot see the order.

Five defects the migration surfaced, each fixed rather than worked around: eager
resolution of templated keys in the re-exported tables, three direct table reads
that survived the table, a nested `diagnosis` lookup that rendered `wrong_unit`
to a plant engineer for any unlisted code, a confirm bridge asking the wrong
namespace (which worked only because of the fallback, and produced a dialog with
no focusable control once it was gone), and a placeholder pattern that rejected
underscores and left `{backup_id}` in a rendered sentence.
