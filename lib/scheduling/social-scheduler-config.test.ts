import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultGcpSchedulerServiceAccountEmail } from "./gcp-cloud-tasks-scheduler-logic.ts";

test("uses the GCP Cloud Tasks scheduler identity", () => {
  assert.equal(
    getDefaultGcpSchedulerServiceAccountEmail({ projectId: "ugcsaas" }),
    "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com",
  );
});
