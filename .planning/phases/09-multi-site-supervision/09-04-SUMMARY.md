# 09-04 — Unreachability belongs to the site

**Status:** complete. Closes T9-13 and T9-15.

A failed read used to write, per entity:

```python
result[entity_id] = {"state": "unavailable", "error": resp.status}
```

`unavailable` is a real Home Assistant state. An entity genuinely unavailable at
the remote site and one we could not ask produced the same word — so a plant that
had dropped off the network looked like a plant whose sensors were down.

An entity we could not ask simply has **no reading**. Inventing one is the
defect. Health is a property of the site, merged from its answers.

**The circuit breaker, and the defect inside it.** A site that is down is
otherwise retried by every client on every request, so the cost of a dead site
grows with the number of people looking at it. The breaker opens after three
failures, says it is open, and closes again through a single bounded probe.

The first implementation stamped `opened_at` only when it was `None`:

```python
if state.failures >= self.threshold and state.opened_at is None:
    state.opened_at = self.monotonic()
```

After a failed probe the cooldown never restarted, so every subsequent request
became a probe — the breaker was open in name and fully closed in behaviour,
which is the exact failure it exists to prevent. The stamp is now unconditional
at the threshold, so a failed probe restarts the cooldown.
