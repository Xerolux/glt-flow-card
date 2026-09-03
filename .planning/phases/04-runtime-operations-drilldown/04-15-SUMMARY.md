# 04-15 — Keyboard, symbol and language, on the shipped artifact

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

The complete workflow is keyboard-traversable on the pointerless kiosk layout —
the control-room screen with no mouse is where this product is actually
installed, so it is the layout the matrix treats as primary rather than as an
accessibility afterthought.

Every state is conveyed by symbol **and** text, never by color alone.

German and English are complete at every layout, and the exact-dist matrix
caught a real responsive bug doing it: **German overflows 320px** where English
does not. An English-only matrix would have shipped that.
