"""Where a datapoint's value comes from, and whether it is actually live.

Every answer here is read from Home Assistant's own registries and state
machine. Nothing is inferred from an entity id or a friendly name: a name is a
label somebody typed, and a plant where `sensor.knx_return_temperature` is
served by Modbus is not unusual, it is Tuesday.

The card implements no fieldbus driver and opens no connection. It reports the
integration that owns an entity, and where it does not recognise that
integration it says so rather than guessing a protocol it cannot verify.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

#: Integrations the card can label. Everything else is reported as its own
#: domain and marked unknown. Of the protocols the requirement names, `modbus`
#: and `knx` are core integrations; BACnet and OPC UA are served by custom
#: integrations whose domains differ per installation, so claiming to support
#: them by name would be a claim this code cannot keep.
KNOWN_INTEGRATIONS: dict[str, str] = {
    "modbus": "Modbus",
    "knx": "KNX",
    "mqtt": "MQTT",
    "esphome": "ESPHome",
    "bacnet": "BACnet",
    "opcua": "OPC UA",
}

#: Every health value the card may report. `unknown` is a value, not a gap: an
#: entity nobody can find and an entity reporting unavailable are different
#: situations and an operator needs to tell them apart.
HEALTH_VALUES = ("live", "stale", "unavailable", "disabled", "unknown")

#: Bounds on what a provenance record echoes. Device identifiers and connections
#: are useful to see and are not a place to dump arbitrary integration data.
MAX_IDENTIFIERS = 8
MAX_CONNECTIONS = 8
MAX_TEXT = 128

DEFAULT_FRESHNESS_SECONDS = 900


def _text(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)[:MAX_TEXT]


def _sourced(source: str, **fields: Any) -> dict[str, Any]:
    """Every provenance row states which registry it came from.

    A row with no source is an assertion nobody can check, so the source is part
    of the shape rather than something a caller has to remember to add.
    """
    return {"source": source, **fields}


@dataclass
class ProvenanceService:
    """Answer provenance and health questions from the registries."""

    hass: Any
    #: Cache entries are stamped with the runtime generation that produced them,
    #: so an entry can never outlive the runtime it belongs to.
    generation: int = 1
    _cache: dict[tuple[str, int], dict[str, Any]] = field(default_factory=dict)

    def invalidate(self) -> None:
        """Drop every cached record. A cache is never a source of truth."""
        self._cache.clear()

    def cached_count(self) -> int:
        """How many records are cached, for the lifecycle resource ledger."""
        return len(self._cache)

    async def async_describe(
        self,
        entity_id: str,
        *,
        freshness_seconds: int | None = None,
        age_seconds: float | None = None,
    ) -> dict[str, Any]:
        """Describe one entity's provenance and health.

        `age_seconds` lets a caller state the observed age explicitly. Freshness
        is then a decision about a carried number rather than about a clock this
        service reads for itself, which is what makes it testable.
        """
        entity_registry = er.async_get(self.hass)
        entry = entity_registry.async_get(entity_id)
        state = self.hass.states.get(entity_id)

        integration = _sourced("entity_registry", domain=None, label=None, known=False)
        config_entry = _sourced("config_entries", entry_id=None, title=None, state=None)
        device = _sourced("device_registry", id=None, manufacturer=None, model=None,
                          identifiers=[], connections=[])
        area = _sourced("area_registry", id=None, name=None, floor_id=None)

        if entry is not None:
            domain = _text(entry.platform)
            integration = _sourced(
                "entity_registry",
                domain=domain,
                label=KNOWN_INTEGRATIONS.get(domain or "", domain),
                known=domain in KNOWN_INTEGRATIONS,
            )
            config_entry = self._config_entry(entry)
            device = self._device(entry)
            area = self._area(entry, device)

        health = self._health(
            entry=entry,
            state=state,
            freshness_seconds=freshness_seconds or DEFAULT_FRESHNESS_SECONDS,
            age_seconds=age_seconds,
        )
        return {
            "entity_id": entity_id,
            "integration": integration,
            "config_entry": config_entry,
            "device": device,
            "area": area,
            "health": health,
        }

    # -- sections -----------------------------------------------------------
    def _config_entry(self, entry: Any) -> dict[str, Any]:
        entry_id = getattr(entry, "config_entry_id", None)
        if entry_id is None:
            return _sourced("config_entries", entry_id=None, title=None, state=None)
        record = self.hass.config_entries.async_get_entry(entry_id)
        return _sourced(
            "config_entries",
            entry_id=entry_id,
            title=_text(getattr(record, "title", None)),
            state=_text(getattr(getattr(record, "state", None), "value", None)),
        )

    def _device(self, entry: Any) -> dict[str, Any]:
        device_id = getattr(entry, "device_id", None)
        if device_id is None:
            return _sourced("device_registry", id=None, manufacturer=None, model=None,
                            identifiers=[], connections=[])
        record = dr.async_get(self.hass).async_get(device_id)
        if record is None:
            return _sourced("device_registry", id=device_id, manufacturer=None, model=None,
                            identifiers=[], connections=[])
        return _sourced(
            "device_registry",
            id=device_id,
            manufacturer=_text(record.manufacturer),
            model=_text(record.model),
            name=_text(record.name),
            identifiers=[[_text(a), _text(b)] for a, b in list(record.identifiers)[:MAX_IDENTIFIERS]],
            connections=[[_text(a), _text(b)] for a, b in list(record.connections)[:MAX_CONNECTIONS]],
        )

    def _area(self, entry: Any, device: dict[str, Any]) -> dict[str, Any]:
        area_id = getattr(entry, "area_id", None)
        if area_id is None and device.get("id") is not None:
            record = dr.async_get(self.hass).async_get(device["id"])
            area_id = getattr(record, "area_id", None)
        if area_id is None:
            return _sourced("area_registry", id=None, name=None, floor_id=None)
        area = ar.async_get(self.hass).async_get_area(area_id)
        # `floor_id` is absent on older supported cores. Absent means unknown,
        # not an error: the minimum lane must degrade, never raise.
        return _sourced(
            "area_registry",
            id=area_id,
            name=_text(getattr(area, "name", None)),
            floor_id=_text(getattr(area, "floor_id", None)),
        )

    def _health(
        self,
        *,
        entry: Any,
        state: Any,
        freshness_seconds: int,
        age_seconds: float | None,
    ) -> dict[str, Any]:
        """Resolve health from what Home Assistant reports, in a fixed order.

        Disabled outranks unavailable, which outranks stale: an entity that was
        switched off deliberately is a different situation from one that is
        merely quiet, and an operator should be told the most specific one.
        """
        if entry is not None and getattr(entry, "disabled_by", None) is not None:
            return _sourced("entity_registry", value="disabled",
                            reason=_text(getattr(entry.disabled_by, "value", entry.disabled_by)))
        if state is None:
            return _sourced("state_machine", value="unknown", reason="absent")
        if state.state in ("unavailable", "unknown"):
            return _sourced("state_machine", value="unavailable", reason=_text(state.state))

        age = age_seconds
        if age is None:
            last = getattr(state, "last_updated", None)
            if last is None:
                return _sourced("state_machine", value="unknown", reason="no_timestamp")
            age = (datetime.now(timezone.utc) - last).total_seconds()
        if age > freshness_seconds:
            return _sourced("state_machine", value="stale",
                            age_seconds=int(age), budget_seconds=freshness_seconds)
        return _sourced("state_machine", value="live",
                        age_seconds=int(max(age, 0)), budget_seconds=freshness_seconds)


def provenance_service(hass: Any) -> ProvenanceService | None:
    """Return the loaded runtime's provenance service, or None."""
    from . import _runtime_for  # local import avoids a module import cycle

    runtime = _runtime_for(hass)
    return getattr(runtime, "provenance", None) if runtime is not None else None
