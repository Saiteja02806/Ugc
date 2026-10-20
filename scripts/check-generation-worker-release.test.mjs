import assert from "node:assert/strict";
import test from "node:test";
import { assertGenerationWorkerRelease } from "./check-generation-worker-release.mjs";

const sha = "a".repeat(40);
const service = { status: { traffic: [{ revisionName: "worker-new", percent: 100 }] } };
const version = { ok: true, release: { buildGitCommit: sha, runtimeGitCommit: sha, verified: true } };
test("release acceptance requires the reviewed worker image and all production traffic", () => {
  assert.deepEqual(assertGenerationWorkerRelease(service, version, sha), { passed: true, revision: "worker-new", workerCommit: sha });
  for (const release of [undefined, { ...version.release, buildGitCommit: "b".repeat(40) },
    { ...version.release, runtimeGitCommit: "b".repeat(40) }, { ...version.release, verified: false }]) {
    assert.throws(() => assertGenerationWorkerRelease(service, { ...version, release }, sha), /stale/);
  }
  assert.throws(() => assertGenerationWorkerRelease({ status: { traffic: [
    { revisionName: "worker-new", percent: 90 }, { revisionName: "worker-old", percent: 10 },
  ] } }, version, sha), /one verified/);
  assert.throws(() => assertGenerationWorkerRelease(service, version, "main"), /exact/);
});
