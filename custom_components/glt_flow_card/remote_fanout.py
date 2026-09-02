"""Read many sites at once, bounded, and say what did not answer.

D1 is the phase's headline and it is an availability defect as much as a
performance one:

```python
for entity_id in entity_ids[:200]:
    async with session.get(f"{site['url']}/api/states/{entity_id}", timeout=15) as resp:
```

Two hundred entities against one unresponsive site is **fifty minutes** inside a
websocket handler. The roadmap forbids working around it, and is right to: the
obvious mitigations -- a shorter timeout, fewer entities -- make the answer *more*
incomplete rather than faster.

Three bounds, and they answer three different questions. The third is the one
that is usually missing and the one that matters, because bounded concurrency
alone still lets *n* sites times a timeout accumulate:

| Bound | Question |
|---|---|
| concurrency | how many sites are asked at once |
| per-site timeout | how long one site may take |
| **total deadline** | how long the *request* may take |

**Partial is an answer, not an error**, and in both directions. Failing the whole
roll-up because one site is down makes four healthy sites invisible, which is
worse than the missing one; returning the four and calling it the portfolio is
the defect this phase exists to close.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Callable

from .site_vocabulary import REMOTE_FAILURES, SITE_STATES

#: How many sites are asked at once.
DEFAULT_CONCURRENCY = 4

#: How long one site may take.
DEFAULT_SITE_TIMEOUT = 10.0

#: How long the whole request may take, however many sites there are.
#:
#: Not `concurrency x timeout`: that is a consequence, and a consequence changes
#: when either input does. A person waiting for a screen has a budget that does
#: not depend on how many sites their colleague configured.
DEFAULT_TOTAL_DEADLINE = 15.0

#: How long a site may take before it is reported `slow` while still answering.
DEFAULT_LATENCY_BUDGET = 2.0

#: The most entities one request may name.
MAX_ENTITIES = 500


@dataclass
class SiteAnswer:
    """What one site produced, including nothing.

    `states` is empty when the site did not answer, and `state` says why. The two
    are never merged: an empty result with no reason would be indistinguishable
    from a site that genuinely has no matching entities.
    """

    site_id: str
    state: str
    states: dict[str, Any] = field(default_factory=dict)
    latency: float | None = None
    reason: str | None = None
    verified_tls: bool = True

    def __post_init__(self) -> None:
        assert self.state in SITE_STATES, f"undeclared site state: {self.state}"
        assert self.reason is None or self.reason in REMOTE_FAILURES, (
            f"undeclared failure reason: {self.reason}"
        )

    @property
    def answered(self) -> bool:
        return self.state in ("healthy", "slow")


@dataclass
class FanoutResult:
    """Every site's answer, and what the request as a whole did.

    `truncated` and `limit` travel with the result because a silently shortened
    entity list is the same defect as a silently shortened row set (Phase 7) and
    a silently shortened suggestion list (Phase 8). Third occurrence; stated this
    time from the start.
    """

    answers: list[SiteAnswer]
    deadline_reached: bool = False
    limit: int = MAX_ENTITIES
    truncated: bool = False

    @property
    def answered(self) -> list[str]:
        return sorted(answer.site_id for answer in self.answers if answer.answered)

    @property
    def absent(self) -> list[dict[str, Any]]:
        """The sites that produced nothing, each with why.

        A list rather than a count, because "two sites are missing" and "the two
        northern plants are missing" lead to different actions.
        """
        return sorted(
            ({"reason": answer.reason, "site_id": answer.site_id, "state": answer.state}
             for answer in self.answers if not answer.answered),
            key=lambda entry: entry["site_id"],
        )

    @property
    def complete(self) -> bool:
        return not self.absent and not self.deadline_reached


def _classify(latency: float, *, budget: float) -> str:
    return "slow" if latency > budget else "healthy"


async def read_sites(
    site_ids: list[str],
    entity_ids: list[str],
    *,
    fetch: Callable[..., Any],
    is_open: Callable[[str], bool] | None = None,
    concurrency: int = DEFAULT_CONCURRENCY,
    site_timeout: float = DEFAULT_SITE_TIMEOUT,
    total_deadline: float = DEFAULT_TOTAL_DEADLINE,
    latency_budget: float = DEFAULT_LATENCY_BUDGET,
    monotonic: Callable[[], float] | None = None,
) -> FanoutResult:
    """Read state from many sites concurrently, within one deadline.

    `fetch(site_id, timeout=...)` returns **every** state from one site in one
    call, because that is what `GET /api/states` does. Asking per entity was the
    defect; a fetch that also worked per entity would hide it.
    """
    clock = monotonic or asyncio.get_event_loop().time
    wanted = list(entity_ids or [])
    truncated = len(wanted) > MAX_ENTITIES
    wanted = wanted[:MAX_ENTITIES]
    selected = set(wanted)

    started = clock()
    limiter = asyncio.Semaphore(max(1, int(concurrency)))
    answers: dict[str, SiteAnswer] = {}

    async def read_one(site_id: str) -> None:
        # A site whose breaker is open is not asked at all, and says so. That is
        # a different fact from "asked and did not answer": one has been broken
        # for a while, the other just failed, and a view that shows them
        # identically hides how long the problem has existed.
        if is_open is not None and is_open(site_id):
            answers[site_id] = SiteAnswer(site_id=site_id, state="circuit_open",
                                          reason="circuit_open")
            return
        async with limiter:
            begin = clock()
            try:
                rows = await asyncio.wait_for(
                    fetch(site_id, timeout=site_timeout), timeout=site_timeout,
                )
            except asyncio.TimeoutError:
                answers[site_id] = SiteAnswer(site_id=site_id, state="unreachable",
                                              reason="timeout", latency=clock() - begin)
                return
            except Exception as error:  # noqa: BLE001 - mapped to a closed reason below
                answers[site_id] = SiteAnswer(
                    site_id=site_id, state="unreachable",
                    reason=classify_failure(error), latency=clock() - begin,
                )
                return
            latency = clock() - begin
            states = {
                str(row.get("entity_id")): row
                for row in (rows or [])
                # Filtered here rather than at the remote end, because the remote
                # end has no filtering endpoint and the round trips are the cost.
                if not selected or str(row.get("entity_id")) in selected
            }
            answers[site_id] = SiteAnswer(
                site_id=site_id, state=_classify(latency, budget=latency_budget),
                states=states, latency=latency,
            )

    tasks = [asyncio.ensure_future(read_one(site_id)) for site_id in site_ids]
    deadline_reached = False
    try:
        await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True),
                               timeout=total_deadline)
    except asyncio.TimeoutError:
        deadline_reached = True
        for task in tasks:
            task.cancel()

    for site_id in site_ids:
        if site_id not in answers:
            # Reached the deadline before this site answered. Stated absent
            # rather than dropped: a site missing from the result entirely would
            # be a site nobody notices is missing.
            answers[site_id] = SiteAnswer(site_id=site_id, state="unreachable",
                                          reason="deadline_reached")

    return FanoutResult(
        answers=[answers[site_id] for site_id in site_ids],
        deadline_reached=deadline_reached,
        limit=MAX_ENTITIES,
        truncated=truncated,
    )


def classify_failure(error: BaseException) -> str:
    """Map an exception to one of the declared reasons.

    The exception itself never travels. `aiohttp` connection errors carry the
    host and port they failed to reach, so returning `str(err)` lets a caller
    enumerate internal topology by triggering failures — and an error string is
    an interface, one that changes with a library version.
    """
    if isinstance(error, asyncio.TimeoutError | TimeoutError):
        return "timeout"
    if isinstance(error, ConnectionRefusedError):
        return "connection_refused"
    if isinstance(error, PermissionError):
        return "unauthorized"
    if isinstance(error, ValueError):
        # `json.JSONDecodeError` is a `ValueError`.
        return "malformed_response"
    return "unreachable"
