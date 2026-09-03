"""Home Assistant registry fixtures for provenance tests.

Provenance is only meaningful against realistic registries: an entity owned by a
core integration behaves differently from one owned by a custom integration, and
both behave differently from one that is disabled, unavailable, or absent from the
registry altogether. This factory builds those situations as isolated fixture data.

Nothing here contacts a live Home Assistant. Every registry entry, device, area and
config entry is created inside the test instance.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

#: Integrations the card knows how to label. Everything else is reported as its
#: own domain: claiming to support a protocol we cannot verify is worse than
#: saying we do not know.
KNOWN_INTEGRATIONS = ("modbus", "knx", "mqtt", "esphome")

#: An integration domain no installation is expected to have, used to prove the
#: unknown path is exercised rather than assumed.
UNKNOWN_INTEGRATION = "acme_fieldbus"


@dataclass
class SeededEntity:
    """One seeded entity plus the evidence a test needs to assert about it."""

    entity_id: str
    platform: str
    config_entry_id: str | None = None
    device_id: str | None = None
    area_id: str | None = None
    unit: str | None = None
    device_class: str | None = None
    disabled_by: Any = None
    state: str | None = None
    #: What the registry says, for tests that assert we did not guess.
    expected_integration: str = ""


@dataclass
class RegistryFactory:
    """Seed the registries of one test `hass` with realistic provenance cases."""

    hass: HomeAssistant
    entries: dict[str, MockConfigEntry] = field(default_factory=dict)
    seeded: dict[str, SeededEntity] = field(default_factory=dict)

    # -- helpers ------------------------------------------------------------
    def _entity_registry(self) -> er.EntityRegistry:
        return er.async_get(self.hass)

    def _device_registry(self) -> dr.DeviceRegistry:
        return dr.async_get(self.hass)

    def _area_registry(self) -> ar.AreaRegistry:
        return ar.async_get(self.hass)

    def config_entry(self, domain: str, *, title: str | None = None) -> MockConfigEntry:
        """Create (once) a config entry for one integration domain."""
        if domain in self.entries:
            return self.entries[domain]
        entry = MockConfigEntry(domain=domain, title=title or domain.upper(), data={})
        entry.add_to_hass(self.hass)
        self.entries[domain] = entry
        return entry

    def area(self, name: str) -> str:
        """Create or fetch an area and return its id."""
        registry = self._area_registry()
        existing = next((entry for entry in registry.async_list_areas() if entry.name == name), None)
        if existing is not None:
            return existing.id
        return registry.async_create(name).id

    def device(
        self,
        *,
        domain: str,
        identifier: str,
        manufacturer: str = "Fixture Works",
        model: str = "FX-1",
        area: str | None = None,
    ) -> str:
        """Create a device with identity a provenance card can actually show."""
        entry = self.config_entry(domain)
        device = self._device_registry().async_get_or_create(
            config_entry_id=entry.entry_id,
            identifiers={(domain, identifier)},
            connections={("mac", f"00:11:22:33:{identifier[:2]:>02}:01")},
            manufacturer=manufacturer,
            model=model,
            name=f"{manufacturer} {identifier}",
        )
        if area is not None:
            self._device_registry().async_update_device(device.id, area_id=self.area(area))
        return device.id

    # -- seeding ------------------------------------------------------------
    def entity(
        self,
        *,
        object_id: str,
        platform: str,
        domain: str = "sensor",
        device_id: str | None = None,
        area: str | None = None,
        unit: str | None = None,
        device_class: str | None = None,
        disabled_by: Any = None,
        state: str | None = "21.5",
        register: bool = True,
    ) -> SeededEntity:
        """Seed one entity and return what a test may assert about it.

        `register=False` produces an entity that exists in the state machine but
        not in the registry, which is exactly the case where provenance must
        answer `unknown` rather than inventing an owner.
        """
        entity_id = f"{domain}.{object_id}"
        config_entry_id = None
        if register:
            entry = self.config_entry(platform)
            config_entry_id = entry.entry_id
            registry = self._entity_registry()
            registered = registry.async_get_or_create(
                domain,
                platform,
                f"{platform}-{object_id}",
                suggested_object_id=object_id,
                config_entry=entry,
                device_id=device_id,
                disabled_by=disabled_by,
                unit_of_measurement=unit,
                original_device_class=device_class,
            )
            entity_id = registered.entity_id
            if area is not None:
                registry.async_update_entity(entity_id, area_id=self.area(area))
        if state is not None:
            self.hass.states.async_set(entity_id, state, {"unit_of_measurement": unit} if unit else {})

        seeded = SeededEntity(
            entity_id=entity_id,
            platform=platform if register else "",
            config_entry_id=config_entry_id,
            device_id=device_id,
            area_id=self.area(area) if area else None,
            unit=unit,
            device_class=device_class,
            disabled_by=disabled_by,
            state=state,
            expected_integration=platform if register else "unknown",
        )
        self.seeded[entity_id] = seeded
        return seeded

    def seed_provenance_matrix(self) -> dict[str, SeededEntity]:
        """Seed every provenance case at once and return them by role.

        The names are deliberately misleading in two cases: `modbus_named_knx`
        is owned by `knx` and `knx_named_modbus` is owned by `modbus`. Any
        implementation that reads a protocol out of a name gets both wrong.
        """
        device = self.device(domain="modbus", identifier="ab12", area="Heizraum")
        cases = {
            "core_integration": self.entity(
                object_id="flow_temperature", platform="modbus",
                device_id=device, area="Heizraum",
                unit="°C", device_class="temperature",
            ),
            "unknown_integration": self.entity(
                object_id="bus_point_7", platform=UNKNOWN_INTEGRATION, unit="bar",
            ),
            "no_device": self.entity(
                object_id="outdoor_temperature", platform="knx", unit="°C",
            ),
            "modbus_named_knx": self.entity(
                object_id="knx_return_temperature", platform="modbus", unit="°C",
            ),
            "knx_named_modbus": self.entity(
                object_id="modbus_room_setpoint", platform="knx", unit="°C",
            ),
            "unavailable": self.entity(
                object_id="pump_status", platform="modbus", device_id=device,
                state="unavailable",
            ),
            "unknown_state": self.entity(
                object_id="burner_hours", platform="modbus", state="unknown",
            ),
            "unregistered": self.entity(
                object_id="orphan_reading", platform="", register=False, state="7",
            ),
            "absent": SeededEntity(
                entity_id="sensor.never_existed", platform="",
                expected_integration="unknown", state=None,
            ),
        }
        disabled = self.entity(
            object_id="spare_channel", platform="modbus",
            disabled_by=er.RegistryEntryDisabler.USER, state=None,
        )
        cases["disabled_by_user"] = disabled
        return cases

    def fail_config_entry(self, domain: str) -> None:
        """Put an integration's config entry into a non-loaded state."""
        entry = self.config_entry(domain)
        # `state` is read-only on newer cores; the setter below is the supported
        # test path and is tolerated where it is absent.
        try:
            from homeassistant.config_entries import ConfigEntryState

            entry._async_set_state(self.hass, ConfigEntryState.SETUP_ERROR, "seeded failure")
        except Exception:  # pragma: no cover - lane-dependent internal API
            pass
