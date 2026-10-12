import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual workspace mapper, rather than a copy of its status logic.
const source = readFileSync(new URL("../../components/scheduling/scheduling-workspace.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["getDraftStatusFromScheduledPost", "getString", "hasPlannedFinalScheduleMetadata"]);
const functions = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => node.getText(parsed)).join("\n");
assert.equal(parsed.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).length, 3);
const context = vm.createContext({});
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

test("published, partial, pending and failure outcomes keep their existing meaning", () => {
  for (const status of ["published", "partially_failed", "scheduled", "publishing", "failed", "draft"]) {
    assert.equal(context.getDraftStatusFromScheduledPost({status, metadata: {}}), status);
  }
  assert.equal(context.getDraftStatusFromScheduledPost({status:"draft", metadata:{combinedRenderStatus:"queued"}}), "rendering");
  assert.equal(context.getDraftStatusFromScheduledPost({status:"draft", metadata:{combinedRenderStatus:"failed"}}), "render_failed");
});
