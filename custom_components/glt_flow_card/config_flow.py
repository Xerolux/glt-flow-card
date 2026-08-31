"""Config flow for GLT Flow Card Companion."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import DOMAIN


class GltFlowCardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            return self.async_create_entry(title="GLT Flow Card Companion", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return GltFlowCardOptionsFlow(config_entry)


class GltFlowCardOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None):
        current = self.config_entry.options
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        schema = vol.Schema({
            vol.Optional("server_enforced", default=current.get("server_enforced", True)): bool,
            vol.Optional("default_lock_ttl", default=current.get("default_lock_ttl", 300)): vol.All(int, vol.Range(min=30, max=3600)),
            vol.Optional("max_versions", default=current.get("max_versions", 60)): vol.All(int, vol.Range(min=5, max=500)),
            vol.Optional("max_audit", default=current.get("max_audit", 5000)): vol.All(int, vol.Range(min=100, max=50000)),
        })
        return self.async_show_form(step_id="init", data_schema=schema)
