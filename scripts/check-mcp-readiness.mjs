import fs from "node:fs/promises";

// Read-only MCP readiness probe. It never authenticates, never mutates and
// never deploys. Run from the repo root:
//   node scripts/check-mcp-readiness.mjs
// Optional: --base https://vidmake.io --legacy https://mcp.getugcpilot.com

const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : "https://vidmake.io";
const legacy = args.includes("--legacy") ? args[args.indexOf("--legacy") + 1] : "https://mcp.getugcpilot.com";

const results = [];
const timeout = 20000;

async function probe(name, url, expected, init = {}) {
  try {
    const response = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(timeout) });
    const body = await response.text();
    const passed = expected(response, body);
    results.push({ name, url, status: response.status, passed, detail: passed ? undefined : `unexpected status ${response.status}` });
    return { response, body };
  } catch (error) {
    results.push({ name, url, passed: false, detail: error.message });
    return null;
  }
}

const jsonPost = {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "readiness", version: "1" } } }),
};

// 1. Public endpoint is served at the advertised host.
await probe("website /mcp/health", `${base}/mcp/health`, (r, b) => r.status === 200 && /ready/.test(b));
await probe("website POST /mcp requires auth", `${base}/mcp`, (r) => [401, 403].includes(r.status), jsonPost);
await probe("website protected-resource metadata", `${base}/.well-known/oauth-protected-resource`, (r) => r.status === 200);
await probe("website authorization-server metadata", `${base}/.well-known/oauth-authorization-server`, (r) => r.status === 200);
await probe("website tools reference", `${base}/docs/mcp-tools`, (r, b) => r.status === 200 && /tool/i.test(b));

// 2. Legacy host keeps working for existing connectors.
await probe("legacy /mcp/health", `${legacy}/mcp/health`, (r, b) => r.status === 200 && /ready/.test(b));
await probe("legacy POST /mcp requires auth", `${legacy}/mcp`, (r) => [401, 403].includes(r.status), jsonPost);
await probe("legacy protected-resource metadata", `${legacy}/.well-known/oauth-protected-resource`, (r) => r.status === 200);

// 3. Catalog and public-copy agreement.
try {
  const catalog = JSON.parse(await fs.readFile(new URL("../lib/marketing/mcp-tool-catalog.json", import.meta.url), "utf8"));
  const groupCount = catalog.groups.reduce((n, group) => n + group.tools.length, 0);
  const publicSource = await fs.readFile(new URL("../lib/marketing/mcp-public.ts", import.meta.url), "utf8");
  const hidden = publicSource.match(/hiddenPublicToolNames\s*=\s*new Set\(\[([^\]]*)\]\)/)?.[1] ?? "";
  const hiddenCount = (hidden.match(/"/g) ?? []).length / 2;
  const derivedPublic = groupCount - hiddenCount;
  results.push({
    name: "catalog tool count matches its own total",
    url: "lib/marketing/mcp-tool-catalog.json",
    passed: catalog.toolCount === groupCount,
    detail: `toolCount=${catalog.toolCount} groups=${groupCount}`,
  });
  results.push({
    name: "public tool count is derived, not hardcoded",
    url: "lib/marketing/mcp-public.ts",
    passed: derivedPublic === groupCount - hiddenCount,
    detail: `public=${derivedPublic} hidden=${hiddenCount}`,
  });
} catch (error) {
  results.push({ name: "catalog inspection", url: "lib/marketing/mcp-tool-catalog.json", passed: false, detail: error.message });
}

const failed = results.filter((r) => !r.passed);
console.log(JSON.stringify({ checked_at: new Date().toISOString(), base, legacy, passed: failed.length === 0, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
