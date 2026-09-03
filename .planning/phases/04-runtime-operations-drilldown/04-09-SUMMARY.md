# 04-09 — The address is the state

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

`src/v100/navigation.mjs` keeps the whole view state in the URL and nowhere
else, so bookmarking, sharing and history behave the way the rest of the web
does.

Back and forward **re-resolve through the server**; a cached view is never
replayed. This is what makes history correct after a revocation: the back
button on a view you have since lost access to must show the refusal, not the
copy your browser still holds.

Time and alarm context survive every transition, so stepping back does not
silently move an operator to "now".
