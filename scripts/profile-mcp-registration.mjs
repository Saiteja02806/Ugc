import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import * as sdk from "@modelcontextprotocol/server";

// No account data, network, auth-cache or mutation: exercise the installed SDK
// and actual static registrars, measuring per-request factory CPU separately.
globalThis.fetch = async () => { throw new Error("Profiling must not access the network"); };
const serverFile = new URL("../lib/mcp/server.ts", import.meta.url);
const source = readFileSync(serverFile, "utf8");
const imports = { "server-only": {} };
let factoryCpu = 0;
let factoryCount = 0;
imports["@modelcontextprotocol/server"] = { ...sdk, createMcpHandler(factory, options) {
  return sdk.createMcpHandler(context => {
    const started = process.cpuUsage();
    try { return factory(context); } finally {
      const used = process.cpuUsage(started); factoryCpu += used.user + used.system; factoryCount++;
    }
  }, options);
} };
for (const match of source.matchAll(/from ["'](\.\/[^"']+)["']/g)) {
  imports[match[1]] = await import(new URL(`${match[1]}.ts`, serverFile));
}
let registrationComparison;
if (process.env.MCP_PROFILE_READ_TOOLS_BASELINE) {
  const baseline = readFileSync(process.env.MCP_PROFILE_READ_TOOLS_BASELINE, "utf8");
  const baselineImports = { "server-only": {} };
  const originalFile = new URL("../lib/mcp/read-tools.ts", import.meta.url);
  for (const match of baseline.matchAll(/from ["']([^"']+)["']/g)) {
    baselineImports[match[1]] = match[1].startsWith(".")
      ? await import(new URL(`${match[1]}.ts`, originalFile)) : await import(match[1]);
  }
  const baselineExports = {};
  vm.runInNewContext(ts.transpileModule(baseline, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports: baselineExports, process, require: name => baselineImports[name] });
  const optimized = imports["./read-tools"];
  const sink = { registerTool() {} };
  const compare = register => {
    const started = process.cpuUsage();
    for (let i = 0; i < 500; i++) register(sink);
    const used = process.cpuUsage(started);
    return (used.user + used.system) / 1000;
  };
  // Both versions run in this process; reverse order to expose JIT/GC noise.
  registrationComparison = [0, 1, 2, 3].map(round => {
    const order = round % 2 ? ["optimized", "baseline"] : ["baseline", "optimized"];
    const result = {};
    for (const name of order) result[name] = compare(name === "baseline" ? baselineExports.registerReadMcpTools : optimized.registerReadMcpTools);
    return result;
  });
  imports["./read-tools"] = baselineExports;
}
const exported = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: exported, require(name) { if (!(name in imports)) throw new Error(name); return imports[name]; }, console });
const handler = exported.mcpHandler;
const iterations = Number(process.env.MCP_PROFILE_ITERATIONS || 30);
const samples = [];
let catalogueHash;
try {
  for (let n = 0; n < iterations + 5; n++) {
    const cpuStart = process.cpuUsage(); const started = performance.now(); const factoryBefore = factoryCpu;
    const response = await handler.fetch(new Request("https://mcp.example.test/mcp", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json,text/event-stream", "MCP-Protocol-Version": "2025-11-25" },
      body: JSON.stringify({ jsonrpc: "2.0", id: n + 1, method: "tools/list", params: {} }),
    }), { authInfo: { token: "local-profile", clientId: "local-profile", scopes: ["account:read"], extra: { firebaseUid: "local-profile" } } });
    const text = await response.text();
    if (!response.ok || !text.includes('"tools"')) throw new Error(`Unexpected profile response ${response.status} ${text.slice(0, 200)}`);
    const json = text.startsWith("data:") || text.startsWith("event:")
      ? JSON.parse(text.split(/\r?\n/).find(line => line.startsWith("data: ")).slice(6)) : JSON.parse(text);
    catalogueHash = createHash("sha256").update(JSON.stringify(json.result.tools)).digest("hex");
    const cpu = process.cpuUsage(cpuStart);
    if (n >= 5) samples.push({ wallMs: performance.now() - started, cpuMs: (cpu.user + cpu.system) / 1000, factoryCpuMs: (factoryCpu - factoryBefore) / 1000, bytes: Buffer.byteLength(text) });
  }
  const average = key => samples.reduce((total, sample) => total + sample[key], 0) / samples.length;
  console.log(JSON.stringify({ iterations, warmup: 5, tools: exported.registeredMcpTools.length, factories: factoryCount, averageWallMs: average("wallMs"), averageCpuMs: average("cpuMs"), averageFactoryCpuMs: average("factoryCpuMs"), responseBytes: samples[0].bytes, catalogueHash, registrationComparison500Iterations: registrationComparison }, null, 2));
} finally { await handler.close(); }
