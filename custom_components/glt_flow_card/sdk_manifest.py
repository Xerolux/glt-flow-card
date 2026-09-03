"""A contribution is data, and cannot become code (SDK-01, T5-12).

The Companion mirror of ``src/v100/sdk-manifest.mjs``. A rule that exists only
in JavaScript is a rule the server does not enforce, and an installation that
accepts a pack the browser would have refused has learned nothing from the
browser refusing it. The parity corpus proves the two runtimes agree.

The design decision this file inherits, settled with the user and recorded as
F-01 in ``.planning/FUTURE-ROADMAP.md``: a contribution is pure data,
interpreted by first-party code. Nothing contributed is loaded, evaluated or
executed. Not executing is necessary and not sufficient, so contributed markup
is checked against an allowlist of elements and attributes -- a denylist is a
promise to have thought of everything.
"""
from __future__ import annotations

import json
import re
from typing import Any

#: What a contribution may be. Closed.
CONTRIBUTION_KINDS: tuple[str, ...] = (
    "symbol", "profile", "template", "descriptor", "translation",
)

#: Project schema versions a manifest may declare support for.
SUPPORTED_SCHEMA_VERSIONS: tuple[int, ...] = (0, 1, 2, 3, 4)

#: Everything checked before the manifest is interpreted. Refusals, not
#: capacity claims: they bound what an installation can be made to do by a file
#: it was handed.
MANIFEST_LIMITS: dict[str, int] = {
    "max_bytes": 262144,
    "max_contributions": 256,
    "max_markup_bytes": 32768,
    "max_markup_elements": 512,
    "max_markup_depth": 16,
    "max_attributes_per_element": 32,
    "max_namespace_length": 64,
}

#: The elements deliberately kept out of the allowlist, and why. The mirror of
#: ``ELEMENTS_DELIBERATELY_ABSENT`` in ``sdk-manifest.mjs``; the parity corpus
#: derives one case per entry, so each is proven refused by both runtimes rather
#: than only by the allowlist being an allowlist.
ELEMENTS_DELIBERATELY_ABSENT: dict[str, str] = {
    "use": "references another node",
    "image": "references an external resource",
    "script": "executes",
    "style": "restyles the host document",
    "foreignObject": "embeds a different document",
    "iframe": "embeds a different document",
    "animate": "mutates the drawing after it is checked",
    "set": "mutates the drawing after it is checked",
    "a": "navigates",
    "filter": "references by url",
    "marker": "references by url",
    "pattern": "references by url",
}

#: The elements a contribution may draw with. What is deliberately absent, and
#: why, is :data:`ELEMENTS_DELIBERATELY_ABSENT`.
ALLOWED_ELEMENTS: tuple[str, ...] = (
    "svg", "g", "title", "desc", "defs",
    "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "text", "tspan",
    "linearGradient", "radialGradient", "stop",
)

#: The attributes those elements may carry. ``data-`` is allowed by prefix.
ALLOWED_ATTRIBUTES: tuple[str, ...] = (
    "id", "class", "viewBox", "xmlns", "preserveAspectRatio", "transform",
    "d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
    "width", "height", "dx", "dy", "offset",
    "fill", "fill-opacity", "fill-rule", "opacity",
    "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
    "stroke-dasharray", "stroke-dashoffset", "stroke-opacity",
    "text-anchor", "dominant-baseline", "font-size", "font-weight", "font-family",
    "stop-color", "stop-opacity", "gradientUnits", "gradientTransform",
    "role", "aria-label", "aria-hidden",
)

#: Every way a manifest can be refused. Closed.
MANIFEST_REFUSALS: tuple[str, ...] = (
    "manifest_too_large", "manifest_not_json", "manifest_not_an_object",
    "namespace_missing", "namespace_malformed", "version_missing",
    "schema_versions_missing", "schema_versions_unsupported",
    "contributions_missing", "too_many_contributions",
    "contribution_id_missing", "contribution_outside_namespace",
    "contribution_kind_unknown", "contribution_payload_missing",
    "markup_too_large", "markup_too_deep", "markup_too_many_elements",
    "too_many_attributes", "malformed_markup",
    "script_element", "event_handler_attribute", "external_reference",
    "foreign_object", "unknown_element", "unknown_attribute", "javascript_url",
    "data_url", "doctype_declaration",
)

_ELEMENTS = frozenset(ALLOWED_ELEMENTS)
_ATTRIBUTES = frozenset(ALLOWED_ATTRIBUTES)
_KINDS = frozenset(CONTRIBUTION_KINDS)
_VERSIONS = frozenset(SUPPORTED_SCHEMA_VERSIONS)

#: Elements refused by name rather than by absence, so the reason is specific.
_NAMED_REFUSALS = {"script": "script_element", "foreignobject": "foreign_object"}

_NAMESPACE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,62}[a-z0-9]$")
_REFERENCE_ATTRIBUTES = frozenset({"href", "xlink:href", "src", "xlink:src"})

_TAG = re.compile(r"""</?([A-Za-z_][A-Za-z0-9_.:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)/?>""")
_ATTRIBUTE = re.compile(
    r"""([A-Za-z_:][A-Za-z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?"""
)
_FRAGMENT = re.compile(r"^#[A-Za-z0-9_.:-]+$")
_SCRIPT_SCHEME = re.compile(r"^(?:javascript|vbscript):", re.IGNORECASE)
_DATA_SCHEME = re.compile(r"^data:", re.IGNORECASE)
_URL_REFERENCE = re.compile(r"""\burl\(\s*['"]?(?!#)""", re.IGNORECASE)
_DOCTYPE = re.compile(r"<!\s*(doctype|entity)", re.IGNORECASE)
_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
_CDATA = re.compile(r"<!\[CDATA\[.*?\]\]>", re.DOTALL)
_NAMED_ENTITIES = {
    "amp": "&", "lt": "<", "gt": ">", "quot": '"', "apos": "'",
    "tab": "\t", "newline": "\n",
}


def _issue(code: str, path: str, detail: Any = None) -> dict[str, Any]:
    return {"code": code, "path": path, "detail": detail}


def _byte_length(value: str) -> int:
    return len(value.encode("utf-8"))


def _decode_entities(value: str) -> str:
    """Resolve the character entities a scheme can be hidden behind.

    ``java&#115;cript:`` is the same URL as ``javascript:`` by the time a
    browser reads it, so a check that runs before this one is checking a string
    nobody will ever use.
    """
    text = re.sub(
        r"&#x([0-9a-fA-F]+);?",
        lambda match: chr(int(match.group(1), 16)),
        str(value),
    )
    text = re.sub(r"&#(\d+);?", lambda match: chr(int(match.group(1))), text)
    return re.sub(
        r"&(amp|lt|gt|quot|apos|tab|newline);?",
        lambda match: _NAMED_ENTITIES[match.group(1).lower()],
        text,
        flags=re.IGNORECASE,
    )


def _dangerous_scheme(value: str) -> str | None:
    """The scheme a URL carries, once the ways of hiding one are undone.

    ``javascript:`` and ``vbscript:`` run. ``data:`` does not reach the network
    but inlines a whole document of somebody else's choosing, which is a
    different problem and gets a different name -- a refusal calling a data URL
    a JavaScript URL sends a pack author looking for script they did not write.
    """
    collapsed = "".join(char for char in _decode_entities(value) if ord(char) > 0x20)
    if _SCRIPT_SCHEME.match(collapsed):
        return "javascript_url"
    if _DATA_SCHEME.match(collapsed):
        return "data_url"
    return None


def validate_markup(markup: Any, path: str = "/payload/markup") -> list[dict[str, Any]]:
    """Everything wrong with contributed markup, empty when acceptable.

    Attributes are checked on every element, including one whose name is
    already refused. Telling a pack author only that ``a`` is not allowed
    teaches them to reach for an element that is, with the same URL still in it.
    """
    errors: list[dict[str, Any]] = []
    if not isinstance(markup, str):
        return [_issue("malformed_markup", path, {"reason": "not a string"})]
    if _byte_length(markup) > MANIFEST_LIMITS["max_markup_bytes"]:
        return [_issue("markup_too_large", path, {"limit": MANIFEST_LIMITS["max_markup_bytes"]})]
    if _DOCTYPE.search(markup):
        # Refused outright: an internal subset is where entity expansion lives,
        # and no contribution has ever needed one.
        return [_issue("doctype_declaration", path)]

    stripped = _CDATA.sub("", _COMMENT.sub("", markup))

    depth = 0
    elements = 0
    max_depth = 0
    seen: set[str] = set()

    for match in _TAG.finditer(stripped):
        tag = match.group(0)
        name = match.group(1)
        raw_attributes = match.group(2) or ""
        lowered = name.lower()

        if tag.startswith("</"):
            depth -= 1
            if depth < 0:
                errors.append(_issue("malformed_markup", path,
                                     {"reason": f"unbalanced </{name}>"}))
                break
            continue

        elements += 1
        if elements > MANIFEST_LIMITS["max_markup_elements"]:
            errors.append(_issue("markup_too_many_elements", path,
                                 {"limit": MANIFEST_LIMITS["max_markup_elements"]}))
            break

        named = _NAMED_REFUSALS.get(lowered)
        if named:
            if named not in seen:
                errors.append(_issue(named, f"{path}/{name}"))
            seen.add(named)
        elif name not in _ELEMENTS:
            errors.append(_issue("unknown_element", f"{path}/{name}", {"element": name}))

        attribute_count = 0
        for attribute in _ATTRIBUTE.finditer(raw_attributes):
            attribute_name = attribute.group(1)
            value = next(
                (group for group in attribute.groups()[1:] if group is not None), ""
            )
            attribute_count += 1
            if attribute_count > MANIFEST_LIMITS["max_attributes_per_element"]:
                errors.append(_issue("too_many_attributes", f"{path}/{name}",
                                     {"limit": MANIFEST_LIMITS["max_attributes_per_element"]}))
                break
            attribute_path = f"{path}/{name}@{attribute_name}"

            if attribute_name[:2].lower() == "on":
                errors.append(_issue("event_handler_attribute", attribute_path,
                                     {"attribute": attribute_name}))
                continue
            scheme = _dangerous_scheme(value)
            if scheme:
                errors.append(_issue(scheme, attribute_path,
                                     {"attribute": attribute_name}))
                continue
            if attribute_name.lower() in _REFERENCE_ATTRIBUTES:
                # A same-document fragment is the only reference reaching nothing.
                if not _FRAGMENT.match(value):
                    errors.append(_issue("external_reference", attribute_path, {"value": value}))
                continue
            if _URL_REFERENCE.search(_decode_entities(value)):
                errors.append(_issue("external_reference", attribute_path, {"value": value}))
                continue
            if attribute_name.startswith("data-") or attribute_name == "xml:space":
                continue
            if attribute_name not in _ATTRIBUTES:
                errors.append(_issue("unknown_attribute", attribute_path,
                                     {"attribute": attribute_name}))

        if not tag.endswith("/>"):
            depth += 1
            max_depth = max(max_depth, depth)
            if max_depth > MANIFEST_LIMITS["max_markup_depth"]:
                errors.append(_issue("markup_too_deep", path,
                                     {"limit": MANIFEST_LIMITS["max_markup_depth"]}))
                break

    return errors


def _validate_contribution(contribution: Any, index: int, namespace: Any) -> list[dict[str, Any]]:
    path = f"/contributions/{index}"
    errors: list[dict[str, Any]] = []
    if not isinstance(contribution, dict):
        return [_issue("contribution_payload_missing", path, {"reason": "not an object"})]
    identifier = contribution.get("id")
    kind = contribution.get("kind")
    payload = contribution.get("payload")
    prefix = f"{namespace}/" if isinstance(namespace, str) else "/"
    if not isinstance(identifier, str) or not identifier:
        errors.append(_issue("contribution_id_missing", f"{path}/id"))
    elif not identifier.startswith(prefix) or len(identifier) == len(prefix):
        # A pack that can name a contribution outside its namespace can shadow
        # another pack's, and installation order decides which one wins.
        errors.append(_issue("contribution_outside_namespace", f"{path}/id",
                             {"id": identifier, "namespace": namespace}))
    if kind not in _KINDS:
        errors.append(_issue("contribution_kind_unknown", f"{path}/kind",
                             {"kind": kind if isinstance(kind, str) else None}))
    if not isinstance(payload, dict):
        errors.append(_issue("contribution_payload_missing", f"{path}/payload"))
        return errors
    if "markup" in payload:
        errors.extend(validate_markup(payload["markup"], f"{path}/payload/markup"))
    return errors


def _result(errors: list[dict[str, Any]]) -> dict[str, Any]:
    return {"valid": len(errors) == 0, "errors": errors}


def validate_manifest(raw_input: Any) -> dict[str, Any]:
    """Validate an extension manifest, from bytes as received or a parsed object.

    Bytes are the real boundary: an installation is handed a file, and the size
    check has to happen before the parser sees it.
    """
    document = raw_input
    if isinstance(raw_input, str):
        if _byte_length(raw_input) > MANIFEST_LIMITS["max_bytes"]:
            return _result([_issue("manifest_too_large", "/",
                                   {"limit": MANIFEST_LIMITS["max_bytes"]})])
        try:
            document = json.loads(raw_input)
        except ValueError as error:
            return _result([_issue("manifest_not_json", "/", {"reason": str(error)})])
    elif isinstance(raw_input, (dict, list)):
        try:
            serialized = json.dumps(raw_input, separators=(",", ":"), ensure_ascii=False)
        except (TypeError, ValueError) as error:
            return _result([_issue("manifest_not_json", "/", {"reason": str(error)})])
        if _byte_length(serialized) > MANIFEST_LIMITS["max_bytes"]:
            return _result([_issue("manifest_too_large", "/",
                                   {"limit": MANIFEST_LIMITS["max_bytes"]})])

    if not isinstance(document, dict):
        return _result([_issue("manifest_not_an_object", "/")])

    errors: list[dict[str, Any]] = []
    namespace = document.get("namespace")
    if not isinstance(namespace, str) or not namespace:
        errors.append(_issue("namespace_missing", "/namespace"))
    elif (len(namespace) > MANIFEST_LIMITS["max_namespace_length"]
            or not _NAMESPACE.match(namespace)):
        errors.append(_issue("namespace_malformed", "/namespace", {"namespace": namespace}))

    version = document.get("version")
    if not isinstance(version, str) or not version:
        errors.append(_issue("version_missing", "/version"))

    versions = document.get("supports_schema_versions")
    if not isinstance(versions, list) or len(versions) == 0:
        errors.append(_issue("schema_versions_missing", "/supports_schema_versions"))
    else:
        unsupported = [version for version in versions if _unsupported(version)]
        if unsupported:
            # Refusing beats degrading: a pack declaring a version this card
            # does not have cannot be read safely by guessing what still applies.
            errors.append(_issue("schema_versions_unsupported", "/supports_schema_versions",
                                 {"unsupported": unsupported,
                                  "supported": list(SUPPORTED_SCHEMA_VERSIONS)}))

    contributions = document.get("contributions")
    if not isinstance(contributions, list):
        errors.append(_issue("contributions_missing", "/contributions"))
        return _result(errors)
    if len(contributions) > MANIFEST_LIMITS["max_contributions"]:
        errors.append(_issue("too_many_contributions", "/contributions",
                             {"limit": MANIFEST_LIMITS["max_contributions"]}))
        return _result(errors)
    for index, contribution in enumerate(contributions):
        errors.extend(_validate_contribution(contribution, index, namespace))
    return _result(errors)


def _unsupported(version: Any) -> bool:
    """Whether one declared schema version is outside what this card knows.

    ``True`` is an ``int`` in Python and is not in JavaScript, so it is excluded
    explicitly rather than left to ``in``: a manifest declaring ``[true]`` must
    be refused by both runtimes, and only one of them would have done it by
    accident.
    """
    if isinstance(version, bool):
        return True
    return version not in _VERSIONS
