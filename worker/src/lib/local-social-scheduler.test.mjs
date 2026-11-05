import assert from "node:assert/strict";
import { mock, test } from "node:test";

const processed = [];
mock.module(new URL("../processor.ts", import.meta.url), {
  namedExports: { processRecoveredWorkerJob: async ({ jobId }) => { processed.push(jobId); } },
});
const { processDueLocalSchedules } = await import("./local-social-scheduler.ts");

test("local scheduler delivers only due publish jobs with the tester's exact local target registration", async () => {
  const jobs = {
    local: { user_id: "owner", job_type: "publish_social_post", input_json: { targetId: "target-local" } },
    foreign: { user_id: "other", job_type: "publish_social_post", input_json: { targetId: "target-foreign" } },
    imported: { user_id: "owner", job_type: "publish_social_post", input_json: { targetId: "target-imported" } },
    future: { user_id: "owner", job_type: "publish_social_post", input_json: { targetId: "target-future" } },
  };
  const checked = [];
  const store = {
    listDueSocialPublishJobIds: async () => ["local", "foreign", "imported"],
    getJobById: async id => jobs[id],
    hasLocalPublishSchedule: async input => {
      checked.push(input);
      return input.name === "local-publish-target-local";
    },
  };
  await processDueLocalSchedules({ store, ownerId: "owner", config: { visibilityTimeoutSeconds: 60 }, isStopping: () => false });
  assert.deepEqual(processed, ["local"]);
  assert.deepEqual(checked.map(entry => [entry.ownerId, entry.jobId, entry.targetId]), [
    ["owner", "local", "target-local"],
    ["owner", "imported", "target-imported"],
  ]);
});
