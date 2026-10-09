import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";
import ts from "typescript";

const assignmentId = "10000000-0000-4000-8000-000000000001";
const creativeId = "20000000-0000-4000-8000-000000000002";
const owner = "preview-owner";
let state = "active", signedIn = true, rowOwner = owner, rowCreative = creativeId;
const queries = [], calls = [];
const source = readFileSync(new URL("./wall-text-db.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("db.ts", source, ts.ScriptTarget.Latest, true);
const names = ["getEditableWallTextDraft", "getWallTextPreviewDraft", "loadWallTextAssignmentDraft"];
const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
const code = ts.transpileModule(declarations.map(node => node.getText(ast).replace(/^export /, "")).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const client = { from(table) {
  assert.equal(table, "user_wall_text_assignments");
  const filters = [];
  return {
    select() { return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    in(key, values) { filters.push([key, values]); return this; },
    async maybeSingle() {
      queries.push(filters);
      const row = { id: assignmentId, wall_text_creative_id: rowCreative, user_id: rowOwner, state };
      return { data: filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : value === row[key]) ? row : null, error: null };
    },
  };
} };
const draftQueries = new Function("getClient", "hydrateSavedWallTextDrafts", `${code}\nreturn { ${names.join(", ")} };`)(
  () => client, async rows => rows.map(row => ({ assignmentId: row.id, id: row.wall_text_creative_id })),
);
const scope = { assignmentId, creativeId, userId: owner };
class AuthError extends Error { status = 401; }
class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
const content = { format: "wall_text", content: { fullText: "This earlier post still has its text." },
  layout: { textBox: { x: .1, y: .1, width: .8, height: .3 }, placement: "upper-middle",
    safeArea: { top: .08, bottom: .08, left: .04, right: .04 } }, textColor: "#ffffff" };
async function loadRecord(params, editable) {
  assert.deepEqual(params, editable ? { ...scope, format: "wall_text" } : scope);
  const draft = await (editable ? draftQueries.getEditableWallTextDraft : draftQueries.getWallTextPreviewDraft)(scope);
  if (!draft) throw new AccessError("Unavailable", 404);
  return { content, revision: 2 };
}
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError: AuthError,
  requireFirebaseUser: async () => { if (!signedIn) throw new AuthError("Signed out"); return { uid: owner }; },
} });
mock.module("./creative-edits.ts", { namedExports: { TrendingCreativeEditAccessError: AccessError } });
mock.module("./creative-edit-service.ts", { namedExports: {
  loadTrendingCreativeEditor: async params => { calls.push("edit"); return loadRecord(params, true); },
  loadTrendingWallTextPreview: async params => { calls.push("view"); return loadRecord(params, false); },
} });
mock.module("./wall-text-overlay-storage.ts", { namedExports: {
  ensureStoredWallTextOverlay: async (userId, input) => {
    assert.equal(userId, owner); assert.equal(input.text.fullText, content.content.fullText);
    calls.push("overlay"); return { asset: { sha256: "verified-hash", inputHash: "input-hash" }, png: Buffer.from("verified-image") };
  },
} });
const { GET, POST } = await import("../../app/api/trending/creatives/wall_text/[creativeId]/overlay/route.ts");
const context = { params: Promise.resolve({ creativeId }) };
const request = (revision = 2, method = "GET") => new Request(
  `https://www.getugcpilot.com/api/trending/creatives/wall_text/${creativeId}/overlay?assignmentId=${assignmentId}&revision=${revision}`,
  { method, ...(method === "POST" ? { body: "{}" } : {}) },
);
const quiet = async callback => { const logger = mock.method(console, "error", () => {}); try { await callback(); } finally { logger.mock.restore(); } };

for (const initialState of ["active", "selected", "completed_skipped"]) {
  test(`saved overlay remains readable for the exact owned ${initialState} assignment`, async () => {
    state = initialState; queries.length = 0; calls.length = 0;
    const response = await GET(request(), context);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "verified-image");
    assert.equal(response.headers.get("X-Overlay-Sha256"), "verified-hash");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(calls, ["view", "overlay"]);
    assert.deepEqual(queries[0], [["id", assignmentId], ["wall_text_creative_id", creativeId], ["user_id", owner],
      ["state", ["active", "selected", "completed_skipped"]]]);
    assert.equal(state, initialState, "Preview must not change a review decision");
  });
}
test("skipped posts remain unavailable to editor drafts and saves", async () => {
  state = "completed_skipped"; calls.length = 0;
  assert.equal(await draftQueries.getEditableWallTextDraft(scope), null);
  await quiet(async () => assert.equal((await POST(request(2, "POST"), context)).status, 404));
  assert.deepEqual(calls, ["edit"]);
});
test("foreign owners, mismatched creatives and unavailable states cannot read the overlay", async () => {
  await quiet(async () => {
    for (const mutation of ["owner", "creative", "state"]) {
      rowOwner = mutation === "owner" ? "foreign-owner" : owner;
      rowCreative = mutation === "creative" ? "foreign-creative" : creativeId;
      state = mutation === "state" ? "deleted" : "completed_skipped";
      calls.length = 0;
      assert.equal((await GET(request(), context)).status, 404);
      assert.deepEqual(calls, ["view"]);
    }
  });
  rowOwner = owner; rowCreative = creativeId; state = "active";
});
test("authentication and exact revision verification still precede image delivery", async () => {
  await quiet(async () => {
    calls.length = 0; signedIn = false;
    assert.equal((await GET(request(), context)).status, 401);
    assert.deepEqual(calls, []);
    signedIn = true;
    assert.equal((await GET(request(1), context)).status, 409);
    assert.deepEqual(calls, ["view"]);
  });
});
