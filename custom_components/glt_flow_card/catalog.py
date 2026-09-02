"""The Companion's half of the wording catalog, and its canonical bytes.

The existing parity gates compare **codes** — the site, dispatch and period
vocabulary fingerprints. They are the right checks and they do not cover
wording, so the Companion and the browser could drift in what they *say* while
agreeing on what they *mean*. A German operator reading a Companion refusal and
the browser's rendering of the same condition would see two different sentences
and reasonably conclude they were two different conditions.

This module exposes the wording the Companion owns in the shape the browser's
catalog uses — flat ``namespace.name`` keys per language — so the two can be
compared as **canonical bytes**. Bytes rather than values, for the reason this
codebase has recorded four times: two earlier parity efforts agreed on every
value and disagreed on every byte.
"""

from __future__ import annotations

import json

from .period_vocabulary import LABELS as PERIOD_LABELS

#: The languages both runtimes must carry. A third is added by supplying a
#: catalog, never by editing a module — which is the whole point of I18N-01.
LANGUAGES: tuple[str, ...] = ("de", "en")

#: Which Companion wording group maps to which browser namespace.
#:
#: One namespace, because every group here is period vocabulary; the mapping is
#: written out anyway so a second group cannot be added without deciding where
#: it belongs on the other side.
_NAMESPACES = {
    "aggregate": "period",
    "period": "period",
    "refusal": "period",
    "source": "period",
}


def catalog(language: str) -> dict[str, str]:
    """Return every Companion string for one language, keyed as the browser keys it."""
    if language not in LANGUAGES:
        raise ValueError(f"catalog: {language!r} is not one of {LANGUAGES}")
    entries: dict[str, str] = {}
    for group, members in PERIOD_LABELS.items():
        namespace = _NAMESPACES.get(group)
        if namespace is None:
            raise ValueError(f"catalog: wording group {group!r} has no browser namespace")
        for member, wording in members.items():
            text = (wording or {}).get(language)
            if not text:
                raise ValueError(f"catalog: {group}.{member} has no {language} wording")
            key = f"{namespace}.{member}"
            existing = entries.get(key)
            if existing is not None and existing != text:
                # Two groups claiming one key with different words is a silent
                # overwrite: one of the two sentences would never be seen.
                raise ValueError(f"catalog: {key} is claimed twice with different wording")
            entries[key] = text
    return entries


def canonical_catalog() -> str:
    """The canonical bytes the browser must agree with, sorted and separator-stable."""
    return json.dumps(
        {language: dict(sorted(catalog(language).items())) for language in LANGUAGES},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
