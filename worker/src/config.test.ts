import assert from "node:assert/strict";
import test from "node:test";

import { loadWorkerConfig } from "./config.js";

const BUILD_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

test("verifies a production worker when its configured and baked SHAs match", () => {
  withProductionWorkerEnvironment(
    {
      WORKER_BUILD_GIT_COMMIT: BUILD_SHA,
      WORKER_GIT_COMMIT: BUILD_SHA,
    },
    () => {
      const config = loadWorkerConfig();

      assert.equal(config.workerBuildGitCommit, BUILD_SHA);
      assert.equal(config.workerGitCommit, BUILD_SHA);
      assert.equal(config.workerReleaseVerified, true);
    },
  );
});

test("rejects a production worker whose Terraform SHA does not match its image", () => {
  withProductionWorkerEnvironment(
    {
      WORKER_BUILD_GIT_COMMIT: BUILD_SHA,
      WORKER_GIT_COMMIT: OTHER_SHA,
    },
    () => {
      assert.throws(
        () => loadWorkerConfig(),
        /does not match the Git SHA baked into this worker image/,
      );
    },
  );
});

test("rejects a newly built production image that has no baked release SHA", () => {
  withProductionWorkerEnvironment(
    {
      WORKER_BUILD_GIT_COMMIT: "missing",
      WORKER_GIT_COMMIT: BUILD_SHA,
    },
    () => {
      assert.throws(
        () => loadWorkerConfig(),
        /WORKER_BUILD_GIT_COMMIT must contain a Git SHA/,
      );
    },
  );
});

test("keeps legacy images runnable until they are rebuilt with release metadata", () => {
  withProductionWorkerEnvironment(
    {
      WORKER_BUILD_GIT_COMMIT: undefined,
      WORKER_GIT_COMMIT: "unknown",
    },
    () => {
      const config = loadWorkerConfig();

      assert.equal(config.workerBuildGitCommit, null);
      assert.equal(config.workerReleaseVerified, false);
    },
  );
});

function withProductionWorkerEnvironment(
  overrides: Record<string, string | undefined>,
  run: () => void,
) {
  const names = [
    "NODE_ENV",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL",
    "WORKER_BUILD_GIT_COMMIT",
    "WORKER_GIT_COMMIT",
    "WORKER_ID",
    "WORKER_JOB_TYPES",
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));

  Object.assign(process.env, {
    NODE_ENV: "production",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    SUPABASE_URL: "https://example.supabase.co",
    WORKER_ID: "test-worker",
    WORKER_JOB_TYPES: "test_worker_job",
  });

  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  try {
    run();
  } finally {
    for (const name of names) {
      const value = previous.get(name);

      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}
