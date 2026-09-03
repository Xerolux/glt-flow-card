# 09-10 — Subscriptions are bounded and named

**Status:** complete. Closes T9-16.

Two failure modes, one plan.

**Unbounded subscriptions.** A supervision screen left open accumulates them,
and nothing in the shipped path counted. Four per site and sixteen in total,
with two hundred entities per subscription — bounds that are stated rather than
implied by whatever the browser happens to request.

**Subscribing to everything.** A subscription to a remote instance's event bus
delivers *every state change on that instance*, which is a firehose from a plant
this installation is supervising rather than running. The subscription records
`command: "subscribe_entities"` and names its entities, so the traffic is
proportional to what is being watched rather than to how busy the remote site
is.

Both bounds are the same idea as Phase 9's fan-out bounds: the cost of a site
must not grow with something the reader does not control — there, the number of
sites a colleague configured; here, the activity of a plant nobody is looking at.
