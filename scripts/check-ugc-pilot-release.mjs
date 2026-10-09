import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";

const manifest = JSON.parse(await fs.readFile(new URL("../plugins/ugc-pilot/plugin.json", import.meta.url), "utf8"));
const version = manifest.version;
const website = "https://www.getugcpilot.com";
const mcp = "https://mcp.getugcpilot.com";
const evidence = [];
async function check(name, url, status, options = {}, inspect = async () => {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(25000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    const item = { name, status: response.status, url: response.url, milliseconds: Date.now() - started, bytes: bytes.length,
      request_id: response.headers.get("x-request-id"), cache_control: response.headers.get("cache-control") };
    assert.equal(response.status, status, `${name}: HTTP status`);
    await inspect(response, bytes, item);
    evidence.push({ ...item, passed: true });
  } catch (error) {
    evidence.push({ name, passed: false, error: error.message });
  }
}

await check("setup page", `${website}/connect-ai`, 200, {}, (_, bytes) => {
  const html = bytes.toString();
  assert(html.includes(`/downloads/ugc-pilot-${version}.zip`), "Setup page points to a different package");
  assert(html.includes(`/downloads/ugc-pilot-${version}-setup.md`), "Setup page points to a different guide");
  assert(html.includes(`/downloads/ugc-pilot-${version}.zip.sha256`), "Setup page points to a different checksum");
  assert(html.includes("noindex"), "Private beta setup must remain noindex");
});
for (const current of ["0.1.0", version]) {
  const file = `ugc-pilot-${current}.zip`;
  await check(`archive ${current}`, `${website}/downloads/${file}`, 200, {}, async (_, bytes, item) => {
    const local = await fs.readFile(new URL(`../public/downloads/${file}`, import.meta.url));
    assert(bytes.equals(local), "Production archive differs from reviewed source");
    item.sha256 = createHash("sha256").update(bytes).digest("hex");
  });
  await check(`checksum ${current}`, `${website}/downloads/${file}.sha256`, 200, {}, async (_, bytes) => {
    const local = await fs.readFile(new URL(`../public/downloads/${file}.sha256`, import.meta.url));
    assert(bytes.equals(local), "Production checksum differs from reviewed checksum");
  });
}
await check("setup guide", `${website}/downloads/ugc-pilot-${version}-setup.md`, 200, {}, async (_, bytes) => {
  assert(bytes.equals(await fs.readFile(new URL(`../public/downloads/ugc-pilot-${version}-setup.md`, import.meta.url))), "Production guide differs from reviewed source");
});
for (const path of ["/contact", "/terms"]) await check(path, `${website}${path}`, 200);
await check("AI privacy disclosure", `${website}/privacy`, 200, {}, (_, bytes) => {
  assert(bytes.toString().includes("Connections to AI assistants"), "Missing AI connection disclosure");
});
await check("MCP readiness", `${mcp}/mcp/health`, 200, {}, (_, bytes) => {
  assert.equal(JSON.parse(bytes.toString()).status, "ready");
});
await check("OAuth resource", `${mcp}/.well-known/oauth-protected-resource`, 200, {}, (_, bytes) => {
  const data = JSON.parse(bytes.toString());
  assert.equal(data.resource, `${mcp}/mcp`);
  assert.deepEqual(data.authorization_servers, [mcp]);
});
await check("OAuth issuer", `${mcp}/.well-known/oauth-authorization-server`, 200, {}, (_, bytes) => {
  const data = JSON.parse(bytes.toString());
  assert.equal(data.issuer, mcp);
  assert.equal(data.token_endpoint, `${mcp}/oauth/token`);
  assert(data.code_challenge_methods_supported.includes("S256"));
});
const trace = (response) => {
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/);
};
await check("missing bearer", `${mcp}/mcp`, 401, {}, (response) => {
  trace(response);
  assert(response.headers.get("www-authenticate")?.includes("resource_metadata="));
});
await check("invalid bearer", `${mcp}/mcp`, 401, { headers: { Authorization: "Bearer release-regression-invalid-token" } }, trace);
await check("invalid origin", `${mcp}/mcp`, 403, { headers: { Origin: "https://release-regression.invalid" } }, trace);
await check("website MCP isolation", `${website}/mcp`, 404);
await check("MCP website isolation", `${mcp}/pricing`, 404);
await check("invalid OAuth token request", `${mcp}/oauth/token`, 400, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "" }, (response, bytes) => {
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(JSON.parse(bytes.toString()).error, "invalid_request");
});
const result = { checked_at: new Date().toISOString(), version, passed: evidence.every((item) => item.passed), evidence,
  limitations: ["Does not verify authenticated installed-host behavior, publisher identity, directory approval or intermittent transport reliability."] };
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) {
  assert(process.argv[outputIndex + 1], "Missing --output path");
  await fs.writeFile(process.argv[outputIndex + 1], JSON.stringify(result, null, 2) + "\n");
}
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
