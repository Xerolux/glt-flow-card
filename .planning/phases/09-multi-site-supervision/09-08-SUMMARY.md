# 09-08 — A remote timeout is not a failure

**Status:** complete. Closes T9-11 and T9-12.

A remote control produced no audit at all, on success or failure, and every
failure collapsed into one generic code. Remote controls now carry the same four
separated outcomes and the same trusted audit as local ones — the same store,
the same schema, not a parallel remote log.

**The distinction that matters more over a network, not less.** A timeout on a
`POST` is the canonical case where the service may well have run. Reporting it as
`failed` states something the Companion does not know, and the thing an operator
does next with "it failed" is send it again.

So a timeout is `effect_unknown`, distinct from `failed`, and **the surface
offers no retry beside it**. Repairing forward is a new, separately authorized
command — the rule Phase 4 established for local controls, holding unchanged one
hop further out.

Keeping the other side meaningful matters just as much: if every failure were
unknown, an operator could never be told a command definitely did not run.
`connection_refused` and `unauthorized` are `failed`, and they are safe to retry.

The route returns `{outcome, reason, readback}` — a readback, because Phase 4
established that only a confirmed read-back counts as a completed control, and a
remote one is no different.
