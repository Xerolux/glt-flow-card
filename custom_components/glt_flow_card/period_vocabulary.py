"""The closed Phase-7 vocabularies: periods, aggregates, sources and refusals.

Mirrored from ``src/v100/period-vocabulary.mjs`` rather than imported, and a test
proves the two agree by comparing canonical bytes. Mirroring is deliberate: an
import would make a silent divergence invisible, and the fingerprint comparison
is what turns "we believe these match" into evidence.

Phase 6 closed the alarm vocabulary because four undeclared sets disagreed and an
alarm authored as ``critical`` was counted in no roll-up. Phase 7 closes these
before the same thing can happen to a number, and one of the audit's defects is
already that shape: ``aggregateSeries`` ends its ternary chain in an unguarded
else, so ``aggregate: "p95"`` silently computes a mean and reports no error
(D12). A vocabulary that accepts anything is not a vocabulary.

Which contract answers which period was measured against the vendored Home
Assistant and recorded in ``07-RESEARCH.md``: ``day``, ``week`` and ``month`` by
``recorder/statistics_during_period``, and ``year`` only by
``recorder/statistic_during_period``'s calendar spec, whose enum is the one that
reaches a year at all.
"""
from __future__ import annotations

import json
from typing import Any

#: The period names a caller may ask for. Closed.
PERIOD_NAMES: tuple[str, ...] = ("day", "week", "month", "year", "custom")

#: Which Recorder contract answers each period name. Load-bearing.
PERIOD_CONTRACTS: dict[str, str] = {
    "custom": "either",
    "day": "statistics",
    "month": "statistics",
    "week": "statistics",
    "year": "statistic",
}

#: The aggregates a series or a total may be computed with. Closed.
#:
#: ``change`` is the Recorder's own reset-aware difference over its
#: reset-corrected running sum, and it is how a counter's consumption for a
#: period is obtained. Including it here keeps a caller from reaching for
#: ``sum``, which over instantaneous samples is dimensionally meaningless (D11).
#:
#: ``none`` is the identity: every sample, no bucketing. The shipped default is
#: spelled ``raw`` and the 5->6 migration renames it, because ``raw`` already
#: means something else here -- ``source: "raw"`` says the answer came from raw
#: states rather than long-term statistics.
AGGREGATES: tuple[str, ...] = ("none", "min", "max", "mean", "change", "state")

#: Where an answer came from. Three members rather than two on purpose: "we have
#: no data" and "we did not ask" are different answers.
VALUE_SOURCES: tuple[str, ...] = ("statistics", "raw", "unavailable")

#: The first day of a week, as Home Assistant's calendar spec spells it.
FIRST_WEEKDAYS: tuple[str, ...] = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

#: Why a request or a computation was refused. Closed, each distinct.
REFUSAL_REASONS: tuple[str, ...] = (
    "unknown_period",
    "unknown_aggregate",
    "unknown_source",
    "incompatible_unit",
    "undeclared_meter_model",
    "window_exceeds_limit",
    "entities_exceed_limit",
    "circular_mean_required",
    "outside_statistic_coverage",
)

#: German and English wording for every member, written out rather than
#: assembled. A sentence built from fragments reads like a machine wrote it in
#: whichever language it was not designed in.
LABELS: dict[str, dict[str, dict[str, str]]] = {
    "aggregate": {
        "change": {"de": "Verbrauch", "en": "Consumption"},
        "max": {"de": "Maximum", "en": "Maximum"},
        "mean": {"de": "Mittelwert", "en": "Mean"},
        "none": {"de": "Alle Messwerte", "en": "Every sample"},
        "min": {"de": "Minimum", "en": "Minimum"},
        "state": {"de": "Zählerstand", "en": "Meter reading"},
    },
    "period": {
        "custom": {"de": "Freier Zeitraum", "en": "Custom range"},
        "day": {"de": "Tag", "en": "Day"},
        "month": {"de": "Monat", "en": "Month"},
        "week": {"de": "Woche", "en": "Week"},
        "year": {"de": "Jahr", "en": "Year"},
    },
    "refusal": {
        "circular_mean_required": {
            "de": "Diese Größe ist eine Richtung — ein arithmetischer Mittelwert wäre falsch.",
            "en": "This quantity is a direction — an arithmetic mean would be wrong.",
        },
        "entities_exceed_limit": {
            "de": "Die Abfrage nennt mehr Entitäten, als der Standort erlaubt.",
            "en": "The query names more entities than the site permits.",
        },
        "incompatible_unit": {
            "de": "Einheit und Preis passen nicht zusammen — nicht verrechenbar.",
            "en": "The unit and the price do not match — they cannot be combined.",
        },
        "outside_statistic_coverage": {
            "de": "Dieser Zeitraum liegt vor dem ersten aufgezeichneten Wert.",
            "en": "This period lies before the first recorded value.",
        },
        "undeclared_meter_model": {
            "de": "Für diesen Zähler ist nicht festgelegt, ob er zählt oder misst.",
            "en": "This meter does not declare whether it counts or measures.",
        },
        "unknown_aggregate": {
            "de": "Diese Auswertung ist nicht bekannt.",
            "en": "That aggregate is not known.",
        },
        "unknown_period": {
            "de": "Dieser Zeitraum ist nicht bekannt.",
            "en": "That period is not known.",
        },
        "unknown_source": {
            "de": "Diese Quelle ist nicht bekannt.",
            "en": "That source is not known.",
        },
        "window_exceeds_limit": {
            "de": "Der Zeitraum ist länger, als für Rohwerte erlaubt ist.",
            "en": "The window is longer than raw values permit.",
        },
    },
    "source": {
        "raw": {"de": "aus Rohwerten", "en": "from raw values"},
        "statistics": {"de": "aus Langzeitstatistik", "en": "from long-term statistics"},
        "unavailable": {"de": "nicht abrufbar", "en": "unavailable"},
    },
}

_LANGUAGES = ("de", "en")


def _check_labels() -> None:
    """Every member has wording in both languages, checked at import.

    At import rather than in a test, because a missing label is a defect the
    moment the module exists, and the surface that would have rendered it is the
    last place anyone wants to discover it.
    """
    for group, members in (
        ("aggregate", AGGREGATES),
        ("period", PERIOD_NAMES),
        ("refusal", REFUSAL_REASONS),
        ("source", VALUE_SOURCES),
    ):
        for member in members:
            wording = LABELS.get(group, {}).get(member)
            for language in _LANGUAGES:
                if not (wording or {}).get(language):
                    raise RuntimeError(
                        f"period vocabulary: {group} {member!r} has no {language} wording"
                    )
        for member in LABELS.get(group, {}):
            if member not in members:
                raise RuntimeError(
                    f"period vocabulary: {group} {member!r} is labelled but not a member"
                )
    for name in PERIOD_NAMES:
        if name not in PERIOD_CONTRACTS:
            raise RuntimeError(f"period vocabulary: period {name!r} names no Recorder contract")


_check_labels()


def is_period_name(value: Any) -> bool:
    """Return whether the value is a declared period name."""
    return isinstance(value, str) and value in PERIOD_NAMES


def is_aggregate(value: Any) -> bool:
    """Return whether the value is a declared aggregate."""
    return isinstance(value, str) and value in AGGREGATES


def is_value_source(value: Any) -> bool:
    """Return whether the value is a declared source."""
    return isinstance(value, str) and value in VALUE_SOURCES


def is_first_weekday(value: Any) -> bool:
    """Return whether the value is a declared first weekday."""
    return isinstance(value, str) and value in FIRST_WEEKDAYS


def is_refusal_reason(value: Any) -> bool:
    """Return whether the value is a declared refusal reason."""
    return isinstance(value, str) and value in REFUSAL_REASONS


def contract_for(period: Any) -> str:
    """Return the contract that answers a period name, or refuse.

    Refuses rather than defaulting, because the defect this replaces defaulted:
    an unrecognised aggregate silently became the mean.
    """
    if not is_period_name(period):
        raise ValueError(f"unknown_period: {period!r}")
    return PERIOD_CONTRACTS[period]


def label_for(group: str, member: str, language: str = "de") -> str:
    """Return the wording for one member in one language."""
    wording = LABELS.get(group, {}).get(member)
    if not wording:
        raise ValueError(f"no wording for {group} {member!r}")
    text = wording.get(language) or wording.get("en")
    if not text:
        raise ValueError(f"no {language} wording for {group} {member!r}")
    return text


def vocabulary_fingerprint() -> str:
    """Return the canonical bytes both runtimes must agree on.

    Separators are given explicitly so Python's default ``", "`` spacing cannot
    make two identical vocabularies disagree on bytes -- the Phase-6 parity
    lesson, in the one place it would be easiest to repeat.
    """
    return json.dumps(
        {
            "aggregates": list(AGGREGATES),
            "first_weekdays": list(FIRST_WEEKDAYS),
            "period_contracts": PERIOD_CONTRACTS,
            "periods": list(PERIOD_NAMES),
            "refusals": list(REFUSAL_REASONS),
            "sources": list(VALUE_SOURCES),
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
