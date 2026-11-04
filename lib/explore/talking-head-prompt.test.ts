import assert from "node:assert/strict";
import test from "node:test";
import { buildTalkingHeadPromptExport } from "./talking-head-prompt.ts";
import { readTalkingHeadScriptDraft } from "./talking-head-script-draft.ts";

const input = { script: "Here is the complete hook. Let me show you.", sourceReviewed: true, sceneDirections: "A fixed close shot with soft window light.", selectionSha256: "a".repeat(64), hookEndMs: 5000 };
test("copyable prompt binds complete dialogue and scene without inventing action timestamps", () => {
  const output = buildTalkingHeadPromptExport(input);
  assert.ok(output.text.includes(input.sceneDirections));
  assert.equal(output.text.split(JSON.stringify(input.script)).length - 1, 1);
  assert.match(output.text, /actual first frame at t=0/u);
  assert.match(output.text, /Never read scene directions aloud/u);
  assert.match(output.text, /no app demonstration or demo cutaway/u);
  assert.equal(output.durationSeconds, 5);
  assert.throws(() => buildTalkingHeadPromptExport({ ...input, sourceReviewed: false }), /Review/u);
  assert.throws(() => buildTalkingHeadPromptExport({ ...input, sceneDirections: "" }), /source/u);
  assert.throws(() => buildTalkingHeadPromptExport({ ...input, selectionSha256: "wrong" }), /source/u);
});
test("long hook is preserved beyond single-clip limits and large edited prompts recover safely", () => {
  const script = "A complete sentence without truncation. ".repeat(100);
  const output = buildTalkingHeadPromptExport({ ...input, script, hookEndMs: 45000 });
  assert.ok(output.durationSeconds > 15); assert.ok(output.text.includes(JSON.stringify(script.trim())));
  const raw = JSON.stringify({ version: 1, script, reviewed: true, reviewedSelectionSha256: input.selectionSha256, pending: null, videoPrompt: { ...output, text: "Edited prompt.\n".repeat(1000) } });
  assert.ok(raw.length > 16000);
  assert.equal(readTalkingHeadScriptDraft(raw, "talking-test", "b".repeat(64))?.videoPrompt?.script, script);
});
