# 06-13 Summary — schedule routes

**Status:** complete. 11 route tests.

Four routes in both policy tables. `schedule.write` sits with the engineer,
because a schedule was already editable only through `project.write`: adding a
boundary must not change who may cross it.

`schedules/list` filters rather than denies, and filters **before** applying the
limit. The test seeds twenty hidden rows and asks for five — slicing first turns
the limit into a count oracle for a project the caller cannot open.

The preview resolves **server-side, in the site's timezone**. Resolving in the
browser would answer for the browser's zone, and a browser in a different zone
from the plant is ordinary.

Validation moved to the boundary: a `time` of "tea" is refused when saved.

**Test-scope correction.** The sentinel required a `schedule_audit` module. A
separate module for three call sites is ceremony, and a contract naming an
implementation shape rather than an outcome fails work that is correct. It
asserts behaviour now, by parsing.
