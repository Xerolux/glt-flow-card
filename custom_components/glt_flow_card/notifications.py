"""Notification delivery that records what happened.

Phase 6's audit found three defects in the twelve lines this module replaces:

**D6 -- the outcome was discarded twice.** `services.async_call(...,
blocking=False)` makes the result unobtainable, and a bare
`except Exception: return` makes the exception unobtainable too. A delivery
nobody received was indistinguishable from one they did. ALM-02 requires
recording every attempt and its result, so the requirement and that call are
incompatible: the call becomes blocking with an explicit timeout.

**D11 -- there was no allowlist.** Schedules check `domain not in allowed` and
controls check `SAFE_SERVICE_DOMAINS`; this path checked nothing and called
whatever domain and service the project document named. A project document is
operator input, and a service string in it is not authorization.

**T6-09 -- a delivery failure must never hide the alarm.** The obvious
implementation treats a failed notify as handled, which gets it exactly
backwards: an alarm nobody could be told about is more urgent than one they were
told about, not less.
"""
from __future__ import annotations

from . import dispatch_gate

import asyncio
from typing import Any

from .alarm_vocabulary import (
    ALARM_PRIORITIES,
    ESCALATION_STAGE_KINDS,
    NOTIFICATION_OUTCOMES,
    migrate_severity,
)

#: What a site may notify through before it configures anything.
#:
#: `persistent_notification.create` reaches nobody outside the Home Assistant
#: frontend, which is exactly what "conservative default" has to mean here: an
#: unconfigured installation is annunciated in the UI and pages no one. Decided
#: with the user on 2026-09-02 and documented as a site decision.
DEFAULT_ALLOWLIST: tuple[str, ...] = ("persistent_notification.create",)

#: How long one delivery may take before it is recorded as a timeout.
#:
#: A blocking call without a timeout is a hang, not a record -- and a hang in
#: the alarm path stops every later alarm behind it.
DEFAULT_TIMEOUT_SECONDS = 15

#: How many delivery attempts are retained per alarm.
DEFAULT_ATTEMPT_BOUND = 50


def is_allowed(domain: str, service: str, *, allowlist: Any = None) -> bool:
    """Return whether this site permits notifying through `domain.service`.

    Deny-default: an empty allowlist permits nothing. The allowlist is *site*
    configuration and never comes from the project document, because the project
    document is the thing an operator edits.
    """
    entries = tuple(DEFAULT_ALLOWLIST if allowlist is None else allowlist)
    return f"{domain}.{service}" in entries


def split_service(spec: Any) -> tuple[str, str] | None:
    """Split a `domain.service` string, or return None when it is not one."""
    text = str(spec or "")
    if "." not in text:
        return None
    domain, _, service = text.partition(".")
    domain, service = domain.strip(), service.strip()
    if not domain or not service:
        return None
    return domain, service


def describe(policy: dict[str, Any], *, allowlist: Any = None) -> str:
    """Return the outcome one policy would reach, without performing it.

    Separated from `deliver` so the decision can be asserted, previewed and
    displayed without a service call. Every value it returns is a declared
    member of `NOTIFICATION_OUTCOMES`.
    """
    parts = split_service(policy.get("service"))
    if parts is None:
        return "no_target_configured"
    domain, service = parts
    if not is_allowed(domain, service, allowlist=allowlist):
        return "service_not_allowed" if "service_not_allowed" in NOTIFICATION_OUTCOMES else "refused"
    return "failed" if policy.get("fails") else "delivered"


def alarm_survives_delivery_failure(state: dict[str, Any], *, outcome: str) -> bool:
    """Return whether the alarm stays active after this delivery outcome.

    Always true, and that is the point. This is a named function rather than an
    absent branch so a test can assert the rule directly: the obvious
    implementation treats a failed notify as "handled", and an alarm nobody
    could be told about is more urgent than one they were told about.
    """
    if outcome not in NOTIFICATION_OUTCOMES:
        raise ValueError(f"unknown notification outcome: {outcome!r}")
    return True


def stages_for(alarm: dict[str, Any], *, policy: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Return the escalation stages that apply to this alarm, in firing order.

    An unconfigured installation returns nothing: an escalation nobody asked for
    is a page at 3am nobody asked for. A stage that names priorities applies only
    to those; a stage that names none applies to all, because omitting the field
    is not the same as naming an empty set.
    """
    declared = ((policy or {}).get("escalation") or [])
    priority = migrate_severity(alarm.get("priority", alarm.get("severity")))["priority"]
    applicable: list[dict[str, Any]] = []
    for stage in declared:
        if not isinstance(stage, dict):
            continue
        kind = stage.get("kind")
        if kind not in ESCALATION_STAGE_KINDS:
            raise ValueError(f"unknown escalation stage kind: {kind!r}")
        priorities = stage.get("priorities")
        if priorities is not None:
            for member in priorities:
                if member not in ALARM_PRIORITIES:
                    raise ValueError(f"unknown alarm priority in stage: {member!r}")
            if priority not in priorities:
                continue
        applicable.append(dict(stage))
    return sorted(applicable, key=lambda stage: int(stage.get("after_seconds", 0) or 0))


def escalation_key(*, project_id: str, alarm_id: str, anchor: str, stage: int) -> str:
    """Return a key that identifies one stage of one activation.

    Stable across a restart -- it is built from persisted values only -- and
    different for a new activation, because the anchor changes. Without the
    anchor a restart would re-fire every stage; without stability it would
    re-fire them on every reload.
    """
    return f"{project_id}:{alarm_id}:{anchor}:{stage}"


async def deliver(
    hass: Any,
    policy: dict[str, Any],
    *,
    allowlist: Any = None,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    context: Any = None,
    is_simulating: Any = None,
) -> dict[str, Any]:
    """Attempt one delivery and return what happened.

    Blocking, with an explicit timeout, and every exception recorded rather than
    swallowed. The returned record is the whole point: service, target, outcome
    and error, so an alarm can say why nobody was told.
    """
    from datetime import datetime, timezone

    def record(
        outcome: str, *, error: str | None = None, target: Any = None, simulated: bool = False,
    ) -> dict[str, Any]:
        if outcome not in NOTIFICATION_OUTCOMES:
            raise ValueError(f"unknown notification outcome: {outcome!r}")
        return {
            "service": policy.get("service"),
            "target": list(target or []),
            "outcome": outcome,
            "error": error,
            # A field as well as a sentence in the message, so the audit can
            # separate rehearsal traffic afterwards without parsing prose.
            "simulated": simulated,
            "at": datetime.now(timezone.utc).isoformat(),
        }

    parts = split_service(policy.get("service"))
    if parts is None:
        return record("no_target_configured")
    domain, service = parts
    target = policy.get("target") or []
    if not is_allowed(domain, service, allowlist=allowlist):
        # Recorded, not silently skipped. An operator who configured a target
        # the site does not permit must be able to see that, or they will
        # believe the page went out.
        return record("refused", error=f"{domain}.{service} is not in the site allowlist",
                      target=target)

    data = dict(policy.get("data") or {})
    data.setdefault("message", policy.get("message") or "GLT Alarm")

    # T8-05. A notification during a rehearsal is **marked, not silenced**.
    #
    # The obvious reading of "block everything during simulation" would suppress
    # alarms, turning a commissioning test into a window in which nobody is told
    # about a real fault. That is a safety defect in the other direction, and a
    # worse one than the defect Phase 8 is closing: an operator who was told
    # nothing assumes nothing happened.
    #
    # So the message goes out and says on its face that the plant was simulated.
    gate = dispatch_gate.decide_dispatch("notification", is_simulating=is_simulating)
    simulated = gate.is_marked
    if simulated:
        data["message"] = f"{dispatch_gate.simulation_notice(gate)} {data['message']}"
    if target:
        data.setdefault("target", list(target))

    try:
        await asyncio.wait_for(
            hass.services.async_call(domain, service, data, blocking=True, context=context),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError:
        return record("timeout", error=f"no result within {timeout_seconds}s", target=target)
    except Exception as error:  # noqa: BLE001 - the outcome is the subject
        return record("failed", error=str(error), target=target, simulated=simulated)
    # `simulated` travels on the record as well as in the message, so the audit
    # can separate rehearsal traffic afterwards without parsing German prose.
    return record("delivered", target=target, simulated=simulated)
