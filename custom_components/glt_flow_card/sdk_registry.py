"""Installing an extension pack is all-or-nothing (SDK-01, T5-13, T5-14).

The requirement this serves is narrow and worth stating plainly: a failed
install must change nothing. An installation owner who is told "that did not
work" should not then have to work out which half of it applied.

So an install validates the manifest, then checks every conflict it could have
with what is already there, and only then commits. Every refusal happens before
any state changes, which makes "nothing changed" a property of the order rather
than a rollback that has to be correct.

Two things a registry can leak, and neither is allowed to:

* **Which packs exist elsewhere.** A pack installed on a project the caller
  cannot open appears in no listing, no count and no conflict message. A
  conflict that named a pack in a project the caller cannot see would be a
  read of that project by another route.
* **Which id was contested.** Within a project the caller *can* see, the
  opposite holds: a conflict names both packs and the contested id, because the
  owner has to know what to remove, and hiding it protects nothing.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from .sdk_manifest import MANIFEST_LIMITS, validate_manifest

#: How many packs one installation may hold, and how much one may contribute.
#: Refusals, not capacity claims: they bound what an installation can be made
#: to hold by files it was handed.
REGISTRY_LIMITS: dict[str, int] = {
    "max_packs": 64,
    "max_contributions_per_pack": MANIFEST_LIMITS["max_contributions"],
    "max_contributions_total": 4096,
}

#: Every way an installation can be refused. Closed, like the manifest's.
INSTALL_REFUSALS: tuple[str, ...] = (
    "manifest_invalid",
    "namespace_taken",
    "contribution_id_conflict",
    "too_many_packs",
    "too_many_contributions",
    "pack_not_installed",
)


class InstallRefused(Exception):
    """An installation was refused, and nothing changed.

    Carries the code and the detail the caller needs to act: for a conflict,
    both pack namespaces and the contested id.
    """

    def __init__(self, code: str, detail: Mapping[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.detail = dict(detail or {})


def _contribution_ids(manifest: Mapping[str, Any]) -> list[str]:
    return [
        contribution["id"]
        for contribution in manifest.get("contributions") or []
        if isinstance(contribution, Mapping) and isinstance(contribution.get("id"), str)
    ]


def _kinds(manifest: Mapping[str, Any]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for contribution in manifest.get("contributions") or []:
        if not isinstance(contribution, Mapping):
            continue
        kind = contribution.get("kind")
        if isinstance(kind, str):
            counts[kind] = counts.get(kind, 0) + 1
    return dict(sorted(counts.items()))


class SdkRegistry:
    """The packs installed against one project.

    Scoped to a project on purpose. The registry does not know about projects
    the caller cannot open, because it never holds more than one project's packs
    at a time -- which is a stronger guarantee than filtering a shared table,
    and one that cannot be forgotten at a call site.
    """

    def __init__(self, project_id: str) -> None:
        self.project_id = project_id
        self._packs: dict[str, dict[str, Any]] = {}

    # -- reads ------------------------------------------------------------

    def list_packs(self) -> list[dict[str, Any]]:
        """Every installed pack, in namespace order."""
        return [
            {
                "namespace": namespace,
                "version": pack["version"],
                "supports_schema_versions": list(pack["supports_schema_versions"]),
                "contributions": dict(pack["kinds"]),
                "contribution_count": len(pack["contribution_ids"]),
            }
            for namespace, pack in sorted(self._packs.items())
        ]

    def resolve(self, contribution_id: str) -> dict[str, Any] | None:
        """Find one contribution by its ``<namespace>/<local-id>``."""
        namespace = contribution_id.split("/", 1)[0]
        pack = self._packs.get(namespace)
        if pack is None:
            return None
        for contribution in pack["manifest"].get("contributions") or []:
            if isinstance(contribution, Mapping) and contribution.get("id") == contribution_id:
                return dict(contribution)
        return None

    def resource_ledger(self) -> dict[str, int]:
        return {
            "packs": len(self._packs),
            "contributions": sum(len(pack["contribution_ids"]) for pack in self._packs.values()),
        }

    # -- writes -----------------------------------------------------------

    def install(self, payload: Any) -> dict[str, Any]:
        """Validate, check every conflict, then commit.

        Every refusal below happens before ``self._packs`` is touched, so
        "nothing changed" holds because nothing had changed yet -- not because
        a rollback ran correctly.
        """
        verdict = validate_manifest(payload)
        if not verdict["valid"]:
            raise InstallRefused("manifest_invalid", {
                "errors": [error["code"] for error in verdict["errors"]],
                "first": verdict["errors"][0] if verdict["errors"] else None,
            })
        manifest = payload if isinstance(payload, Mapping) else _parsed(payload)
        namespace = manifest["namespace"]

        if namespace in self._packs:
            raise InstallRefused("namespace_taken", {
                "namespace": namespace,
                "installed_version": self._packs[namespace]["version"],
                "offered_version": manifest.get("version"),
            })

        if len(self._packs) + 1 > REGISTRY_LIMITS["max_packs"]:
            raise InstallRefused("too_many_packs", {"limit": REGISTRY_LIMITS["max_packs"]})

        ids = _contribution_ids(manifest)
        if len(ids) > REGISTRY_LIMITS["max_contributions_per_pack"]:
            raise InstallRefused("too_many_contributions", {
                "limit": REGISTRY_LIMITS["max_contributions_per_pack"], "scope": "pack",
            })
        total = sum(len(pack["contribution_ids"]) for pack in self._packs.values())
        if total + len(ids) > REGISTRY_LIMITS["max_contributions_total"]:
            raise InstallRefused("too_many_contributions", {
                "limit": REGISTRY_LIMITS["max_contributions_total"], "scope": "installation",
            })

        # A namespaced id cannot normally collide across packs, because the
        # manifest validator already refuses an id outside its own namespace.
        # It is checked anyway: this is the last place before a commit, and a
        # check that depends on an earlier one staying correct is a check that
        # will one day be wrong quietly.
        for installed_namespace, pack in sorted(self._packs.items()):
            contested = sorted(set(ids) & set(pack["contribution_ids"]))
            if contested:
                raise InstallRefused("contribution_id_conflict", {
                    "namespace": namespace,
                    "conflicts_with": installed_namespace,
                    "contested": contested,
                })

        self._packs[namespace] = {
            "version": manifest["version"],
            "supports_schema_versions": list(manifest.get("supports_schema_versions") or []),
            "contribution_ids": ids,
            "kinds": _kinds(manifest),
            "manifest": manifest,
        }
        return {
            "namespace": namespace,
            "version": manifest["version"],
            "contributions": _kinds(manifest),
            "contribution_count": len(ids),
        }

    def remove(self, namespace: str) -> dict[str, Any]:
        """Remove one pack, or refuse if it is not installed."""
        pack = self._packs.pop(namespace, None)
        if pack is None:
            raise InstallRefused("pack_not_installed", {"namespace": namespace})
        return {"namespace": namespace, "removed": len(pack["contribution_ids"])}

    def clear(self) -> None:
        """Release everything. Called from the runtime's own teardown."""
        self._packs.clear()


def _parsed(payload: Any) -> Mapping[str, Any]:
    import json

    return json.loads(payload)


def visible_packs(registries: Mapping[str, SdkRegistry], readable: Iterable[str]) -> list[dict[str, Any]]:
    """Every pack in the projects the caller may open, and nothing else.

    Filtering rather than denying: an unassigned caller sees an empty list, the
    same answer they would get from an installation with no packs at all, so a
    listing cannot be used to learn that a project exists.
    """
    visible = []
    for project_id in sorted(set(readable)):
        registry = registries.get(project_id)
        if registry is None:
            continue
        for pack in registry.list_packs():
            visible.append({**pack, "project_id": project_id})
    return visible
