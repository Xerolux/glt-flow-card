# 08-07 — No dispatch path escapes

**Status:** complete. Closes T8-03.

A gate applied where somebody remembered to apply it has the shape of somebody's
memory. This test gives it the shape of the product: the source is walked with
`ast`, every call that can cause an effect outside the integration is found, and
each must be preceded by a decision in the same function.

The behavioural half matters as much. A test that iterates a list and asserts a
property of each entry proves nothing about code that ran — the vacuous pass
this suite corrected in Phase 4 (a retirement test querying for a card the
harness never mounts) and again in Phase 7 (an upper bound satisfied by zero
fetches). So the decisions are collected and the collection is checked against
the declared kinds.

**The exemption list was written expecting two entries and needs none.** The
notification path, on the theory that marking rather than blocking meant it could
skip the decision — wrong, because a marked effect still has to *ask*, and that
is how it learns to mark itself. And the remote transport, on the theory that the
handler above it was close enough — which is precisely the reasoning the test
exists to defeat.

Mutation-verified: removing the remote gate fails with
`__init__.py::ws_remote_control calls ['remote_control'] without deciding first`.
