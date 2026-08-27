import assert from "node:assert/strict";
import test from "node:test";

import { ProviderRequestNotSubmittedError } from "./generation-provider.js";
import { getRequiredProviderEnv } from "./provider-env.js";

test("accepts a single provider key value", () => {
  assert.equal(
    getRequiredProviderEnv("GEMINI_API_KEY", {
      GEMINI_API_KEY: "  single-key-value  ",
    }),
    "single-key-value",
  );
});

test("rejects a provider key containing another dotenv assignment", () => {
  assert.throws(
    () =>
      getRequiredProviderEnv("GEMINI_API_KEY", {
        GEMINI_API_KEY: "gemini-key\nRUNWAYML_API_SECRET=runway-key",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ProviderRequestNotSubmittedError);
      assert.equal(error.retryable, false);
      assert.equal(
        error.message,
        "Invalid GEMINI_API_KEY configuration. Configure one key value only.",
      );
      return true;
    },
  );
});

test("rejects a pasted dotenv assignment even when it is on one line", () => {
  assert.throws(
    () =>
      getRequiredProviderEnv("RUNWAYML_API_SECRET", {
        RUNWAYML_API_SECRET: "RUNWAYML_API_SECRET=runway-key",
      }),
    /Invalid RUNWAYML_API_SECRET configuration/,
  );
});
