import assert from "node:assert/strict";
import test from "node:test";
import { assertGenerationWorkerRelease, assertInternalGenerationWorkerRelease } from "./check-generation-worker-release.mjs";

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

test("internal ingress uses only the ready active revision's verified startup and pinned image", () => {
  const internal = { ...service, metadata: { annotations: { "run.googleapis.com/ingress": "internal" } } };
  const revision = { metadata: { name: "worker-new", creationTimestamp: "2026-10-20T15:00:00Z" },
    status: { imageDigest: `registry/image@sha256:${"f".repeat(64)}`, conditions: [{ type: "Ready", status: "True" }] } };
  const entry = { timestamp: "2026-10-20T15:01:00Z", resource: { type: "cloud_run_revision", labels: {
    service_name: "ugc-ai-generation-worker", revision_name: "worker-new",
  } }, jsonPayload: { message: "UGC worker started", metadata: {
    workerReleaseVerified: true, workerBuildGitCommit: sha, workerGitCommit: sha,
  } } };
  assert.equal(assertInternalGenerationWorkerRelease(internal, revision, [entry], sha).evidence, "verified-startup-log");
  for (const wrong of [
    { ...entry, resource: { ...entry.resource, labels: { ...entry.resource.labels, revision_name: "worker-old" } } },
    { ...entry, timestamp: "2026-10-20T14:00:00Z" },
    { ...entry, jsonPayload: { ...entry.jsonPayload, metadata: { ...entry.jsonPayload.metadata, workerReleaseVerified: false } } },
    { ...entry, jsonPayload: { ...entry.jsonPayload, metadata: { ...entry.jsonPayload.metadata, workerBuildGitCommit: "b".repeat(40) } } },
  ]) assert.throws(() => assertInternalGenerationWorkerRelease(internal, revision, [wrong], sha), /No verified/);
  assert.throws(() => assertInternalGenerationWorkerRelease(service, revision, [entry], sha), /requires/);
  assert.throws(() => assertInternalGenerationWorkerRelease(internal, { ...revision, status: { ...revision.status, imageDigest: "registry/image:latest" } }, [entry], sha), /requires/);
  assert.throws(() => assertInternalGenerationWorkerRelease(internal, { ...revision, status: { ...revision.status, conditions: [] } }, [entry], sha), /requires/);
});
