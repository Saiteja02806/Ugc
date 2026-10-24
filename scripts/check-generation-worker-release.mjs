import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function assertGenerationWorkerRelease(service, version, expectedSha) {
  if (!/^[a-f0-9]{40}$/i.test(expectedSha)) throw new Error("Provide the exact 40-character reviewed worker commit.");
  const traffic = (service.status?.traffic ?? []).filter(item => item.percent > 0);
  if (traffic.length !== 1 || traffic[0].percent !== 100 || !traffic[0].revisionName) {
    throw new Error("Generation worker traffic must resolve to one verified production revision.");
  }
  if (version.ok !== true || version.release?.verified !== true ||
      version.release.buildGitCommit !== expectedSha || version.release.runtimeGitCommit !== expectedSha) {
    throw new Error("Generation worker is stale or its baked and runtime source revisions do not match the reviewed commit.");
  }
  return { passed: true, revision: traffic[0].revisionName, workerCommit: expectedSha };
}

export function assertInternalGenerationWorkerRelease(service, revision, entries, expectedSha) {
  const active = (service.status?.traffic ?? []).filter(item => item.percent > 0);
  const name = revision.metadata?.name;
  const ingress = service.metadata?.annotations?.["run.googleapis.com/ingress"];
  const created = Date.parse(revision.metadata?.creationTimestamp ?? "");
  const image = revision.status?.imageDigest ?? revision.spec?.containers?.[0]?.image;
  if (!["internal", "internal-and-cloud-load-balancing"].includes(ingress) ||
      active.length !== 1 || active[0].percent !== 100 || active[0].revisionName !== name ||
      !Number.isFinite(created) || !/@sha256:[a-f0-9]{64}$/i.test(image ?? "") ||
      !revision.status?.conditions?.some(condition => condition.type === "Ready" && condition.status === "True")) {
    throw new Error("Internal worker acceptance requires its ready active revision and pinned image digest.");
  }
  const startup = entries.find(entry =>
    entry.resource?.type === "cloud_run_revision" &&
    entry.resource?.labels?.service_name === "ugc-ai-generation-worker" &&
    entry.resource?.labels?.revision_name === name &&
    Date.parse(entry.timestamp) >= created &&
    entry.jsonPayload?.message === "UGC worker started" &&
    entry.jsonPayload?.metadata?.workerReleaseVerified === true &&
    entry.jsonPayload?.metadata?.workerBuildGitCommit === expectedSha &&
    entry.jsonPayload?.metadata?.workerGitCommit === expectedSha);
  if (!startup) throw new Error("No verified startup identity exists for the active internal worker revision.");
  const metadata = startup.jsonPayload.metadata;
  return { ...assertGenerationWorkerRelease(service, { ok: true, release: {
    verified: metadata.workerReleaseVerified, buildGitCommit: metadata.workerBuildGitCommit,
    runtimeGitCommit: metadata.workerGitCommit,
  } }, expectedSha), evidence: "verified-startup-log", image };
}

function gcloud(args) {
  // Token output remains in memory; never emit command stdout on errors.
  // Dynamic revision names are restricted below; expectedSha never enters a shell.
  const command = process.platform === "win32" ? "cmd.exe" : "gcloud";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", "gcloud.cmd", ...args] : args;
  const result = spawnSync(command, commandArgs, { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Could not read production worker metadata with the configured gcloud account.");
  return result.stdout.trim();
}

async function main() {
  const expectedSha = process.argv[2];
  if (!/^[a-f0-9]{40}$/i.test(expectedSha ?? "")) throw new Error("Usage: node scripts/check-generation-worker-release.mjs <exact-worker-commit>");
  const service = JSON.parse(gcloud(["run", "services", "describe", "ugc-ai-generation-worker", "--project", "ugcsaas", "--region", "us-central1", "--format=json"]));
  const ingress = service.metadata?.annotations?.["run.googleapis.com/ingress"];
  if (["internal", "internal-and-cloud-load-balancing"].includes(ingress)) {
    const active = (service.status?.traffic ?? []).filter(item => item.percent > 0);
    const name = active.length === 1 && active[0].percent === 100 ? active[0].revisionName : "";
    if (!/^ugc-ai-generation-worker-[a-z0-9-]+$/.test(name)) throw new Error("Expected one active generation worker revision.");
    const revision = JSON.parse(gcloud(["run", "revisions", "describe", name, "--project", "ugcsaas", "--region", "us-central1", "--format=json"]));
    const entries = JSON.parse(gcloud(["logging", "read", `resource.labels.revision_name=${name}`, "--project", "ugcsaas", "--limit=100", "--format=json"]));
    console.log(JSON.stringify(assertInternalGenerationWorkerRelease(service, revision, entries, expectedSha), null, 2));
    return;
  }
  const origin = new URL(service.status?.url);
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".run.app") || origin.username || origin.password || origin.port) {
    throw new Error("The production worker must use its configured HTTPS Cloud Run origin.");
  }
  const token = gcloud(["auth", "print-identity-token", "--quiet"]);
  const response = await fetch(new URL("/version", origin), {
    headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Worker version read failed (HTTP ${response.status}); release acceptance is incomplete.`);
  console.log(JSON.stringify(assertGenerationWorkerRelease(service, await response.json(), expectedSha), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
