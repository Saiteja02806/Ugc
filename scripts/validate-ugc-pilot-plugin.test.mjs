import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { validateOpenAiMetadata, validatePackage, validateResourceLinks } from "./validate-ugc-pilot-plugin.mjs";

const original = JSON.parse(fs.readFileSync(new URL("../plugins/ugc-pilot/plugin.json", import.meta.url), "utf8"));
const tools = new Set(["get_profile", "get_entitlements", "get_capabilities", "list_assets", "get_asset", "generate_image", "generate_video", "get_job"]);
const altered = (mutate) => {
  const plugin = structuredClone(original);
  mutate(plugin.extensions["com.openai"]);
  return plugin;
};

test("the full bundle passes while reporting the missing review recording", () => {
  const result = validatePackage();
  assert.equal(result.version, "0.1.2");
  assert.equal(result.skillCount, 8);
  assert.deepEqual(result.reviewReadiness, { submissionMaterialsComplete: false, pending: ["review.demo_recording_url"] });
});

test("references must exist inside the allowlisted package, including supporting Markdown", () => {
  const relative = "skills/emotion-hook-director/references/performance-guide.md";
  validateResourceLinks("[shared](../../../references/creative-workflow.md#context)", relative);
  for (const text of ["[missing](absent.md)", "`references/absent.md`", "[escape](../../../../../../.env.local)", "[local](file:///secret.txt)"]) {
    assert.throws(() => validateResourceLinks(text, relative), /Missing packaged reference|Escaping reference|Unsupported reference/);
  }
});

test("submission fails until a recording is supplied", () => {
  assert.throws(() => validateOpenAiMetadata(original, tools, { submission: true }), /demo_recording_url/);
  const plugin = altered((extension) => { extension.review.demo_recording_url = "https://getugcpilot.com/review/walkthrough"; });
  assert.equal(validateOpenAiMetadata(plugin, tools, { submission: true }).submissionMaterialsComplete, true);
});

test("review links must be present, HTTPS and credential-free", () => {
  for (const field of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    for (const value of [undefined, "http://getugcpilot.com", "https://password:secret@getugcpilot.com"]) {
      assert.throws(() => validateOpenAiMetadata(altered((extension) => { extension.interface[field] = value; }), tools));
    }
  }
});

test("review cases require the supported count, fields and actual tools", () => {
  assert.throws(() => validateOpenAiMetadata(altered((extension) => { extension.review.test_cases.positive.pop(); }), tools), /5 positive/);
  assert.throws(() => validateOpenAiMetadata(altered((extension) => { extension.review.test_cases.negative.pop(); }), tools), /3 negative/);
  assert.throws(() => validateOpenAiMetadata(altered((extension) => { delete extension.review.test_cases.positive[0].expected_behavior; }), tools), /expected_behavior/);
  assert.throws(() => validateOpenAiMetadata(altered((extension) => { extension.review.test_cases.positive[0].tools_triggered = "publish_video"; }), tools), /Unknown review tool/);
});

test("onboarding cannot reference files outside the packaged skills", () => {
  for (const onboarding of ["./../secret/SKILL.md", "./skills/missing/SKILL.md", "./README.md"]) {
    assert.throws(() => validateOpenAiMetadata(altered((extension) => { extension.onboardingSkill = onboarding; }), tools), /onboarding/);
  }
});

test("review credentials are rejected and starter prompts stay installable", () => {
  assert.throws(() => validateOpenAiMetadata(altered((extension) => { extension.review.test_credentials = "test"; }), tools), /secure dashboard/);
  assert.throws(() => validateOpenAiMetadata(altered((extension) => { extension.interface.defaultPrompt.push(extension.interface.defaultPrompt[0]); }), tools), /prompts/);
  assert.throws(() => validateOpenAiMetadata(altered((extension) => { extension.interface.defaultPrompt[0] = "@ugc-pilot make an image"; }), tools), /prompt/);
});
