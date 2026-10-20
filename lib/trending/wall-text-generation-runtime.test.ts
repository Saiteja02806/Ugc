import assert from "node:assert/strict";
import test from "node:test";

import {
  WallTextGenerationConfigurationError,
  getMissingWallTextGenerationRuntimeEnvVars,
} from "./wall-text-generation-runtime.ts";

test("Wall plan and writer admission require the AI-generation queue before work is reserved", () => {
  let requestedJobTypes: string[] = [];
  const missing = getMissingWallTextGenerationRuntimeEnvVars({
    getMissingBackgroundJobStorageEnvVars: () => [],
    getMissingJobQueueEnvVars: (jobTypes) => {
      requestedJobTypes = [...jobTypes];
      return ["GCP_AI_GENERATION_TASK_URL or GCP_BACKGROUND_JOB_TASK_URL"];
    },
  });

  assert.deepEqual(requestedJobTypes, [
    "wall_text_content_plan_generation",
    "wall_text_generation",
  ]);
  assert.deepEqual(missing, [
    "GCP_AI_GENERATION_TASK_URL or GCP_BACKGROUND_JOB_TASK_URL",
  ]);
});

test("Wall queue configuration errors preserve the exact missing configuration", () => {
  const missing = ["GCP_AI_GENERATION_TASK_URL or GCP_BACKGROUND_JOB_TASK_URL"];
  const error = new WallTextGenerationConfigurationError(missing);

  assert.equal(error.name, "WallTextGenerationConfigurationError");
  assert.deepEqual(error.missingEnvVars, missing);
  assert.match(error.message, /GCP_AI_GENERATION_TASK_URL/);
});
