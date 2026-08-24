import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getAIStudioAccessMessage } from "./access-policy.ts";

test("distinguishes access-check failures from a locked account", () => {
  assert.match(getAIStudioAccessMessage("error") ?? "", /could not be verified/i);
  assert.match(
    getAIStudioAccessMessage("locked") ?? "",
    /active Starter or Growth/i,
  );
  assert.equal(getAIStudioAccessMessage("pro"), null);
});

test("production access and billing have no email allowlist bypass", () => {
  for (const path of [
    "access-policy.ts",
    "server-access.ts",
    "image-generation-api.ts",
    "video-generation-api.ts",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /AI_STUDIO_ALLOWED_EMAILS|BillingExempt|AllowedEmails/);
  }
});
