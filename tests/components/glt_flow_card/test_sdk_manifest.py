"""The Companion refuses exactly what the browser refuses (SDK-01, T5-12).

A rule that exists only in JavaScript is a rule the server does not enforce,
and an installation that accepts a pack the browser would have refused has
learned nothing from the browser refusing it.

The Home Assistant lanes have no ``node`` binary, so the two validators cannot
be compared by running both. They are compared to a recording instead:
``sdk-parity-corpus.json`` carries the manifests *and* the verdicts JavaScript
reached, ``test/sdk-parity-corpus.test.mjs`` keeps the recording current in the
Node suite, and this reads the same inputs and requires the same verdicts.

Carrying the inputs rather than only the verdicts is deliberate. A corpus of
verdicts alone would need the cases written out in both languages, and two
mirrored lists are two lists that drift.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from custom_components.glt_flow_card.sdk_manifest import (
    ALLOWED_ELEMENTS,
    MANIFEST_LIMITS,
    MANIFEST_REFUSALS,
    validate_manifest,
)

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]

_CORPUS = json.loads(
    (Path(__file__).resolve().parent / "fixtures" / "sdk-parity-corpus.json")
    .read_text(encoding="utf-8")
)


def _codes(verdict: dict) -> list[str]:
    return sorted({error["code"] for error in verdict["errors"]})


@pytest.mark.parametrize("case", _CORPUS["cases"], ids=lambda case: case["case"])
def test_the_two_runtimes_reach_the_same_verdict(case: dict) -> None:
    verdict = validate_manifest(case["manifest"])
    assert verdict["valid"] is case["valid"], case["case"]
    assert _codes(verdict) == case["codes"], case["case"]


def test_the_corpus_proves_both_directions() -> None:
    """A corpus of only refusals proves a validator that refuses everything."""
    accepted = [case for case in _CORPUS["cases"] if case["valid"]]
    refused = [case for case in _CORPUS["cases"] if not case["valid"]]
    assert len(accepted) >= 4, "nothing in the corpus is accepted"
    assert len(refused) >= 20
    for case in accepted:
        assert case["codes"] == [], case["case"]


def test_every_reason_the_corpus_reaches_is_a_declared_one() -> None:
    declared = set(MANIFEST_REFUSALS)
    for case in _CORPUS["cases"]:
        for code in case["codes"]:
            assert code in declared, f"{case['case']} produced an undeclared code: {code}"


def test_the_bounds_match_the_ones_the_browser_declares() -> None:
    """A bound enforced at one end only is a bound an installer routes around."""
    assert MANIFEST_LIMITS == _CORPUS["limits"]


def test_the_allowlist_excludes_what_embeds_or_executes() -> None:
    for element in ("script", "foreignObject", "iframe", "use", "image", "style", "a"):
        assert element not in ALLOWED_ELEMENTS


def test_an_oversized_manifest_is_refused_by_its_length_not_by_the_parser() -> None:
    """The refusal must not depend on the payload being parseable."""
    oversized = "x" * (MANIFEST_LIMITS["max_bytes"] + 1)
    verdict = validate_manifest(oversized)
    assert verdict["valid"] is False
    assert _codes(verdict) == ["manifest_too_large"], (
        "an oversized manifest reached the parser"
    )
