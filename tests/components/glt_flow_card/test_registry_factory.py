"""The provenance fixtures must actually produce the cases they claim."""
from __future__ import annotations

import pytest
from homeassistant.core import HomeAssistant

from .registry_factory import UNKNOWN_INTEGRATION, RegistryFactory

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


async def test_the_matrix_covers_every_provenance_case(hass: HomeAssistant) -> None:
    """Each case a provenance implementation must handle is constructible."""
    factory = RegistryFactory(hass)
    cases = factory.seed_provenance_matrix()

    for role in (
        "core_integration", "unknown_integration", "no_device",
        "modbus_named_knx", "knx_named_modbus", "unavailable",
        "unknown_state", "unregistered", "absent", "disabled_by_user",
    ):
        assert role in cases, role

    assert cases["core_integration"].expected_integration == "modbus"
    assert cases["unknown_integration"].expected_integration == UNKNOWN_INTEGRATION
    assert cases["unregistered"].expected_integration == "unknown"
    assert cases["absent"].state is None


async def test_misleading_names_are_owned_by_the_other_integration(hass: HomeAssistant) -> None:
    """The name-inference trap is real, not decorative.

    An implementation that reads the protocol out of the entity id gets both of
    these backwards, which is the whole point of seeding them.
    """
    factory = RegistryFactory(hass)
    cases = factory.seed_provenance_matrix()

    assert "knx" in cases["modbus_named_knx"].entity_id
    assert cases["modbus_named_knx"].expected_integration == "modbus"
    assert "modbus" in cases["knx_named_modbus"].entity_id
    assert cases["knx_named_modbus"].expected_integration == "knx"


async def test_devices_and_areas_carry_showable_identity(hass: HomeAssistant) -> None:
    """A provenance card needs manufacturer, model and an area to show."""
    from homeassistant.helpers import device_registry as dr

    factory = RegistryFactory(hass)
    device_id = factory.device(domain="modbus", identifier="cd34", area="Technikraum")
    device = dr.async_get(hass).async_get(device_id)

    assert device is not None
    assert device.manufacturer and device.model
    assert device.identifiers and device.connections
    assert device.area_id == factory.area("Technikraum")
