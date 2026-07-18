import assert from "node:assert/strict";
import test from "node:test";

import { getSocialSchedulerProviderName } from "./social-scheduler-config.ts";

test("keeps AWS as the default social scheduler provider", () => {
  assert.equal(getSocialSchedulerProviderName({}), "aws");
});

test("supports GCP Cloud Tasks aliases", () => {
  assert.equal(
    getSocialSchedulerProviderName({ SOCIAL_SCHEDULER_PROVIDER: "gcp" }),
    "gcp",
  );
  assert.equal(
    getSocialSchedulerProviderName({
      SOCIAL_SCHEDULER_PROVIDER: "cloud-tasks",
    }),
    "gcp",
  );
});

test("rejects invalid social scheduler providers", () => {
  assert.throws(
    () =>
      getSocialSchedulerProviderName({
        SOCIAL_SCHEDULER_PROVIDER: "trigger.dev",
      }),
    /Invalid SOCIAL_SCHEDULER_PROVIDER/,
  );
});
