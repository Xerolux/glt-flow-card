# 05-17 — Installation is all-or-nothing

**Status:** complete
**Requirements:** SDK-01 · **Threats:** T5-13, T5-14 GREEN

## What shipped

`custom_components/glt_flow_card/sdk_registry.py` — `SdkRegistry` (one per
project), `InstallRefused`, `REGISTRY_LIMITS`, `INSTALL_REFUSALS`,
`visible_packs` — plus three declared, registered and policed websocket routes:
`glt_flow_card/extensions/list`, `/install` and `/remove`. Route count 42 → 45.

## The decisions

**Nothing changes until everything is checked.** Validate the manifest, check
every conflict, enforce every bound — and only then commit. "Nothing changed" is
then a property of the *order*, not of a rollback that has to be correct. Every
refusal test asserts it twice: that it refused, and that the registry is
byte-identical afterwards.

**One registry per project, not one table filtered per read.** The registry
never holds more than one project's packs, so a listing cannot reach a project
the caller never opened. That is stronger than filtering a shared table, and it
cannot be forgotten at a call site.

**A conflict names both sides; a hidden project names nothing.** Within a
project the caller can open, a conflict reports both namespaces and the
contested id, because the owner has to know what to remove and hiding it
protects nothing. Across projects the opposite holds: a namespace taken in a
project the caller cannot see does not block an install in one they can, which
would leak its existence by refusal. There is a test for exactly that.

**The redundant conflict check stays.** The manifest validator already refuses
an id outside its own namespace, which makes a cross-pack collision nearly
unreachable. It is checked again at the last point before the commit, because a
check that depends on an earlier one staying correct is a check that will one
day be wrong quietly. The test that exercises it has to reach past the validator
to construct the case, and says so.

**The route is project-scoped, and the handler reads the decision.** Policy
resolves the project and answers missing and unauthorized identically — a
guarantee the handler cannot forget to repeat. The handler takes the id from
`msg[DECISION_KEY].project_id` rather than from the message, so it cannot act on
an id policy never approved.

**Refusals travel inside the declared error vocabulary.** `ERROR_CODES` is the
contract's closed set and every code in it is one a client branches on; a code
per installation mishap would widen the contract for detail that belongs in the
message. The wire code is `invalid_input`, and the reason plus its detail travel
in the body, where the extension manager reads them.

**Packs die with the runtime.** `async_invalidate` clears every registry.
Carrying packs across a reload would mean one accepted under a project schema
version surviving into an installation running another.

## Two traps the check-in warned about, both hit

The policy prober sends a probe carrying only `type`, so a required request
field turns a policy decision into a schema rejection — which reads as a route
that fails open. Every field is now optional with a default.

And the route is declared in **two** tables: the shipped `policy.py` and the
test-owned `policy_contract.py`. That duplication is deliberate — the contract
is the specification and the manifest is the implementation — so adding a route
means saying it twice, and the oracle catches either omission.

## Evidence

- `pytest tests/components/glt_flow_card/test_sdk_registry.py` — 14 tests.
- `pytest tests/components/glt_flow_card/test_policy.py test_init.py` — passing,
  with declared and registered route sets equal at 45 and the policy matrix
  reporting a decision for every role on every new route.
- Full component suite: 304 passed.
- Bounds asserted with numbers: 64 packs, 256 contributions per pack, 4096 per
  installation, each with a refusal test that leaves the registry unchanged.
