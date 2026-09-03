# 09-07 — Remote routes enforce what their local equivalents enforce

**Status:** complete. Closes T9-08, T9-09 and T9-10.

`remote/states` checked nothing. Any websocket caller could read any entity of
any configured site — the local path's whole authority model, skipped by going
one network hop further out.

**Remote is not a second product.** Every remote route now enforces the same
capability and the same project scoping as its local equivalent. A site belongs
to projects, and that binding is server configuration; being authorized on
project A does not operate site B. Checking a *role* alone was the previous
defect, and a role is not a scope.

**The listing is filtered and then limited.** The other order turns the limit
into a counting oracle: a caller learns how many rows exist that they may not
see, which is the enumeration Phase 2 closed for projects arriving here as site
names and URLs. `remote/list` therefore takes a `limit` and applies it after
filtering, and `remote/states` is filter-shaped — an unauthorized site comes back
*absent with a reason*, not as a denial that confirms the site exists.

Two corrections during the work are worth recording.

**A policy-prober conflict, not a product bug.** The routes were declared
`state="deferred"`, `not_permitted` is not a stable code where the guard answers
`invalid_input` for an unsafe domain, and `remote/list` had no `limit` parameter
declared. The prober was right each time and the declarations were stale.

**A test that passed a client where Home Assistant's connection object was
expected** proved nothing about the route; it was rewritten to exercise the
route itself.
