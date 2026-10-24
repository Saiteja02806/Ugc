import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

// Invoke actual compiled route handlers with no credentials or network access.
// This does not claim production Proxy/hostname or hosted integration acceptance.
process.env.NODE_ENV = "production";
process.env.MCP_PUBLIC_URL = "https://mcp.example.test/mcp";
let accountRequests = 0;
globalThis.fetch = async () => { accountRequests++; throw new Error("Compiled rejection checks cannot access the network"); };
const require = createRequire(import.meta.url);
const route = require("../.next/server/app/mcp/route.js").routeModule.userland;
const statuses = {};
for (const method of ["GET", "POST", "DELETE"]) {
  const result = await route[method](new Request(process.env.MCP_PUBLIC_URL, { method }));
  assert.equal(result.status, 401);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.match(result.headers.get("www-authenticate"), /^Bearer resource_metadata=/);
  assert.match(result.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  assert.equal((await result.json()).error, "invalid_token");
  statuses[method] = result.status;
}
const origin = await route.POST(new Request(process.env.MCP_PUBLIC_URL, {
  method: "POST", headers: { origin: "https://wrong.example.test" },
}));
assert.equal(origin.status, 403); assert.equal((await origin.json()).error, "invalid_origin");
const host = await route.POST(new Request("https://wrong.example.test/mcp", { method: "POST" }));
assert.equal(host.status, 421); assert.equal((await host.json()).error, "invalid_resource_host");
assert.equal(accountRequests, 0);
const loadedCatalogueChunks = Object.keys(require.cache).filter(file =>
  file.replaceAll("\\", "/").includes("/.next/server/chunks/") &&
  readFileSync(file, "utf8").includes("Identify the connected UGC Pilot account."));
assert.deepEqual(loadedCatalogueChunks, [], "Rejected requests must not load the compiled read-tool catalogue chunk");
console.log(JSON.stringify({ statuses, invalidOrigin: origin.status, invalidHost: host.status, accountRequests, loadedCatalogueChunks: loadedCatalogueChunks.length, mode: "direct compiled route handlers; no Proxy or hosted acceptance" }, null, 2));
