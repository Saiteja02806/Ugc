import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual workspace mapper, rather than a copy of its status logic.
const source = readFileSync(new URL("../../components/scheduling/scheduling-workspace.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["getDraftStatusFromScheduledPost", "getString", "hasPlannedFinalScheduleMetadata", "getTargetStatusHelpText"]);
const functions = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => node.getText(parsed)).join("\n");
assert.equal(parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).length, names.size);
const context = vm.createContext({ formatShortDateTime: value => value });
vm.runInContext(ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);

test("cancellation wins over stale Wall and combined render metadata", () => {
  for (const renderStatus of ["queued", "rendering", "not_requested", "failed", "ready"]) {
    for (const wall of [true, false]) {
      const metadata = wall
        ? {wallTextAssignmentId: "wall", wallTextRenderStatus: renderStatus, finalScheduleStatus: "failed"}
        : {combinedRenderStatus: renderStatus, finalScheduleStatus: "scheduling"};
      assert.equal(context.getDraftStatusFromScheduledPost({status: "cancelled", metadata}), "cancelled");
      assert.equal(context.getDraftStatusFromScheduledPost({status: "cancelled", metadata}, "demo"), "cancelled");
    }
  }
});

test("retry help distinguishes upcoming from overdue times and never promises a retry for failed posts", () => {
  assert.equal(context.getTargetStatusHelpText({ status: "publishing", nextRetryAt: "2099-10-17T05:46:00Z" }, "Asia/Calcutta"), "Retry scheduled for 2099-10-17T05:46:00Z.");
  assert.equal(context.getTargetStatusHelpText({ status: "publishing", nextRetryAt: "2000-10-17T05:46:00Z" }, "Asia/Calcutta"), "Retry pending since 2000-10-17T05:46:00Z.");
  assert.equal(context.getTargetStatusHelpText({ status: "failed", nextRetryAt: "2000-10-17T05:46:00Z" }, "Asia/Calcutta"), "Publishing did not complete for this account.");
  assert.equal(context.getTargetStatusHelpText({ status: "publishing", nextRetryAt: null }, "Asia/Calcutta"), "The worker is publishing this post now.");
});

test("published, partial, pending and failure outcomes keep their existing meaning", () => {
  for (const status of ["published", "partially_failed", "scheduled", "publishing", "failed", "draft"]) {
    assert.equal(context.getDraftStatusFromScheduledPost({status, metadata: {}}), status);
  }
  assert.equal(context.getDraftStatusFromScheduledPost({status:"draft", metadata:{combinedRenderStatus:"queued"}}), "rendering");
  assert.equal(context.getDraftStatusFromScheduledPost({status:"draft", metadata:{combinedRenderStatus:"failed"}}), "render_failed");
});
