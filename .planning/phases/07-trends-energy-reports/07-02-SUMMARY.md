# 07-02 — The measured value and the period vocabulary

**Status:** complete. Two tasks, both verified at head, in both runtimes.

## What was built

`src/v100/measured-value.mjs` and `custom_components/glt_flow_card/measured_value.py`:
the shape `{value, unit, coverage, gaps, source, period, resolved_at}`, with
constructors that refuse to build one without coverage and a named `absent()` for
"we asked and there is nothing there".

`src/v100/period-vocabulary.mjs` and
`custom_components/glt_flow_card/period_vocabulary.py`: closed sets for periods,
aggregates, sources, first weekdays and refusal reasons, with German and English
wording checked at module load, and the period→contract mapping the research
measured.

## What the work found

**The runtimes agreed on every value and disagreed on every byte — again, within
the hour.** Phase 6 spent a cycle on exactly this and `07-PATTERNS.md` records it
as a warning; the first parity check still failed. JavaScript has one number
type, so `JSON.stringify(0)` is `0` and there is no `0.0`, while Python's
`json.dumps(0.0)` is `0.0`. A coverage of exactly zero or one — the two most
common values this shape will ever carry — produced identical values and
different bytes.

Fixed at the source rather than in the comparison: Python emits the integral form
when a float is integral, and both fingerprints sort keys explicitly rather than
relying on the order the object literal happens to be written in. Non-integral
floats needed nothing — both runtimes emit the shortest round-tripping
representation, so 4/7 is `0.5714285714285714` in each.

The general lesson is narrower than "watch out for serialisation": **a value type
that crosses runtimes needs its canonical form decided when it is defined, not
when it is first compared.** The comparison is where the divergence is noticed,
which is far too late to be the place it is prevented.

**The lane workspace has no Node, and the repository already knew.** The first
parity tests lived in the Companion suite and spawned `node` to read
`src/v100/`. `test_lane_portability.py` rejected them by name — *"a repository
directory the lane workspace does not contain"* and *"spawns 'node', absent in
the lane"* — before the HA lane matrix could go red.

The direction is asymmetric and worth stating: **Node can reach Python; the lane
cannot reach Node.** So every cross-runtime comparison in this phase belongs on
the Node side. Phase 6's `schedule-dst-parity.test.mjs` is built that way, and I
should have followed it rather than rediscovering the constraint. Both Companion
test files now say why the comparison is not in them, so the next person does not
move it back.

**A guard is only useful if it is not reordered around.** Adding the two new
modules to the three packaging lists, my first edit sorted each list. That is
noise: the three lists are deliberately independent and duplicated at different
trust boundaries, and a reordered diff hides which entry actually changed. Redone
as pure insertions, the diff is six added lines.

## The decisions worth carrying forward

**Coverage is a field, not a convention.** A consumer that ignores it has to
ignore it deliberately, and a test can assert on what the product says about its
own answer rather than only on the answer — which is the only way a plausible
wrong number is catchable.

**Refuse the contradiction early.** A value with zero coverage is rejected at
construction, because a number that covers nothing came from somewhere it should
not have.

**Three sources, not two.** `statistics`, `raw` and `unavailable` keep "no data
came back" and "we did not ask" apart. Both produce an empty series, and only the
source distinguishes a correct implementation from a broken one — the trap
`07-VALIDATION.md` criterion 4 names.

**`sum` is not in the aggregate set.** Summing instantaneous samples does not
produce watt-hours; the result depends on the sampling rate. `change` is what a
counter's consumption is obtained with, and it is reset-aware in the Recorder
already.

## Evidence at head

- `node --test test/measured-value.test.mjs` — 14 passed, including the
  cross-runtime byte comparison.
- `node --test test/period-vocabulary.test.mjs` — 12 passed, including the
  fingerprint comparison.
- `py -3.13 -m pytest tests/.../test_measured_value.py test_period_vocabulary.py` — 31 passed.
- `npm test` — 444 passed, 0 failed, 0 skipped.
- `npm run test:python` — 499 passed, including `test_lane_portability.py`.
- `npm run validate:hacs-staging` — passes with both new modules staged.
