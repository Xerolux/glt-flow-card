# 05-02 — RED: the catalog and the ports

> **Reconstructed at close-out**, from this plan, `05-SUMMARY.md` and the code
> at head — not written at execution time. It records what shipped and what the
> plan asked for; it is not a contemporaneous account of the work.

**Status:** complete.

Two sentinels written before the implementations, each carrying one marker and
reporting every unmet guarantee as an explicit gap.

The rule that decided this plan: **distinctness is asserted by digest, never by
inspection.** A catalog that advertises N variants is honest only if N drawings
differ, and "they look different" is not a measurement — a person comparing
thumbnails will not notice that `ahu` and `wallbox` render the same geometry,
and will certainly not notice that three base symbols render *nothing*.

Hashing the rendered output makes both failures arithmetic. The phase then found
exactly those failures: three base symbols with no branch in the shipped
renderer, eighteen advertised variants blank, nine more sharing another symbols
drawing. A cross product of two axes is a set of distinct variants only when
both axes are distinct, and the count had been an array length all along.
