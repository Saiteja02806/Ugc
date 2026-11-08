import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../components/scheduling/scheduling-workspace.tsx", import.meta.url),
  "utf8",
);
const ast = ts.createSourceFile(
  "scheduling-workspace.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const findFunction = (name) => {
  let found;
  const visit = (node) => {
    if (!found && ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(ast);
  return found;
};
const text = (name) => {
  const node = findFunction(name);
  assert.ok(node, `${name} must exist`);
  return node.getText(ast);
};

test("a failed cancel keeps the dialog open, shows the reason there and refreshes the truthful status", () => {
  const handler = text("handleConfirmScheduleCancellation");
  const catchBlock = handler.slice(handler.indexOf("} catch (error) {"));
  assert.match(handler, /method: "DELETE"/);
  assert.match(
    handler,
    /signal: AbortSignal\.timeout\(20_000\)/,
    "A stalled cancel request must be bounded",
  );
  assert.match(catchBlock, /setCancelScheduleError\(message\)/);
  assert.doesNotMatch(
    catchBlock,
    /setSchedulePendingCancellation\(null\)/,
    "A refusal must not close the dialog before the user reads the reason",
  );
  assert.match(
    catchBlock,
    /loadSchedules\(\{ force: true \}\)/,
    "The card must refresh to publishing/published/cancelled instead of staying stale",
  );
  assert.doesNotMatch(
    catchBlock,
    /setActionNotice\(/,
    "The reason belongs next to the acted-on card, not only under the page header",
  );
});

test("the cancel dialog renders the failure inline and explains a passed scheduled time", () => {
  const dialog = text("CancelScheduleDialog");
  assert.match(dialog, /error: string \| null/);
  assert.match(dialog, /role="alert"/);
  assert.match(dialog, /\{error\}/);
  assert.match(dialog, /hasScheduleTimePassed\(draft\)/);
  const helper = text("hasScheduleTimePassed");
  assert.match(helper, /draft\.plannedScheduledFor/);
  assert.match(helper, /<= Date\.now\(\)/);
});
