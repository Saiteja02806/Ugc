import assert from "node:assert/strict";
import test from "node:test";
import { applyReviewDecisions, captureAudit, classifyChange } from "./reconciliation-audit.mjs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const state = (base, local, main, integrated = main) => ({ base, local, main, integrated });

test("identical main changes require no duplicate import", () => {
  assert.equal(classifyChange(state("old", "new", "new")), "already-on-main");
});
test("newer main must survive unchanged or reverted local source", () => {
  assert.equal(classifyChange(state("old", "old", "new")), "no-local-change");
});
test("local deletions require confirmation, not automatic propagation", () => {
  assert.equal(classifyChange(state("old", null, "old")), "deletion-needs-confirmation");
});
test("exact integration is distinguished from a manually adapted merge", () => {
  assert.equal(classifyChange(state("old", "local", "main", "local")), "integrated-exactly");
  assert.equal(classifyChange(state("old", "local", "main", "combined")), "adapted-integration-needs-review");
});
test("independent and overlapping additions remain separate", () => {
  assert.equal(classifyChange(state(null, "local", null)), "local-addition");
  assert.equal(classifyChange(state(null, "local", "main")), "overlapping-addition");
});
test("both sides of overlapping edits must be reviewed", () => {
  assert.equal(classifyChange(state("old", "local", "old")), "local-only-change");
  assert.equal(classifyChange(state("old", "local", "main")), "overlapping-change");
});

const sourceHead = "1".repeat(40), mainRevision = "2".repeat(40);
const reviewedRow = { path: "components/example.tsx", local: "3".repeat(40), integrated: "4".repeat(40), decision: "adapted-integration-needs-review" };
const ledger = () => ({ schemaVersion: 1, sourceHead, mainRevision, decisions: [{
  path: reviewedRow.path, local: reviewedRow.local, integrated: reviewedRow.integrated,
  resolution: "adapted", reason: "Preserves local presentation and newer main recovery; scoped checks passed.",
}] });

test("reviewed adaptations stay recorded without hiding the raw comparison", () => {
  const result = applyReviewDecisions([reviewedRow], ledger(), { sourceHead, mainRevision });
  assert.equal(result[0].reviewStatus, "reviewed");
  assert.equal(result[0].decision, "adapted-integration-needs-review");
});

test("a changed source or target reopens a previously reviewed item", () => {
  for (const field of ["local", "integrated"]) {
    const result = applyReviewDecisions([{ ...reviewedRow, [field]: "5".repeat(40) }], ledger(), { sourceHead, mainRevision });
    assert.equal(result[0].reviewStatus, "review-stale");
  }
});

test("ledger rejects wrong baselines, duplicates, unknown paths and invalid decisions", () => {
  const invalidLedgers = [
    { ...ledger(), mainRevision: "6".repeat(40) },
    { ...ledger(), decisions: [...ledger().decisions, ...ledger().decisions] },
    { ...ledger(), decisions: [{ ...ledger().decisions[0], path: "../other-file" }] },
    { ...ledger(), decisions: [{ ...ledger().decisions[0], resolution: "auto-approved" }] },
    { ...ledger(), decisions: [{ ...ledger().decisions[0], reason: "" }] },
  ];
  for (const invalid of invalidLedgers) assert.throws(() => applyReviewDecisions([reviewedRow], invalid, { sourceHead, mainRevision }));
  assert.equal(applyReviewDecisions([reviewedRow], undefined, { sourceHead, mainRevision })[0].reviewStatus, "unreviewed");
});

test("release commits remain auditable against the pinned main baseline", () => {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "ugc-reconciliation-test-"));
  const source = path.join(fixtureRoot, "source"), target = path.join(fixtureRoot, "target");
  const run = (root, args) => execFileSync("git", ["-c", `safe.directory=${root}`, "-c", "user.name=Reconciliation fixture", "-c", "user.email=fixture@example.invalid", ...args], { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  try {
    mkdirSync(source);
    run(source, ["init"]);
    writeFileSync(path.join(source, "example.txt"), "baseline\n");
    run(source, ["add", "example.txt"]);
    run(source, ["commit", "-m", "fixture baseline"]);
    const baseRevision = run(source, ["rev-parse", "HEAD"]);
    run(source, ["clone", "--local", source, target]);
    writeFileSync(path.join(source, "example.txt"), "local change\n");
    writeFileSync(path.join(target, "example.txt"), "local change\n");
    run(target, ["add", "example.txt"]);
    run(target, ["commit", "-m", "fixture release checkpoint"]);
    writeFileSync(path.join(target, "release-only.txt"), "new implementation\n");
    const audit = captureAudit({ sourceRoot: source, targetRoot: target, baseRevision, mainRevision: baseRevision });
    assert.notEqual(audit.targetHead, baseRevision);
    assert.equal(audit.mainRevision, baseRevision);
    assert.equal(audit.rows[0].decision, "integrated-exactly");
    assert.equal(audit.rows.find((row) => row.path === "release-only.txt").decision, "release-only-addition");
    assert.equal(audit.rows.find((row) => row.path === "release-only.txt").reviewStatus, "unreviewed");
    assert.throws(() => captureAudit({ sourceRoot: source, targetRoot: target, baseRevision: "0".repeat(40), mainRevision: baseRevision }), /revision changed/);
  } finally {
    const resolvedFixture = path.resolve(fixtureRoot);
    assert.equal(path.dirname(resolvedFixture), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolvedFixture).startsWith("ugc-reconciliation-test-"));
    rmSync(resolvedFixture, { recursive: true, force: true });
  }
});
