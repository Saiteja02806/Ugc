import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { buildMcpToolCatalog } from "./mcp-tool-catalog.mjs";
import { parseRegisteredTools } from "./mcp-tool-source.mjs";
import { validatePackage } from "./validate-ugc-pilot-plugin.mjs";

const root = path.resolve(import.meta.dirname, "..");
const temporaryRoots = [];
after(async () => {
  for (const dir of temporaryRoots) {
    assert(dir.startsWith(path.join(root, ".tmp", "catalog-regression-")));
    await rm(dir, { recursive: true, force: true });
  }
});
const registry = "registeredReadMcpTools";
const source = `
  throw new Error("Catalogue generation must never execute this module");
  export const registeredReadMcpTools = ["read_a", "read_b"] as const;
  export function registerReadMcpTools(server) {
    const operations = [{tool:"read_a", description:"First read"}, {tool:"read_b", description:"Second read"}];
    for (const operation of operations) {
      server.registerTool(operation.tool, {description:operation.description, scopeChallenge:requireScopes("assets:read")}, () => fetch("https://should-never-run.test"));
    }
  }
`;

test("the candidate catalogue matches the independent package inventory and committed output", async () => {
  const catalog = await buildMcpToolCatalog();
  assert.equal(catalog.toolCount, validatePackage().toolCount);
  assert.deepEqual(catalog, JSON.parse(await readFile(path.join(root, "lib/marketing/mcp-tool-catalog.json"), "utf8")));
  const tools = new Map(catalog.groups.flatMap(group => group.tools.map(tool => [tool.name, tool])));
  assert.match(tools.get("apply_business_context").description, /first call without confirm_token/);
  assert.doesNotMatch(tools.get("save_business_context_draft").description, /first call without confirm_token/);
  assert.match(tools.get("create_schedule").scope, /publishing:write/);
  assert.match(tools.get("delete_asset_group").description, /first call without confirm_token/);
  assert.doesNotMatch(tools.get("create_asset_group").description, /first call without confirm_token/);
});

test("source-only inspection supports a different count and never executes implementations", () => {
  const result = parseRegisteredTools(source, "fixture.ts", registry);
  assert.deepEqual(result.names, ["read_a", "read_b"]);
  assert.equal(result.tools.get("read_b").description, "Second read");
});

test("duplicate names and registration/list mismatches fail closed", () => {
  assert.throws(() => parseRegisteredTools(source.replace('["read_a", "read_b"]', '["read_a", "read_a"]'), "fixture.ts", registry), /Duplicate registry/);
  assert.throws(() => parseRegisteredTools(source.replace('{tool:"read_b", description:"Second read"}', '{tool:"read_a", description:"Second read"}'), "fixture.ts", registry), /Duplicate MCP registration/);
  assert.throws(() => parseRegisteredTools(source.replace('["read_a", "read_b"]', '["read_a", "read_b", "missing"]'), "fixture.ts", registry), /registrations differ/);
});

test("unknown descriptions or missing scopes are rejected rather than borrowed from the next tool", () => {
  assert.throws(() => parseRegisteredTools(source.replace('description:operation.description', 'description:loadDescription()'), "fixture.ts", registry), /Non-static or empty description/);
  assert.throws(() => parseRegisteredTools(source.replace('scopeChallenge:requireScopes("assets:read")', 'scopeChallenge:undefined'), "fixture.ts", registry), /Missing static OAuth scope/);
});

async function fixture() {
  await mkdir(path.join(root, ".tmp"), { recursive: true });
  const dir = await mkdtemp(path.join(root, ".tmp/catalog-regression-"));
  temporaryRoots.push(dir);
  for (const sub of ["lib/mcp", "lib/marketing", "scripts"]) await mkdir(path.join(dir, sub), { recursive: true });
  for (const file of ["mcp-tool-catalog.mjs", "mcp-tool-source.mjs"]) await cp(path.join(root, "scripts", file), path.join(dir, "scripts", file));
  await writeFile(path.join(dir, "lib/mcp/server.ts"), 'import { registeredReadMcpTools } from "./read-tools"; export const registeredMcpTools = [...registeredReadMcpTools];');
  await writeFile(path.join(dir, "lib/mcp/read-tools.ts"), source);
  return dir;
}

test("CLI detects stale output, writes an arbitrary registry count, and then checks cleanly", async () => {
  const dir = await fixture();
  await writeFile(path.join(dir, "lib/marketing/mcp-tool-catalog.json"), "{}");
  const run = option => spawnSync(process.execPath, ["scripts/mcp-tool-catalog.mjs", option], { cwd: dir, encoding: "utf8" });
  const stale = run("--check");
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /is stale/);
  const written = run("--write");
  assert.equal(written.status, 0, written.stderr);
  assert.equal(JSON.parse(await readFile(path.join(dir, "lib/marketing/mcp-tool-catalog.json"))).toolCount, 2);
  const checked = run("--check");
  assert.equal(checked.status, 0, checked.stderr);
  const output = path.join(dir, "lib/marketing/mcp-tool-catalog.json");
  await writeFile(output, (await readFile(output, "utf8")).replace(/\n/g, "\r\n"));
  const windowsCheckout = run("--check");
  assert.equal(windowsCheckout.status, 0, windowsCheckout.stderr);
});

test("new groups require reviewed metadata and cyclic source re-exports fail clearly", async () => {
  const dir = await fixture();
  const file = path.join(dir, "lib/mcp/server.ts");
  const original = await readFile(file, "utf8");
  await writeFile(file, original.replaceAll(registry, "registeredUnknownMcpTools"));
  await assert.rejects(buildMcpToolCatalog(dir), /Missing group metadata/);
  await writeFile(file, original);
  await writeFile(path.join(dir, "lib/mcp/read-tools.ts"), 'export { registeredReadMcpTools } from "./read-tools";');
  await assert.rejects(buildMcpToolCatalog(dir), /Cyclic tool registry/);
});
