import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

// Run in a fresh process. This observes module evaluation, not Vercel download,
// tracing, billed cold-start behavior or authentication-store latency.
globalThis.fetch = async () => { throw new Error("Cold import profiling cannot use the network"); };
const sdkModules = new Set();
const hook = registerHooks({ load(url, context, nextLoad) {
  if (url.includes("@modelcontextprotocol") || url.includes("%40modelcontextprotocol")) sdkModules.add(url);
  return nextLoad(url, context);
} });
const cpuStarted = process.cpuUsage();
const started = performance.now();
const route = await import(process.env.MCP_PROFILE_EAGER_ROUTE
  ? pathToFileURL(process.env.MCP_PROFILE_EAGER_ROUTE).href : new URL("../app/mcp/route.ts", import.meta.url));
const importCpu = process.cpuUsage(cpuStarted);
const importWallMs = performance.now() - started;
const responses = await Promise.all(["GET", "POST", "DELETE"].map(method => route[method](new Request("https://mcp.getugcpilot.com/mcp", { method }))));
assert.deepEqual(responses.map(response => response.status), [401, 401, 401]);
console.log(JSON.stringify({ importWallMs, importCpuMs: (importCpu.user + importCpu.system) / 1000, loadedSdkModules: sdkModules.size, unauthenticatedStatuses: responses.map(response => response.status) }, null, 2));
if (!process.env.MCP_PROFILE_EAGER_ROUTE) assert.equal(sdkModules.size, 0, "Unauthorized requests must not initialize the SDK");
hook.deregister();
