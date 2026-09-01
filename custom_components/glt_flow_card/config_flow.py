"""Config flow for GLT Flow Card Companion."""
from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

from .const import DOMAIN, OPTION_SPECS, normalize_options


def _option_value(name):
    """Validate one retained integer option without accepting bool values."""

    def validate(value):
        try:
            return normalize_options({name: value}, strict=True)[name]
        except ValueError as err:
            raise vol.Invalid(str(err)) from err

    return validate


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
        return GltFlowCardOptionsFlow()


class GltFlowCardOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        current = normalize_options(dict(self.config_entry.options))
        if user_input is not None:
            return self.async_create_entry(
                title="",
                data=normalize_options(user_input, strict=True),
            )
        schema = vol.Schema(
            {
                vol.Optional(name, default=current[name]): _option_value(name)
                for name in OPTION_SPECS
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
