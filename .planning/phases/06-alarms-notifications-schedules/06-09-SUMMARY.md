# 06-09 Summary — the entity index

**Status:** complete. 8 index tests.

**D3 closed.** The subscription follows an entity→alarm index and Home Assistant
does the filtering. An index is a cache, and a cache that misses a rebuild is
*worse* than the scan it replaces: the scan was slow, the stale cache is quietly
wrong. So there is one builder, `INDEX_MUTATION_PATHS` declares which paths must
rebuild, and the test asserts its own mutation list equals that declaration.

The comparison is against an **independent full rescan written in the test**.
Comparing a function with itself proves determinism; the claim is correctness.

**Two things this turned up.** My own index and `_entity_id` disagreed about
what an alarm watches — the engine accepted `{"id": ...}` and the manager does
not — so an alarm authored that way would have been watched and never evaluated.
And the lifecycle ledger could no longer see the subscription, because
`async_track_state_change_event` was outside the seam it wraps; it is wrapped now
as a pass-through, since the helper registers a shared bus listener the existing
wrapper already counts.

The zero-alarm listener count drops from 2 to 1: an installation with no alarms
now subscribes to nothing, where it previously listened to every state change in
the instance.
