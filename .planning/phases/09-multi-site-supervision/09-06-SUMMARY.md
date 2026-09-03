# 09-06 — Failures are a closed set, and credentials do not leave

**Status:** complete. Closes T9-06 and T9-07.

The Companion returned `str(err)` to the browser. Connection errors carry the
host and port they failed to reach, so a caller could **enumerate internal
topology by provoking failures** — a network map assembled from error messages,
from a route that looks like it only reads states.

Failures are now a closed set of reasons. The exception is logged server-side
and never returned.

**The credential half is searched for, not asserted.** A sentinel token is sent
through every path, *including every error branch*, and looked for in everything
that comes back: responses, log lines, exports, error payloads. "No token is
returned" by inspection is the claim that inspection is exactly what missed the
browser-side diagnostic in Phase 8; a search finds the branch nobody thought
about.

Error branches are where credentials leak, because they are the paths written
last and read least — which is why the sentinel goes through them specifically
rather than through the happy path alone.
