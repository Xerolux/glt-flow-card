# 04-07 — Address resolution with no enumeration oracle

> **Reconstructed at close-out**, from this plan, `04-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

`custom_components/glt_flow_card/navigation.py` re-authorizes **from scratch on
every resolve**. Not once per session, not cached per address: a URL gets
pasted into a chat and opened by somebody else, and access can be revoked
between two clicks of the same link.

Malformed, unknown, non-member and deferred-remote addresses answer
byte-identically. Depth and length are bounded *before* any tree walk, so a
long address cannot be used to measure the shape of a tree the caller may not
see — the timing of a rejection is an oracle too.
