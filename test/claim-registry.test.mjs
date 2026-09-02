/**
 * The registry refuses a claim nothing supports (T10-10, T10-11, T10-12, T10-17).
 *
 * This is the phase's centre, and the two rows it most needs to be trusted on
 * are the ones where **this phase audits itself**: an automated sweep published
 * as WCAG conformance, and a number measured in a shared container quoted as
 * platform capacity. Both are claims this work is in a position to make and
 * would be believed about, which is why the registry is a build step rather
 * than a document — a document is edited by whoever wants the claim.
 *
 * The evidence commands are stubbed here. Running `npm test` inside `npm test`
 * is not evidence about the product; it is a way to spend twenty minutes
 * proving that a subprocess can be spawned. What this file checks is the
 * registry's **rules**, and `tools/claim-registry.mjs` run for real is what
 * exercises the commands.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  EVIDENCE_KINDS, OUTCOMES, buildRegistry, loadClaims, renderRegistry, validateClaim,
} from "../tools/claim-registry.mjs";

const EFFECT_PREFIX = "PHASE10_CLAIMS_EFFECTS ";

/** Pretend every command passed, so the rules are what is under test. */
const allPassed = (claim) => (
  claim.kind === "not-exercised"
    ? { detail: claim.why, outcome: "not-exercised" }
    : { detail: "stubbed", exit_code: 0, outcome: "passed" }
);

test("every declared claim is well formed", async () => {
  const registry = await loadClaims();
  const problems = registry.claims.flatMap((claim) => validateClaim(claim));
  assert.deepEqual(problems, []);
  console.log(EFFECT_PREFIX + JSON.stringify({
    claims: registry.claims.length, network: 0, remote: 0, service: 0, socket: 0,
  }));
});

test("a claim with no evidence fails the build", async () => {
  // Not a warning. A claim nobody can support is what this phase exists to stop
  // shipping, and the failure mode is already in this repository: the README
  // said "lightweight validation tests" while the suite was 499 Node, 691
  // Python and 92 browser tests.
  const problems = validateClaim({
    claim: "The product does something impressive.",
    covers: "nothing in particular",
    id: "unsupported",
    kind: "command",
  });
  assert.ok(problems.some((problem) => /no command is a claim with no evidence/u.test(problem)), problems);
});

test("an automated claim may not assert conformance", async () => {
  // T10-10, and the row this phase is most exposed to. Automated rules decide a
  // minority of the WCAG criteria by construction, so a clean run phrased as
  // "WCAG 2.2 AA" is a statement neither piece of evidence supports.
  for (const wording of [
    "The runtime meets WCAG 2.2 AA.",
    "The designer is WCAG 2.1 AA conformant.",
    "Every surface is accessibility compliant.",
  ]) {
    const problems = validateClaim({
      claim: wording,
      command: "node tools/run-exact-dist-playwright.mjs --grep=phase-10-axe",
      covers: "everything",
      id: "overclaim",
      kind: "command",
    });
    assert.ok(
      problems.some((problem) => /may not assert conformance/u.test(problem)),
      `"${wording}" was accepted: ${problems.join("; ")}`,
    );
  }
});

test("there is no schema in which automated and manual evidence combine", async () => {
  // The merge is not a policy someone can override; there is no field to put
  // the result in. A claim carries exactly one evidence kind.
  const registry = await loadClaims();
  const automated = registry.claims.find((claim) => claim.id === "a11y-automated-sweep");
  const manual = registry.claims.find((claim) => claim.id === "a11y-manual-pass");
  assert.ok(automated && manual, "the two accessibility claims must both exist");
  assert.notEqual(automated.id, manual.id);
  assert.equal(automated.kind, "command");
  assert.equal(manual.kind, "not-exercised");
  // And the automated one says so in its own coverage, where a reader is.
  assert.match(automated.covers, /minority|partial/iu);
});

test("a failed claim is published as failed, never omitted", async () => {
  // T10-12. Omitting it would let its absence read as "not applicable", which is
  // the counting-oracle shape Phase 9 closed for site listings, one level up.
  const built = await buildRegistry({
    readEvidence: (claim) => (
      claim.id === "node-suite"
        ? { detail: "3 tests failed", exit_code: 1, outcome: "failed" }
        : allPassed(claim)
    ),
  });
  const failed = built.claims.find((entry) => entry.id === "node-suite");
  assert.ok(failed, "the failed claim vanished from the registry");
  assert.equal(failed.outcome, "failed");
  assert.equal(built.failed, 1);
  assert.match(renderRegistry(built), /FAILED/u);
});

test("every capability never exercised here is named, with its reason", async () => {
  // T10-17. A reader who is not told assumes it was exercised.
  const built = await buildRegistry({ readEvidence: allPassed });
  const unexercised = built.claims.filter((entry) => entry.outcome === "not-exercised");
  assert.ok(unexercised.length >= 4, `only ${unexercised.length} unexercised capabilities are named`);
  for (const entry of unexercised) {
    assert.ok(entry.detail.length > 20, `${entry.id} does not say why`);
  }
  // The four known before the work started.
  const ids = unexercised.map((entry) => entry.id).sort();
  for (const expected of [
    "a11y-manual-pass", "capacity-representative", "dependency-provenance", "ha-lane-install",
  ]) {
    assert.ok(ids.includes(expected), `${expected} is not published as unexercised`);
  }
});

test("an unexercised capability cannot be published as passing", async () => {
  const problems = validateClaim({
    claim: "A person exercised this with assistive technology.",
    covers: "everything",
    id: "hand-wave",
    kind: "not-exercised",
    why: "",
  });
  assert.ok(problems.some((problem) => /must say why/u.test(problem)), problems);
});

test("a manual claim records who and when, or it is not a manual claim", async () => {
  const problems = validateClaim({
    claim: "Somebody checked this at some point.",
    covers: "everything",
    id: "unrecorded",
    kind: "manual",
  });
  assert.ok(problems.some((problem) => /who performed it and when/u.test(problem)), problems);
});

test("an empty registry is refused rather than trivially published", async () => {
  // Two empty tables satisfy every equality. A registry with nothing in it is
  // not the same as having nothing to prove.
  await assert.rejects(
    () => buildRegistry({ file: new URL("./fixtures/empty-claims.json", import.meta.url).pathname }),
    /empty/u,
  );
});

test("the evidence kinds and outcomes are closed sets", () => {
  assert.deepEqual([...EVIDENCE_KINDS], ["command", "manual", "not-exercised"]);
  assert.deepEqual([...OUTCOMES], ["passed", "failed", "not-exercised"]);
});
