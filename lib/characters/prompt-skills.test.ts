import assert from "node:assert/strict";
import test from "node:test";
import { CharacterGenerateRequestSchema } from "./schema.ts";
import { CHARACTER_PROMPT_SKILLS, characterPromptPresentation, composeCharacterPrompt, resolveCharacterPromptSkills } from "./prompt-skills.ts";

test("skill config merges multiple selected instructions in selection order without changing the draft", () => {
  const second = { id: "lighting-test", name: "Lighting", description: "Test lighting", instruction: "dim the background" };
  const catalog = [...CHARACTER_PROMPT_SKILLS, second];
  const prompt = "  My own portrait prompt  ";
  const skills = resolveCharacterPromptSkills([second.id, catalog[0].id], catalog);
  assert.equal(composeCharacterPrompt(prompt, skills), `My own portrait prompt\n${second.instruction}\n${catalog[0].instruction}`);
  assert.equal(prompt, "  My own portrait prompt  ");
  assert.equal(composeCharacterPrompt(prompt, []), prompt.trim());
});

test("unknown, repeated and over-limit skill requests fail admission, including composed model limits", () => {
  const base = { mode: "custom", prompt: "My portrait", model: "gpt_image", idempotencyKey: "skills" };
  for (const skillIds of [["unknown"], ["realistic-skin", "realistic-skin"]]) {
    assert.equal(CharacterGenerateRequestSchema.safeParse({ ...base, skillIds }).success, false);
  }
  assert.equal(CharacterGenerateRequestSchema.safeParse({ ...base, prompt: "x".repeat(32000), skillIds: ["realistic-skin"] }).success, false);
  assert.equal(CharacterGenerateRequestSchema.safeParse({ ...base, model: "seedream_5_pro", prompt: "x".repeat(3950), skillIds: ["realistic-skin"] }).success, false);
  assert.equal(CharacterGenerateRequestSchema.safeParse({ ...base, model: "seedream_5_pro", prompt: "x".repeat(3950) }).success, true);
});

test("history presentation uses its frozen names and user text without exposing instruction text", () => {
  const snapshot = { characterPromptPresentation: { userPrompt: "My portrait", skills: [{ id: "old", name: "Original label", instruction: "old instruction" }] } };
  assert.deepEqual(characterPromptPresentation(JSON.parse(JSON.stringify(snapshot))), { displayPrompt: "My portrait", skills: [{ id: "old", name: "Original label" }] });
  assert.deepEqual(characterPromptPresentation({ prompt: "Legacy prompt" }), {});
  assert.deepEqual(characterPromptPresentation({ characterPromptPresentation: null }), {});
});
