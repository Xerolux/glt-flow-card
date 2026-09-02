"""A site's health, and the breaker that stops a dead one costing forever.

Two defects live here.

**D6: a failed read wrote a real state.**

```python
result[entity_id] = {"state": "unavailable", "error": resp.status}
```

``unavailable`` is a genuine Home Assistant state. An entity that *is*
unavailable at the remote site and an entity we could not ask about produced the
same word, with an ``error`` key nothing downstream read as the only difference.
That is Phase 7's whole subject arriving one network hop out: **absent presented
as measured.**

Unreachability belongs to the **site**. An entity we could not ask about has no
reading at all, and inventing one for it is the defect.

**D3: no circuit breaker.** A site that is down is retried by every client on
every request, forever, so the cost of a dead site grows with the number of
people looking at it.

The breaker states which state it is in, and that matters: a site skipped because
its breaker is open has been failing for a while, while a site asked and silent
just failed now. A view showing them identically hides how long the problem has
existed — which is the difference between "check the network" and "that plant has
been off since Tuesday".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .site_vocabulary import ANSWERING_STATES, REMOTE_FAILURES

#: Consecutive failures before a breaker opens.
#:
#: Three rather than one: a single failure is ordinary on a network, and opening
#: on it would make a brief blip look like an outage for the whole cooldown.
FAILURE_THRESHOLD = 3

#: How long a breaker stays open before a probe is allowed.
COOLDOWN_SECONDS = 60.0

#: How many probes may be in flight while half-open.
#:
#: One. The point of a probe is to find out cheaply whether the site is back; a
#: burst of them is the load the breaker exists to prevent, arriving in a
#: different shape.
MAX_PROBES = 1


@dataclass
class BreakerState:
    """One site's breaker."""

    failures: int = 0
    opened_at: float | None = None
    probing: int = 0

    @property
    def is_open(self) -> bool:
        return self.opened_at is not None


@dataclass
class SiteBreakers:
    """Breakers for every site, and the clock they are measured against."""

    monotonic: Callable[[], float]
    threshold: int = FAILURE_THRESHOLD
    cooldown: float = COOLDOWN_SECONDS
    states: dict[str, BreakerState] = field(default_factory=dict)

    def _state(self, site_id: str) -> BreakerState:
        return self.states.setdefault(site_id, BreakerState())

    def record_success(self, site_id: str) -> None:
        """A success closes the breaker completely.

        Not a decrement: a site that answers is working, and carrying old
        failures forward would keep it one blip away from opening for no reason
        anybody could see.
        """
        state = self._state(site_id)
        state.failures = 0
        state.opened_at = None
        state.probing = 0

    def record_failure(self, site_id: str) -> None:
        """Count a failure, and restart the cooldown if the breaker is open.

        Restarting matters and I got it wrong first: without it, a *failed probe*
        left `opened_at` at its original value with the cooldown already elapsed,
        so the next request became another probe, and the one after that. For a
        permanently dead site the breaker would then limit nothing at all while
        continuing to report itself open — the worst of both, since the load
        returns and the indicator says it has not.
        """
        state = self._state(site_id)
        state.failures += 1
        state.probing = 0
        if state.failures >= self.threshold:
            state.opened_at = self.monotonic()

    def should_skip(self, site_id: str) -> bool:
        """Return whether this site should not be asked at all right now.

        The half-open transition happens here rather than on a timer, for the
        same reason the simulation session expires on read: a timer that failed
        to fire would leave a site skipped forever, and nobody watches a timer.
        """
        state = self._state(site_id)
        if not state.is_open:
            return False
        if self.monotonic() - float(state.opened_at) < self.cooldown:
            return True
        # Half-open: let exactly one probe through.
        if state.probing >= MAX_PROBES:
            return True
        state.probing += 1
        return False

    def describe(self, site_id: str) -> dict[str, Any]:
        state = self._state(site_id)
        return {
            "consecutive_failures": state.failures,
            "open": state.is_open,
            "opened_at": state.opened_at,
            "probing": state.probing > 0,
        }


def site_answer_states(answer: Any) -> dict[str, Any]:
    """Return the entity states one site answer contributes, and nothing else.

    The guard this function exists for: a site that did not answer contributes
    **no entity states at all**, rather than a dictionary of invented
    `unavailable` ones.
    """
    if getattr(answer, "state", None) not in ANSWERING_STATES:
        return {}
    return dict(getattr(answer, "states", {}) or {})


def merge_states(answers: list[Any]) -> dict[str, Any]:
    """Merge many sites' states, keeping absence absent.

    An entity missing from the result is missing. It is not `unavailable`, and
    the caller is expected to consult the answers list to find out which sites
    were silent — which is why `FanoutResult.absent` exists rather than a flag.
    """
    merged: dict[str, Any] = {}
    for answer in answers:
        merged.update(site_answer_states(answer))
    return merged


def is_unreachable_reason(reason: Any) -> bool:
    return isinstance(reason, str) and reason in REMOTE_FAILURES
