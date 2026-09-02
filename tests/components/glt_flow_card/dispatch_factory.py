"""The controlled dispatcher every Phase-8 test writes through, and its ledger.

Each phase's ledger answers the question that phase can get wrong while passing.
Phase 6's was a service call that was *intended*. Phase 7's was a *read* that
exceeded its bound. **Phase 8's is an effect that reached the plant while the
product reported a rehearsal.**

That is a safety question rather than a correctness one, so the ledger is
stricter than its predecessors in two ways.

First, a dispatch is recorded *before* the outcome is known, so a test cannot
prove a refusal by looking at a return value while something else dispatched.
The whole defect class here is a path that answers "refused" and calls anyway.

Second, an unknown dispatch kind raises rather than being recorded as "other".
The gate depends on the kind enumeration being complete, and a ledger that
quietly accepts an unlisted kind would let a new dispatch path pass through the
one test written to catch exactly that.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

#: The dispatch kinds a Phase-8 test may record. Mirrored from
#: `dispatch_vocabulary.DISPATCH_KINDS`, and compared against it by a test --
#: importing it would make a silent divergence invisible, which is the mistake
#: Phase 6 made with four severity vocabularies.
DISPATCH_KINDS: tuple[str, ...] = (
    "control",
    "remote_control",
    "schedule_service",
    "notification",
    "audit",
    "report_delivery",
)

#: Kinds that move plant. These are the ones a simulation session must refuse;
#: the rest are marked or allowed, and conflating the two groups is a safety
#: defect in one direction or the other.
PHYSICAL_KINDS: tuple[str, ...] = ("control", "remote_control", "schedule_service")

#: The fixture dispatcher's identity. It exists nowhere in Home Assistant, so an
#: effect recorded against any other target left the fixture by definition.
FAKE_DISPATCHER = "glt_fake_dispatcher"


class LiveDispatchReached(AssertionError):
    """A test dispatched to something other than the fixture dispatcher.

    Raised rather than recorded. Every other ledger violation in this codebase
    is an assertion a test makes afterwards; this one cannot wait, because by
    the time the test reads the ledger the service call has happened.
    """


class UnknownDispatchKind(AssertionError):
    """A dispatch was recorded under a kind the vocabulary does not declare."""


@dataclass
class DispatchLedger:
    """Record every effect that would leave this integration.

    `attempted` and `performed` are separate on purpose. A path that consults
    the gate, is told to refuse, and calls anyway shows up as an attempt with no
    matching performance only if both are recorded -- which is the single most
    important thing this ledger does.
    """

    attempted: list[dict[str, Any]] = field(default_factory=list)
    performed: list[dict[str, Any]] = field(default_factory=list)
    refusals: list[dict[str, Any]] = field(default_factory=list)

    def attempt(self, kind: str, **detail: Any) -> None:
        if kind not in DISPATCH_KINDS:
            raise UnknownDispatchKind(
                f"{kind!r} is not a declared dispatch kind; add it to the vocabulary "
                "so the enumeration test covers it, rather than recording it as other",
            )
        self.attempted.append({"kind": kind, **detail})

    def perform(self, kind: str, *, target: str = FAKE_DISPATCHER, **detail: Any) -> None:
        if target != FAKE_DISPATCHER:
            raise LiveDispatchReached(
                f"a {kind} dispatch reached {target!r} rather than the fixture; "
                "a Phase-8 test must never be able to move plant",
            )
        self.performed.append({"kind": kind, **detail})

    def refuse(self, kind: str, reason: str, **detail: Any) -> None:
        self.refusals.append({"kind": kind, "reason": reason, **detail})

    def counts(self) -> dict[str, int]:
        """The line every Phase-8 test emits, and what each number means.

        `service`, `remote` and `notification` are the counts that must be zero
        unless the test names them. They are computed from `performed`, never
        from `attempted`, because an attempt that was correctly refused is
        exactly what a passing simulation test looks like.
        """
        performed = [entry["kind"] for entry in self.performed]
        return {
            "network": 0,
            "notification": performed.count("notification"),
            "remote": performed.count("remote_control"),
            "service": performed.count("control") + performed.count("schedule_service"),
        }

    def performed_kinds(self) -> set[str]:
        return {entry["kind"] for entry in self.performed}

    def refusal_reasons(self) -> set[str]:
        return {entry["reason"] for entry in self.refusals}

    def assert_nothing_physical(self, why: str) -> None:
        """Assert no plant-moving effect was performed.

        Named rather than inlined, because this exact assertion appears in every
        simulation test and a subtly different inline version in one of them
        would be the gap.
        """
        reached = self.performed_kinds() & set(PHYSICAL_KINDS)
        assert not reached, f"{why}: {sorted(reached)} reached the plant"
