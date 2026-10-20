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

function gcloud(args) {
  // Token output remains in memory; never emit command stdout on errors.
  // Every CLI argument below is a fixed literal; expectedSha never enters a shell.
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
