# 10-03 — A pseudo-locale that makes a missing translation visible

**Status:** complete. Closes T10-02.

A key-count check is not evidence: two catalogs can have identical key sets
while one renders the other's words. Everything localized changes shape under a
pseudo-locale; anything that does not is not going through the catalog.

Three decisions:

**Generated at test time, never checked in.** A checked-in pseudo-locale drifts
from the catalog it is testing and then tests nothing — the fixture failure this
codebase has already corrected twice.

**Placeholders survive untouched.** Accenting `{seconds}` would break
interpolation, and a test that breaks the thing it measures measures the break.

**Deterministic.** A pseudo-locale that differs between runs makes a failing
assertion unreproducible, which is worse than not having one.

Two mutations verified it can see: reintroducing the English fallback fails "a
missing key is a throw", and copying half the English values over their German
siblings fails "the German catalog is German" with the count.
