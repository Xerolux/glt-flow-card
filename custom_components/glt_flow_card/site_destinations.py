"""Where the Companion is allowed to connect, and what it checks before it does.

D9: `configure_remote_sites` accepted any ``url`` — no scheme check, no host
validation, no allowlist. The Companion then made an **authenticated** request to
it and returned the body to the browser. That is a server-side request forgery
primitive with a credential attached, reachable from a configuration field.

The check has two halves, and both are necessary because neither holds alone.

**A server-owned allowlist**, so the set of destinations is a decision rather
than a consequence. Site configuration, never project data — the third time this
rule appears, after Phase 6's notification targets and Phase 8's simulation gate,
which makes it the product's security model rather than a per-phase precaution.

**A check on the resolved address at connection time.** An allowlisted name may
resolve publicly when it is validated and to ``127.0.0.1`` when it is connected
to; that is DNS rebinding, and it defeats an allowlist that only ever looked at
the name. ``169.254.169.254`` is called out by name in the tests because it is
the cloud metadata address and it is the reason none of this is theoretical.
"""
from __future__ import annotations

import ipaddress
from typing import Any, Callable

#: Schemes the Companion will speak. `https` first because that is what a site
#: should use; `http` is permitted because a Home Assistant on a local network
#: commonly has no certificate, and refusing it outright would push people to
#: disable verification instead — a worse outcome.
ALLOWED_SCHEMES: tuple[str, ...] = ("https", "http")

#: Why a destination was refused. Closed, and deliberately free of detail: these
#: reasons reach the browser, and one that named the address would hand back the
#: information the check exists to protect.
DESTINATION_REFUSALS: tuple[str, ...] = (
    "scheme_not_allowed",
    "host_not_allowlisted",
    "address_not_routable",
    "destination_unresolvable",
    "verification_disabled_without_declaration",
    "site_incomplete",
)


class DestinationRefused(ValueError):
    """A destination was refused, with a reason from the closed set."""

    def __init__(self, reason: str, detail: dict[str, Any] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        #: Server-side only. `detail` is for the log; the reason is for the
        #: browser. Returning the detail would defeat the point of the check.
        self.detail = detail or {}


def _refuse(reason: str, **detail: Any) -> DestinationRefused:
    assert reason in DESTINATION_REFUSALS, f"undeclared refusal: {reason}"
    return DestinationRefused(reason, detail)


def split_url(url: Any) -> tuple[str, str, int | None]:
    """Return (scheme, host, port) without importing a URL parser's surprises.

    Deliberately strict: anything this cannot parse confidently is refused rather
    than guessed at, because a URL parser that is lenient about a malformed host
    is a URL parser that will eventually agree to connect somewhere unintended.
    """
    text = str(url or "").strip()
    if "://" not in text:
        raise _refuse("scheme_not_allowed", url=text)
    scheme, _, rest = text.partition("://")
    scheme = scheme.lower()
    authority = rest.split("/", 1)[0]
    if "@" in authority:
        # `https://evil.example@allowed.example/` reads as `allowed.example` to a
        # human and connects to whichever half the parser prefers. Refused rather
        # than resolved, because "which half wins" is not a question a security
        # check should have an opinion about.
        raise _refuse("host_not_allowlisted", url=text)
    host, _, port_text = authority.partition(":")
    port = int(port_text) if port_text.isdigit() else None
    return scheme, host.lower().rstrip("."), port


def is_routable(address: str) -> bool:
    """Return whether an address is one the Companion may connect to.

    `is_global` is the precise predicate and it is used as the answer: it is
    true only for addresses that are globally routable, which is exactly the
    question. The explicit checks below it are redundant against a correct
    standard library and are kept deliberately — they are the *statement* of what
    must be refused, so a reader does not have to know what `is_global` covers,
    and they would still hold if a future release relaxed it.

    Writing this test taught me the ranges are broader than the obvious list.
    203.0.113.0/24 is TEST-NET-3 and Python classifies it as private, which is
    correct and caught a fixture of mine that used documentation addresses as
    though they were public.

    The link-local range matters most in practice: 169.254.169.254 is the cloud
    metadata endpoint, and an SSRF that reaches it returns credentials for the
    whole account.
    """
    try:
        parsed = ipaddress.ip_address(address)
    except ValueError:
        return False
    if not parsed.is_global:
        return False
    return not (
        parsed.is_loopback
        or parsed.is_link_local
        or parsed.is_private
        or parsed.is_multicast
        or parsed.is_reserved
        or parsed.is_unspecified
    )


def validate_site(site: Any, *, allowlist: Any) -> dict[str, Any]:
    """Check one configured site before it is ever used.

    The allowlist is passed in rather than read from a module global, so a test
    cannot pass by accident and a project document has no route to it.
    """
    site = site if isinstance(site, dict) else {}
    site_id = str(site.get("id") or "")
    if not site_id or not site.get("url") or not site.get("token"):
        raise _refuse("site_incomplete", site_id=site_id)

    scheme, host, port = split_url(site.get("url"))
    if scheme not in ALLOWED_SCHEMES:
        raise _refuse("scheme_not_allowed", scheme=scheme, site_id=site_id)

    allowed = {str(entry).lower().rstrip(".") for entry in (allowlist or [])}
    if host not in allowed:
        raise _refuse("host_not_allowlisted", host=host, site_id=site_id)

    if site.get("verify_ssl") is False and not site.get("verification_disabled_deliberately"):
        # Refused unless declared. `verify_ssl: false` produced no warning, no
        # audit entry and no indication in the UI, so a site's traffic could be
        # unauthenticated with nobody aware of it. Requiring a second, explicit
        # field makes it a decision rather than a typo.
        raise _refuse("verification_disabled_without_declaration", site_id=site_id)

    return {
        "host": host,
        "id": site_id,
        "port": port,
        "scheme": scheme,
        # Carried into every answer this site produces, so an operator can see
        # which figures arrived over an unauthenticated channel.
        "verified_tls": site.get("verify_ssl") is not False,
    }


def check_before_connecting(
    descriptor: dict[str, Any], *, allowlist: Any, resolve: Callable[[str], str],
) -> dict[str, Any]:
    """Re-check a validated destination against the address it now resolves to.

    This is the half an allowlist cannot do on its own. A name allowlisted and
    validated an hour ago may resolve to 127.0.0.1 now, and the request would go
    out with a credential attached.

    Called immediately before connecting rather than at configuration time, for
    the same reason Phase 8's dispatch gate reads simulation state at the point
    of dispatch: a check performed earlier is a check about an earlier world.
    """
    host = str(descriptor.get("host") or "")
    allowed = {str(entry).lower().rstrip(".") for entry in (allowlist or [])}
    if host not in allowed:
        # Re-checked, because an allowlist can change between configuration and
        # use, and the direction that matters is removal.
        raise _refuse("host_not_allowlisted", host=host)

    try:
        address = resolve(host)
    except Exception as error:  # noqa: BLE001 - the reason is deliberately generic
        raise _refuse("destination_unresolvable", host=host, error=str(error)) from None

    if not address or not is_routable(address):
        raise _refuse("address_not_routable", address=address, host=host)

    return {**descriptor, "address": address}
