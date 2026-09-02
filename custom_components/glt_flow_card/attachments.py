"""Completion evidence, bounded before it is accepted.

D24 is unusual among this phase's defects: the feature does not exist, so there
is nothing to fix. That is exactly why the bounds come first. Adding photos,
documents and parts without limits would *create* the leak rather than inherit
one, and the requirement asks for bounded attachments rather than attachments.

Two rules, both learned elsewhere in this codebase:

**Refused, not truncated.** A half-uploaded photo is worse than none: it looks
like evidence. Phase 6's silently-capped shelve is the same shape.

**The type is checked by content, not by extension.** A file named
``report.pdf`` is a claim made by whoever named it. This does not make the
product a virus scanner; it stops the obvious mislabelling that would otherwise
let a surface render arbitrary bytes as an image.
"""
from __future__ import annotations

from typing import Any

from .content_id import content_id

#: The largest one attachment may be.
#:
#: Five megabytes holds a photograph from a phone at full resolution. A site
#: decision with a stated default; the number is arguable and the *stating* is
#: not.
MAX_BYTES = 5 * 1024 * 1024

#: The most attachments one work order may carry.
MAX_ATTACHMENTS = 20

#: What may be attached, and the leading bytes that prove it.
#:
#: Content-sniffed rather than trusted from the name. The signatures are the
#: standard ones; a file whose first bytes do not match its claimed type is
#: refused rather than stored under a type it is not.
ALLOWED_TYPES: dict[str, tuple[bytes, ...]] = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
    "application/pdf": (b"%PDF-",),
    "text/plain": (),
}

#: Why an attachment was refused.
ATTACHMENT_REFUSALS: tuple[str, ...] = (
    "attachment_too_large",
    "too_many_attachments",
    "type_not_allowed",
    "content_does_not_match_type",
    "attachment_empty",
)


class AttachmentRejected(ValueError):
    """An attachment was refused, with a reason from the closed set."""

    def __init__(self, reason: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.detail = detail or {}


def limits() -> dict[str, Any]:
    """Return the limits, so a surface can state them *before* a file is chosen.

    A limit discovered by hitting it is a limit that wasted the work -- and on a
    phone, in a plant room, that work is a photograph somebody climbed a ladder
    to take.
    """
    return {
        "max_attachments": MAX_ATTACHMENTS,
        "max_bytes": MAX_BYTES,
        "types": sorted(ALLOWED_TYPES),
    }


def accept(
    *, content: bytes, declared_type: str, filename: str, existing: int = 0,
) -> dict[str, Any]:
    """Return the stored descriptor, or refuse and say which limit was hit."""
    if existing >= MAX_ATTACHMENTS:
        raise AttachmentRejected(
            "too_many_attachments", {"limit": MAX_ATTACHMENTS, "existing": existing},
        )
    if not content:
        raise AttachmentRejected("attachment_empty", {"filename": filename})
    if len(content) > MAX_BYTES:
        # Refused rather than truncated: a half-stored photograph looks like
        # evidence and is not.
        raise AttachmentRejected(
            "attachment_too_large", {"bytes": len(content), "limit": MAX_BYTES},
        )
    if declared_type not in ALLOWED_TYPES:
        raise AttachmentRejected(
            "type_not_allowed", {"declared": declared_type, "allowed": sorted(ALLOWED_TYPES)},
        )

    signatures = ALLOWED_TYPES[declared_type]
    if signatures and not any(content.startswith(signature) for signature in signatures):
        # The name is a claim by whoever typed it. This is not virus scanning;
        # it stops the obvious mislabelling that would let a surface render
        # arbitrary bytes as an image.
        raise AttachmentRejected(
            "content_does_not_match_type", {"declared": declared_type, "filename": filename},
        )

    descriptor = {
        "bytes": len(content),
        "filename": filename,
        "type": declared_type,
    }
    descriptor["id"] = content_id("attachment", descriptor)
    return descriptor
