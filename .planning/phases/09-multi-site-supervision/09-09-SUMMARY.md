# 09-09 — An aggregate states its own completeness

**Status:** complete. Closes T9-14.

A portfolio roll-up computed while one site was silent was presented as
complete. This is the phase's characteristic defect in its purest form: an
answer that is incomplete and does not say so.

**A silent site contributes nothing — it does not contribute zero.** That is
exactly how a number comes out smaller and confident. Consumption across five
sites with one unreachable is not "the portfolio consumption"; it is four
sites' consumption, and the difference is invisible in the figure itself.

`require_stated_completeness()` refuses an aggregate that does not carry its own
completeness, rather than annotating one that does not. Refusing is the only
version that survives a new call site: an annotation is something a future
caller can forget to read.

**Treating a partial result as an error is wrong in both directions**, and the
error path is the tempting one because errors are simpler:

- Failing the whole evaluation because one site is down makes four healthy
  plants invisible. That is worse than the missing one.
- Returning the four and calling it "the portfolio" is the original defect.

So `roll_up()` returns the total, the answering sites, the absent sites *with
their reasons*, and a `complete` flag derived from those lists rather than
passed in — a flag a caller can set is a flag a caller can set wrongly.

`coverage_of()` exists so completeness is one computation rather than one per
surface.
