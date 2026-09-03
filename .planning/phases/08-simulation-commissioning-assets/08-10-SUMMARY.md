# 08-10 — Services, units, device classes, duplicates, bounds

**Status:** complete. Closes T8-12, T8-15 and T8-16.

**Services are references too.** A control naming a service that does not exist
was otherwise discovered when an operator pressed the button — the same "fails at
the call, not at the request" shape Phase 4 closed for controls and Phase 6 for
calendar bindings.

**Unit and device-class findings name both sides.** "The profile expects °C and
the entity reports %" is actionable; "wrong unit" leaves the engineer to guess
which half is wrong, which Phase 5 established is a tool disagreeing with a human
without saying why. The two are distinct findings because they have different
causes and different fixes.

**Duplicate bindings are a warning that names both slots**, because two slots
reading one entity is occasionally deliberate and usually a copy-paste error.

**Suggestions are bounded and say so.** `unused` returned every entity in the
installation the project did not reference — on a real Home Assistant, thousands
of rows rendered into a modal. A truncated list that does not say it was
truncated reads as a complete one.
