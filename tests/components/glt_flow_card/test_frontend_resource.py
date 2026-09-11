"""The bundled resource must register through Home Assistant's HTTP instance."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from custom_components.glt_flow_card import _serve_bundled_frontend_once


async def test_frontend_registers_once_using_http_instance():
    register = AsyncMock()
    hass = SimpleNamespace(data={}, http=SimpleNamespace(async_register_static_paths=register))
    await _serve_bundled_frontend_once(hass)
    await _serve_bundled_frontend_once(hass)
    register.assert_awaited_once()
    paths = register.await_args.args[0]
    assert len(paths) == 1
    assert paths[0].url_path == "/glt_flow_card/www"
    assert paths[0].cache_headers is False
    assert hass.data["glt_flow_card"]["frontend_served"] is True


async def test_frontend_registration_failure_can_be_retried():
    register = AsyncMock(side_effect=[RuntimeError("HTTP not ready"), None])
    hass = SimpleNamespace(data={}, http=SimpleNamespace(async_register_static_paths=register))
    with pytest.raises(RuntimeError, match="HTTP not ready"):
        await _serve_bundled_frontend_once(hass)
    assert hass.data["glt_flow_card"]["frontend_served"] is False
    await _serve_bundled_frontend_once(hass)
    assert register.await_count == 2
    assert hass.data["glt_flow_card"]["frontend_served"] is True


async def test_missing_http_does_not_mark_resource_as_served():
    hass = SimpleNamespace(data={})
    await _serve_bundled_frontend_once(hass)
    assert hass.data["glt_flow_card"]["frontend_served"] is False
