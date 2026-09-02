# 09-03 — Where the Companion may connect

**Status:** complete. Closes T9-03, T9-04 and T9-05.

The shipped code accepted **any** URL: no scheme check, no host check, no
allowlist — and the Companion then made an *authenticated* request to it and
returned the body to the browser. That is a server-side request forgery tool
with a credential attached, reachable from a configuration field.

**The check has two halves, and neither carries alone.**

A server-owned allowlist is the first. A destination is site configuration,
never project data — the same rule as the notification allowlist and the
simulation lock, and its third appearance makes it the product's security model
rather than a precaution.

A check of the **resolved address at connect time** is the second. An allowlisted
name can resolve publicly during validation and to `127.0.0.1` when connecting;
that is DNS rebinding, and it defeats a list that only looks at the name.
Loopback, link-local, private and unique-local ranges are refused, and
`169.254.169.254` is refused by name — it is the cloud metadata endpoint, and an
SSRF that reaches it returns credentials for the whole account.

`is_routable` uses `is_global` as the answer, with the explicit range checks kept
beside it as documentation of what that means.

**A corpus defect worth recording.** The first corpus used `203.0.113.x` as its
"public" address and the check classified it private. The check was right —
TEST-NET-3 is documentation space, not public address space — and **the fixture
was wrong**. The address became `93.184.216.34` and a row was added asserting
that documentation ranges are not treated as public, so the mistake cannot be
made again silently.

The corpus also had to be split into `expected` and `expected_at_connect`,
because a single expectation column conflated validation-time and
connection-time verdicts — which is the very distinction the second half exists
to draw.

Disabled certificate verification is refused unless declared per site, is
recorded, and then travels with every figure that site produces.
