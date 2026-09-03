---
phase: 08-simulation-commissioning-assets
---

# Phase 8 Research

Measured against the vendored Home Assistant 2026.2.3 rather than recalled, on
the three questions where a wrong assumption would be expensive.

## 1. Where a service call can leave this integration

Established by enumerating call sites rather than by memory, because the whole
simulation block depends on the list being complete.

| Path | Symbol | Reaches |
|---|---|---|
| Configured control | `ws_controls_execute` (`__init__.py:1354`) | `hass.services.async_call` |
| Legacy control | `ws_control_execute` (`__init__.py:2029`) | retired, reachable |
| Remote control | `ws_remote_control` (`__init__.py:2798`) | remote site service |
| Alarm notification | `notifications.py` | `notify.*` |
| Schedule runner | schedule execution | configured service |
| Report delivery | report schedule runner | none today |

Six paths. Two of them (`notify`, schedules) are *not* physical-plant writes but
are still effects that leave the building, and the phase must decide explicitly
for each rather than blocking "controls" and calling it done. The decision
recorded in `08-PATTERNS.md`: physical dispatch is blocked, notification is
*marked* rather than blocked, because an alarm that fires during a rehearsal is
still an alarm and silencing it would be a second safety defect.

## 2. What the registries can actually tell us

`homeassistant.helpers.entity_registry` and `device_registry` are the only
sources for the provenance DIAG-01 requires, and they are reachable only from
the Companion — confirming that D8 is an architectural fault and not an
omission.

An `entity_registry.RegistryEntry` carries `config_entry_id`, `device_id`,
`platform`, `unique_id`, `disabled_by`, `entity_category`, `original_device_class`
and `unit_of_measurement`. A `device_registry.DeviceEntry` carries
`manufacturer`, `model`, `via_device_id` and `identifiers`.

Two consequences:

- **`platform` is the integration**, and it is authoritative. It must be read
  rather than inferred from the entity id, which is the mistake PROTO-01
  explicitly forbids ("without inferring protocols from names").
- **An entity can be in the state machine but not the registry** (a template or
  YAML entity), and one can be in the registry but not the state machine
  (disabled, or not yet loaded). These are *different* diagnoses and the audit's
  single "missing" cannot express either.

## 3. Virtual time

Home Assistant offers no virtual clock to an integration; `dt_util.utcnow()` is
patched only in tests. So a repeatable scenario cannot be built by moving Home
Assistant's clock, and must instead be a **pure function from a scenario
definition and a tick index to a state**, evaluated by the Companion.

That is a stronger position than a clock anyway: it is reproducible by
construction, it needs no wall time to pass, and a scenario can be evaluated for
entities that do not exist yet (D7), because nothing is read from the state
machine to produce it.

The tick is the unit. A scenario declares its step and its length, and tick *n*
always yields the same state — so a scenario re-run a month later on a different
machine produces the same trace, which is what "repeatable" has to mean if the
word is to carry weight.
