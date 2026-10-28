import assert from "node:assert/strict";
import * as confirmToken from "../lib/mcp/confirm-token.ts";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { executeTool, oauthMetadata, principal, ToolFailure } from "../lib/mcp/read-tools.ts";
import { decodeAssetCursor, encodeAssetCursor } from "../lib/mcp/asset-cursor.ts";

process.env.SUPABASE_SERVICE_ROLE_KEY = "demo-local-fixture-signing-key";
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function load(file, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error, Buffer, Response, require: name => {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  }, console });
  return exports;
}
class DemoLibraryError extends Error { constructor(code, message) { super(message); this.code = code; } }
const row = n => ({ id: id(n), user_id: "owner-a", project_id: "test-project-001", title: "Tour",
  status: "ready", duration_seconds: 12, width: 720, height: 1280, created_at: "2026-10-11T00:00:00Z",
  updated_at: "2026-10-11T00:00:00Z", source_s3_key: `media/owner-a/video/${id(n)}.mp4`,
  source_video_url: "https://cdn.example.test/tour.mp4", draft_json: { private: "draft" }, deleted_at: null });

function harness(options = {}) {
  const calls = [], tools = new Map(), rows = [row(1), row(2), row(3)];
  const toolModule = load("lib/mcp/demo-tools.ts", {
    "server-only": {}, "zod": { z }, "./confirm-token": confirmToken, "@modelcontextprotocol/server": { requireScopes: (...scopes) => scopes },
    "./read-tools": { executeTool, oauthMetadata, principal, ToolFailure }, "./asset-cursor": { decodeAssetCursor, encodeAssetCursor },
    "@/lib/demo/demo-storage": { findDemoVideo: async input => {
      calls.push(["find", input]); return input.userId === "owner-a" && input.projectId === "test-project-001" && input.demoId === id(1) ? rows[0] : null;
    } },
    "@/lib/media/media-storage": { getMediaAssetForOwner: async input => {
      calls.push(["asset", input]); return options.noAsset ? null : { id: id(1), status: "ready", collection: "video",
        source_type: "demo_upload", project_id: "test-project-001", source_record_id: id(1), storage_key: rows[0].source_s3_key, ...options.asset };
    } },
    "@/lib/demo/demo-library": { DemoLibraryError,
      registerDemoForOwner: async input => { calls.push(["register", input]); if (options.outage) throw new Error("private-database-secret");
        return { demo_id: input.assetId, asset_id: input.assetId, project_id: input.projectId }; },
      deleteDemoForOwner: async input => { calls.push(["delete", input]); if (options.conflict) throw new DemoLibraryError("DEMO_CONFLICT", "Conflicting Demo record."); },
      listDemosForOwner: async input => { calls.push(["list", input]); return rows.slice(0, input.limit + 1); },
    },
  });
  toolModule.registerDemoMcpTools({ registerTool(name, config, callback) { tools.set(name, { config, callback }); } });
  async function call(name, input = {}, owner = "owner-a", scopes = ["assets:read", "assets:write"]) {
    const tool = tools.get(name);
    const invoke = async (next) => tool.callback(tool.config.inputSchema.parse(next), { http: { authInfo: { scopes, extra: { firebaseUid: owner } } } });
    let result = await invoke(input);
    const preview = result.structuredContent;
    if (!result.isError && preview?.confirmation_required === true && typeof preview.confirm_token === "string") {
      result = await invoke({ ...input, confirm_token: preview.confirm_token });
    }
    if (!result.isError) tool.config.outputSchema.parse(result.structuredContent);
    return result;
  }
  return { tools, calls, call };
}
const code = result => JSON.parse(result.content[0].text).code;
test("Demo tools enforce scopes before owner services and reject caller-supplied identity", async () => {
  for (const [name, input, scope] of [["register_demo", { asset_id: id(1) }, "assets:write"],
    ["delete_demo", { demo_id: id(1) }, "assets:write"], ["get_demo", { demo_id: id(1) }, "assets:read"], ["list_demos", {}, "assets:read"]]) {
    const h = harness();
    assert.equal(code(await h.call(name, input, "owner-a", [])), "INSUFFICIENT_SCOPE"); assert.deepEqual(h.calls, []);
    assert.deepEqual(h.tools.get(name).config.scopeChallenge, [scope]);
    assert.equal(h.tools.get(name).config.inputSchema.safeParse({ ...input, user_id: "owner-b" }).success, false);
  }
});
test("registration uses trusted owner and default application project, and database failures do not leak", async () => {
  const h = harness();
  const result = (await h.call("register_demo", { asset_id: id(1) })).structuredContent;
  assert.equal(result.asset_id, id(1));
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][1])), { userId: "owner-a", assetId: id(1), projectId: "test-project-001" });
  const failed = await harness({ outage: true }).call("register_demo", { asset_id: id(1) });
  assert.equal(code(failed), "DEMOS_UNAVAILABLE"); assert.doesNotMatch(JSON.stringify(failed), /private-database-secret/);
});
test("Demo pagination signs cursors bound to owner and project and excludes private fields", async () => {
  const h = harness(), result = (await h.call("list_demos", { limit: 1 })).structuredContent;
  assert.equal(result.items.length, 1); assert.ok(result.next_cursor);
  assert.doesNotMatch(JSON.stringify(result), /storage_key|source_s3_key|draft_json|source_video_url|owner-a/);
  await h.call("list_demos", { limit: 1, cursor: result.next_cursor });
  assert.equal(h.calls[1][1].after.id, id(1));
  for (const [owner, project] of [["owner-b", "test-project-001"], ["owner-a", "another-project"]]) {
    const count = h.calls.length;
    assert.equal(code(await h.call("list_demos", { cursor: result.next_cursor, project_id: project }, owner)), "INVALID_CURSOR");
    assert.equal(h.calls.length, count);
  }
});
test("Demo reads require owned records and only return a ready matching source asset", async () => {
  assert.equal((await harness().call("get_demo", { demo_id: id(1) })).structuredContent.asset_id, id(1));
  assert.equal(code(await harness().call("get_demo", { demo_id: id(1) }, "owner-b")), "NOT_FOUND");
  for (const options of [{ noAsset: true }, { asset: { status: "uploading" } }, { asset: { storage_key: "different-key" } },
    { asset: { source_record_id: id(2) } }, { asset: { project_id: "other-project" } }]) {
    assert.equal((await harness(options).call("get_demo", { demo_id: id(1) })).structuredContent.asset_id, null);
  }
});
test("deletion reports conflicts and has explicit write/idempotency annotations", async () => {
  const h = harness();
  assert.equal((await h.call("delete_demo", { demo_id: id(1) })).structuredContent.deleted, true);
  assert.equal(h.tools.get("delete_demo").config.annotations.idempotentHint, true);
  assert.equal(h.tools.get("delete_demo").config.annotations.destructiveHint, true);
  assert.equal(code(await harness({ conflict: true }).call("delete_demo", { demo_id: id(1) })), "DEMO_CONFLICT");
});

function deleteRoute(options = {}) {
  const calls = [], demo = row(1);
  const legacyKey = `demos/raw/owner-a/test-project-001/${id(1)}.mp4`;
  if (options.legacy) demo.source_s3_key = legacyKey;
  const upload = load("lib/demo/demo-upload.ts", { "@/lib/storage/storage": { buildPublicStorageUrl: key => `https://cdn.example.test/${key}` } });
  const toolModule = load("app/api/demo/delete/route.ts", {
    "@/lib/demo/demo-api": {
      authenticateDemoRequest: async () => ({ ok: true, user: { uid: "owner-a" } }),
      getStorageDiagnostic: () => "fixture", getDemoId: value => value, getProjectId: value => value ?? "test-project-001",
      getMissingDemoRuntimeEnvVars: () => [], getString: value => typeof value === "string" ? value : "",
      isDemoStorageNotFoundError: () => false, jsonResponse: (body, status = 200) => Response.json(body, { status }),
      readJsonBody: request => request.json(),
    },
    "@/lib/demo/demo-storage": { getDemoVideo: async input => { calls.push(["get", input]); return demo; },
      softDeleteDemoVideo: async input => { calls.push(["legacy-delete", input]); } },
    "@/lib/demo/demo-library": { isRegisteredMcpDemoForOwner: async input => {
      calls.push(["registered", input]); return !options.legacy;
    }, deleteDemoForOwner: async input => { calls.push(["delete", input]); } },
    "@/lib/demo/demo-upload": upload,
    "@/lib/storage/storage": { deleteStorageObject: async input => { calls.push(["storage-delete", input]); } },
  });
  return { calls, run: key => toolModule.DELETE(new Request("https://www.getugcpilot.com/api/demo/delete", {
    method: "DELETE", body: JSON.stringify({ demoId: id(1), projectId: "test-project-001", key }),
  })) };
}
test("website deletion accepts registered generic keys, retains bytes, and rejects a substituted key", async () => {
  const h = deleteRoute(), result = await h.run(row(1).source_s3_key);
  assert.equal(result.status, 200); assert.equal((await result.json()).storageDeleted, false);
  assert.equal(h.calls.some(([name]) => name === "delete"), true);
  assert.equal(h.calls.some(([name]) => name === "legacy-delete" || name === "storage-delete"), false);
  assert.equal(h.calls.find(([name]) => name === "registered")[1].userId, "owner-a");
  const mismatch = deleteRoute();
  assert.equal((await mismatch.run("foreign-key")).status, 409);
  assert.equal(mismatch.calls.some(([name]) => name === "delete"), false);
});
test("legacy website Demo deletion still validates the raw key and follows its existing path", async () => {
  const h = deleteRoute({ legacy: true });
  assert.equal((await h.run(`demos/raw/owner-a/test-project-001/${id(1)}.mp4`)).status, 200);
  assert.equal(h.calls.some(([name]) => name === "legacy-delete"), true);
  assert.equal(h.calls.some(([name]) => name === "storage-delete"), true);
  const mismatch = deleteRoute({ legacy: true });
  assert.equal((await mismatch.run("foreign-key")).status, 400);
  assert.equal(mismatch.calls.some(([name]) => name === "legacy-delete"), false);
});
