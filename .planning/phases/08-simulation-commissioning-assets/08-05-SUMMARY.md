# 08-05 — The simulation session

**Status:** complete. Closes T8-02 and T8-06.

`simulation.enabled` lived in the project document, which is operator input, and
the one gate the product had read `gates.simulation` from the same place. So the
data deciding whether a write reached plant was authored by the people the block
exists to protect. Phase 6 established the rule after finding a notification
service name in a project document acting as an authorization; this is that rule
with plant writes behind it.

**It expires**, because a rehearsal that never ends makes the plant unoperable
and somebody then works around the block — which leaves the site worse off than
having no block at all.

**An over-long TTL is refused, not capped.** Phase 6 shipped a 90-day shelve
request silently truncated to 7 days and the operator walked away believing an
alarm was quiet for three months. Truncation is a lie told by arithmetic.

**An unreadable expiry does not extend a session.** The alternative failure mode
is a rehearsal that can never end, which is the worst outcome available here.

The session is deliberately not persisted across a restart: a Home Assistant
restart is exactly the moment an operator most needs the plant operable, and a
rehearsal that survived one would be a block nobody remembered enabling.
