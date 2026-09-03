# 07-16 — Three renderings, one model

**Status:** complete. Closes T7-16, T7-17, T7-18 (D21, D22).

`printReport` called `reportCsv`, rebuilt rows by splitting on newlines and cells
by splitting on semicolons, then stripped quotes with a regex. A German decimal
list, an equipment name or an acknowledgement comment containing a semicolon
became extra columns; one containing a newline became extra rows.

**Deriving one rendering from another's serialisation is the defect, not the
symptom.** A better CSV parser in the print view would fix those four values and
leave the next four to be discovered by whoever types them. All three renderings
now come from the model and none reads another's output — and print takes a
*model* rather than a string, so it cannot be handed a serialisation by someone
who forgets.

**A cell is filled only by a sample inside that interval**; anything else is an
explicit blank. A blank is not a smaller claim than a borrowed value, it is a
different one and the honest one: "we did not measure this here" and "it was
five" are different statements, and only the first is true. Where an interval
holds several samples the last is taken, because the state at the end of the
interval is what a grid cell means — an aggregation question with an answer, not
a choice.

Every export states its aggregate, bounds, coverage, deadband, period and
timezone, or it cannot be reproduced or even interpreted later.

**An assertion the sentinel was missing.** Comparing screen against print proves
they agree, and both come from the model — so the CSV itself could have been
wrong with nothing noticing. A correct reader now has to recover exactly the
cells the model held, for the same four values a naive round trip destroys.

---

*Written retrospectively during 07-20 from the plan's commits (89e0307, bf2ae7a); the summary was missed when the plan landed. Nothing here is recalled — every claim is taken from the committed message and the code at head.*
