# 04-10 — The browser renders what it is given

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

`src/v100/panel-model.mjs` renders the regions the server sent, in the order it
sent them, and nothing else. A region the server did not send is not rendered —
there is no placeholder, no empty shell, no "coming soon".

The browser derives **no role, capability or control list**. It has no table
mapping roles to controls, so there is no second authority to drift out of
agreement with the first. Everything a Phase-4 surface can click is something
the server already said this principal may do.
