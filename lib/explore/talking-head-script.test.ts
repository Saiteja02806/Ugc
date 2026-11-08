import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import transcripts from "./talking-head-transcripts.json" with { type: "json" };
import manifest from "./talking-head-source-manifest.json" with { type: "json" };
import { TALKING_HEAD_SCRIPT_MODEL, TALKING_HEAD_SCRIPT_SYSTEM, talkingHeadScriptRemixPayload, validateTalkingHeadScriptOutput } from "./talking-head-script-remix.ts";
import { talkingHeadScriptInputError } from "./talking-head-script-input.ts";
import { buildStartingFrameAnimationPrompt } from "./starting-frame-workflow.ts";
import { createWorkflowSession, parseWorkflowSession } from "./workflow-session.ts";
import { workflowGenerationPrompt } from "./workflow-generation-client.ts";
import { getTalkingHeadScript } from "./talking-head-script-store.ts";

test("all 33 transcripts bind to their exact source versions; hooks exclude reviewed demo openings", () => {
  assert.equal(transcripts.items.length, 33);
  for (const row of transcripts.items) {
    assert.equal(manifest.items.find(source => source.id === row.referenceId)?.sourceSha256, row.sourceSha256);
    assert.ok(row.fullText.trim()); assert.ok(row.hookText.trim());
    assert.equal(row.hookStartMs, 0); assert.ok(row.hookEndMs > 0 && row.hookEndMs <= row.durationMs);
    assert.match(row.transcriptSha256, /^[a-f0-9]{64}$/u);
    assert.equal(row.selectionSha256, createHash("sha256").update(JSON.stringify({ version: 1, sourceSha256: row.sourceSha256, transcriptSha256: row.transcriptSha256, hookText: row.hookText, hookStartMs: 0, hookEndMs: row.hookEndMs })).digest("hex"));
    assert.ok(row.reviewNotes.length > 20);
    assert.ok(row.segments.every(segment => segment.startMs >= 0 && segment.endMs >= segment.startMs && segment.endMs <= row.durationMs + 200));
  }
  const websites = transcripts.items.find(source => source.referenceId === "talking-websites-explainer")!;
  assert.equal(websites.hookEndMs, 2740); assert.doesNotMatch(websites.hookText, /streaming|App Builder/u); assert.match(websites.fullText, /App Builder/u);
  const long = transcripts.items.find(source => source.referenceId === "talking-studywithsab")!;
  assert.ok(long.hookEndMs > 44000); assert.doesNotMatch(long.hookText, /upload all my content/u); assert.match(long.fullText, /upload all my content/u);
  const sawyer = transcripts.items.find(source => source.referenceId === "talking-studywithsawyer")!;
  assert.match(sawyer.hookText, /ChatGPT/u); assert.doesNotMatch(sawyer.hookText, /chatubt/u);
  assert.match(sawyer.fullText, /chatubt/u, "the raw source transcription remains immutable");
  assert.ok(sawyer.corrections.some(note => note.includes("source caption at 4s")));
});
test("silent-mouth references use caption-reviewed manual transcripts, not ASR", () => {
  for (const id of ["talking-kamile-mirror-discovery", "talking-kamile-kitchen-discovery", "talking-kamile-car-what", "talking-kamile-lowlight-what"]) {
    const row = transcripts.items.find(item => item.referenceId === id);
    assert.ok(row, id);
    assert.equal(row.provider, "manual");
    assert.equal(row.model, "on-screen-caption-review");
    assert.equal(row.review, "cross_checked_draft");
    assert.match(row.reviewNotes, /No audible speech/u);
    assert.match(row.reviewNotes, /brand claims/u);
  }
});

test("dedicated medium comparison winner and script prompt preserve spoken roles and grounding", () => {
  assert.equal(TALKING_HEAD_SCRIPT_MODEL, "gpt-6.1-terra");
  assert.match(TALKING_HEAD_SCRIPT_SYSTEM, /spoken dialogue/u); assert.match(TALKING_HEAD_SCRIPT_SYSTEM, /untrusted data/u);
  const body = JSON.parse(talkingHeadScriptRemixPayload("Let me show you.", { businessName: "One" }));
  assert.equal(body.sourceScript, "Let me show you."); assert.equal(body.businessContext.businessName, "One");
  assert.throws(() => validateTalkingHeadScriptOutput({ script: "A generic summary." }, "Let me show you."), /closing/u);
  assert.throws(() => validateTalkingHeadScriptOutput({ script: "extra ".repeat(30) }, "No way!"), /too long/u);
  assert.equal(validateTalkingHeadScriptOutput({ script: "No way!" }, "No way!").script, "No way!");
});
test("spoken script requires Sound and sufficient duration; historical prompts remain untouched", () => {
  assert.equal(talkingHeadScriptInputError(undefined, 3, false), null);
  assert.match(talkingHeadScriptInputError("Hello there", 4, false)!, /Sound on/u);
  assert.match(talkingHeadScriptInputError("word ".repeat(80), 15, true)!, /longer.*shorten/u);
  assert.match(talkingHeadScriptInputError("", 10, true)!, /nonempty/u);
  const input = { workflow: "talking_head" as const, directions: "Keep the camera still.", durationSeconds: 6, generateAudio: true };
  const legacy = buildStartingFrameAnimationPrompt(input);
  const current = buildStartingFrameAnimationPrompt({ ...input, spokenScript: "Ready to practice? Let me show you." });
  assert.doesNotMatch(legacy, /APPROVED SPOKEN SCRIPT/u);
  assert.equal(current.split('"Ready to practice? Let me show you."').length - 1, 1);
  assert.match(current, /never speak scene directions/u);
  assert.throws(() => buildStartingFrameAnimationPrompt({ ...input, workflow: "wall_text", spokenScript: "Hello" }), /Talking Head only/u);
});
test("new script drafts survive session recovery; old drafts keep their original shape", () => {
  const old = parseWorkflowSession(createWorkflowSession("owner"), "owner"); assert.deepEqual(parseWorkflowSession(old, "owner"), old);
  assert.equal(old.talkingHeadScriptMode, undefined);
  const next = { ...old, instructions: "My reviewed words", talkingHeadScriptMode: true, talkingHeadScriptReviewed: true };
  assert.deepEqual(parseWorkflowSession(next, "owner"), next);
  assert.throws(() => parseWorkflowSession({ ...next, talkingHeadScriptMode: "true" }, "owner"));
  assert.throws(() => parseWorkflowSession({ ...next, talkingHeadScriptReviewed: "true" }, "owner"));
  assert.equal(workflowGenerationPrompt({ instructions: "My reviewed words", talkingHeadScript: "My reviewed words", referenceInstructions: "Camera stays still." }), "Camera stays still.");
  assert.match(workflowGenerationPrompt({ instructions: "Old free-text direction", referenceInstructions: "Scene" }), /Your instructions:\nOld free-text direction/u);
});


test("fresh source reads block ambiguous retired transcripts and keep all visible hooks available", () => {
  for (const id of ["talking-outdoor-discovery", "talking-outdoor-reaction"]) assert.throws(() => getTalkingHeadScript(id), /uncertain speech/u);
  for (const row of transcripts.items.filter(row => row.review !== "needs_review")) assert.equal(getTalkingHeadScript(row.referenceId).selectionSha256, row.selectionSha256);
});
