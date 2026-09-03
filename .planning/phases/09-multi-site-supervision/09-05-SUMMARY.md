# 09-05 — One request per site, and a deadline that belongs to the request

**Status:** complete. Closes T9-01, T9-02 and T9-17.

The shipped read asked per entity, with a fifteen-second timeout per request.
Two hundred entities against one unresponsive site is **fifty minutes inside a
websocket handler** — not merely slow but an availability defect, and the
obvious remedies (shorten the timeout, ask for fewer entities) make the answer
*less complete* rather than faster.

`GET /api/states` returns every state in one request. Filtering happens in the
Companion, because over a slow link the round trips *are* the cost.

**Three bounds, answering three different questions:**

| Bound | Question |
|---|---|
| concurrency | how many sites are asked at once |
| per-site timeout | how long one site may take |
| **total deadline** | how long the *request* may take |

The third is the one usually missing and the one that matters. Bounded
concurrency alone still lets *n* sites times a timeout accumulate. The deadline
belongs to the request and is **not divided among the sites**: someone waiting
for a screen has a time budget that does not depend on how many sites a
colleague configured.

A request that hits the deadline returns what it has, with the rest stated
absent — which is only safe because absence is a first-class answer here rather
than a zero.

**A truncated entity list says it was truncated**, and states the limit. Silent
truncation is this codebase's third occurrence of that shape; a caller asking for
three hundred entities and receiving two hundred without being told has a number
that is wrong in the comforting direction.
