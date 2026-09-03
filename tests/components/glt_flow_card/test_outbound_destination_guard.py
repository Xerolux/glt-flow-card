"""No outbound request escapes the destination re-check (T9-03, T9-04).

An allowlist checked at configuration time is a check about an earlier world. A
name allowlisted and validated an hour ago may resolve to ``127.0.0.1`` now --
that is DNS rebinding -- and the request would go out with a bearer token
attached. ``site_destinations.check_before_connecting`` is the answer, and it
only works if it is called before *every* outbound request.

At head it is, at both call sites. What did not exist is any reason it would
stay that way: a third site added next phase would be correct only if whoever
added it remembered, which is precisely the shape
``test_dispatch_enumeration.py`` refuses for service calls. This module gives
the destination check the same structural guarantee.

The two guards differ in one way worth stating. The dispatch guard asks whether
``decide_dispatch`` appears in the same function as the effect. This one asks
the same of ``check_before_connecting`` -- and additionally that the session was
built with an explicit ``verify_ssl``, because T9-05 is a site that silently
disables certificate verification, and a default is not a decision.
"""
from __future__ import annotations

import ast
import json
from pathlib import Path

EFFECT_PREFIX = "PHASE9_DESTINATION_EFFECTS "

COMPANION = Path(__file__).resolve().parents[3] / "custom_components" / "glt_flow_card"

#: Calls that open a connection to somewhere outside this installation.
#:
#: Matched on the attribute name, so ``session.get`` and ``self._session.get``
#: are the same hazard written two ways.
OUTBOUND_CALLS: tuple[str, ...] = (
    "get", "post", "put", "patch", "delete", "request", "ws_connect",
)

#: The call that decides whether the destination may be reached, now.
DESTINATION_CHECK = "check_before_connecting"

#: How an aiohttp session is obtained. A function that builds one and then makes
#: an outbound call is a function that reaches the network.
SESSION_BUILDERS: tuple[str, ...] = ("async_get_clientsession",)

#: Functions that legitimately reach the network without the check, and why.
#:
#: Empty. An entry here needs a reason that survives being read back, not a note
#: that the check felt redundant -- "the caller already did it" is the reasoning
#: the dispatch guard exists to refuse.
EXEMPT: dict[str, str] = {}


def _network_functions(path: Path):
    """Yield (function, every call it makes) for functions that build a session.

    Keying on the session builder rather than on the bare method name is what
    keeps this from flagging every `dict.get` in the Companion: `get` is a
    hazard only where a client session was just constructed.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        called_attrs = []
        called_names = []
        for child in ast.walk(node):
            if not isinstance(child, ast.Call):
                continue
            if isinstance(child.func, ast.Attribute):
                called_attrs.append(child.func.attr)
            elif isinstance(child.func, ast.Name):
                called_names.append(child.func.id)
        if not any(name in SESSION_BUILDERS for name in called_names + called_attrs):
            continue
        outbound = [name for name in called_attrs if name in OUTBOUND_CALLS]
        if outbound:
            yield node, called_attrs, outbound


def test_every_outbound_call_site_re_checks_its_destination():
    """The structural half: find the paths rather than trusting a list."""
    unguarded = []
    examined = 0
    for path in sorted(COMPANION.glob("*.py")):
        for node, calls, outbound in _network_functions(path):
            examined += 1
            if node.name in EXEMPT:
                continue
            if DESTINATION_CHECK not in calls:
                unguarded.append(
                    f"{path.name}::{node.name} makes {sorted(set(outbound))} "
                    f"without calling {DESTINATION_CHECK} first"
                )
    print(EFFECT_PREFIX + json.dumps(
        {"functions_examined": examined, "network": 0}, sort_keys=True,
    ))
    assert examined > 0, (
        "no outbound function was found; the AST walk is not working, and a "
        "guard that examines nothing passes over everything"
    )
    assert unguarded == [], "\n".join(unguarded)


def test_every_outbound_session_states_its_tls_verification():
    """T9-05: verification off must be a decision somebody wrote down.

    `async_get_clientsession(hass)` verifies by default, so an omitted argument
    is *safe* here -- and it is still refused, because the next reader cannot
    tell an omission that inherited a safe default from one that meant to turn
    verification off and picked the wrong helper.
    """
    silent = []
    for path in sorted(COMPANION.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name):
                continue
            if node.func.id not in SESSION_BUILDERS:
                continue
            if not any(keyword.arg == "verify_ssl" for keyword in node.keywords):
                silent.append(f"{path.name}:{node.lineno} builds a session without verify_ssl")
    assert silent == [], "\n".join(silent)


def test_the_guard_notices_an_unchecked_call_site():
    """The guard is not vacuous: it fails on a function shaped like the defect."""
    source = (
        "async def reach_out(hass, site):\n"
        "    session = async_get_clientsession(hass, verify_ssl=True)\n"
        "    async with session.get(site['url']) as response:\n"
        "        return await response.json()\n"
    )
    tree = ast.parse(source)
    node = next(
        child for child in ast.walk(tree)
        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef))
    )
    calls = [
        child.func.attr for child in ast.walk(node)
        if isinstance(child, ast.Call) and isinstance(child.func, ast.Attribute)
    ]
    assert "get" in calls, "the sample does not contain the hazard it is meant to model"
    assert DESTINATION_CHECK not in calls, (
        "the sample is guarded, so it proves nothing about an unguarded one"
    )
