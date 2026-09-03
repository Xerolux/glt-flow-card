# 08-09 — The commissioning diagnostic moves to the Companion

**Status:** complete. Closes T8-10, T8-11 and T8-13.

`diagnoseConfig(config, hassStates)` read the state map the card was handed, so
registry provenance was not merely missing but **unreachable from where the code
ran**. `entity_registry` and `device_registry` exist only in the Companion. This
is the third phase to move a decision here after alarms and trends, which
suggests it is the product's architecture rather than a per-phase preference.

**It stopped inventing findings.** The collector treated any string containing a
dot as an entity id, so a version number, a filename and a decimal written as
text each became a "missing entity". An engineer who learns the readiness view
reports things that are not true stops reading it, and then nothing else it
reports matters. References now come from declared locations only, and each
finding names where it came from — "the pump's `flow` slot names this entity"
rather than "an entity is missing".

**Four answers, not one.** Registry membership and state-machine membership are
independent, and the combinations send an engineer to four different places.
`registered_not_loaded` means disabled or a failed integration setup;
`unregistered` is a template or YAML entity, which is *informational* rather than
a fault, because reporting a normal way of running Home Assistant as a defect
trains people to ignore the view.

Staleness is computed server-side with an age. The browser built ages from
`Date.now()`, so a client with a wrong clock reported plausible wrong ones.
