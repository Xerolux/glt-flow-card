# 09-12 — The contract, written down, and the register closed from commands

**Status:** complete.

`docs/wiki/Multi-Site.md` described the shipped, defective behaviour. It now
describes the contract: partial is an answer in both directions, the four site
states with `unreachable` versus `circuit_open` as the pair that matters, one
request per site under three bounds of which the total deadline is the one
usually missing, the two-half destination check naming `169.254.169.254`,
credentials never leaving the Companion and the `str(err)` topology leak, remote
reusing local authority, and a timeout that is not a failure.

Both READMEs gained a multi-site section, and the Phase-2 paragraph that said
the remote transport was unavailable no longer says so.

**The page ends with what the product does not have** — no remote engineering,
no cross-site alarm correlation, no measured capacity numbers, no redesign of
credential storage. A documentation page that only lists capabilities is a page
a reader extrapolates from, and extrapolating from a supervision product is how
someone assumes a plant is being watched.

**The register was closed from commands, not from memory.** Each row was marked
from its own owner command run at head; where five rows name
`test_remote_authority.py`, that command was run five times. The build was
refreshed and the packages restaged first, so no run was against a stale
artifact.

**T9-20 stays `planned`**, recorded with its exact failure output rather than
its likely cause — this container has no Docker engine, so the composed release
leaf cannot run here. It is raised rather than taken: the row is not marked from
its parts passing separately.

**A gate defect found by closing the register.** The Phase-9 gate failed at the
exact-dist step for an environment reason: the container's Chromium revision
differs from the pinned one, and the suites needed
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` set by hand. A gate that only passes with
out-of-band help is a gate whose green is a property of one shell. The config
now prefers the pinned revision silently and substitutes an installed sibling
only when the pinned one is absent from disk — printing the substitution,
because running the browser evidence against a different browser than the one
named is a fact about the evidence.
