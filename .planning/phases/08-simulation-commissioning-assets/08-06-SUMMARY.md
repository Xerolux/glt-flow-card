# 08-06 — One dispatch decision, consulted at the point of dispatch

**Status:** complete. Closes T8-01, T8-02 and T8-04.

The phase's headline, and a safety defect rather than a correctness one. Three
properties, none optional:

**Consulted at the point of dispatch.** Not at the top of a handler where a
later branch can slip past, and not in a wrapper somebody has to remember. The
state is read through a *callable* so a session that started or expired while a
handler was awaiting something still takes effect.

**Enumerated, not inferred** — see 08-07.

**Fails closed.** And this is where the test found a real defect in my own code:
`bool(None)` is `False`, so a missing simulation reader read as "not
simulating". A silent fail-*open* in the module whose entire purpose is failing
closed. `None` is now "nobody told me" and refuses.

The two refusal reasons are distinct because they call for different responses:
`simulation_active` means "you are rehearsing", `simulation_state_unavailable`
means "the Companion is unwell and is protecting you". Only the second makes
waiting sensible.
