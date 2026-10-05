import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { parseCharacterHistoryCursor, CharacterHistoryCursorError } from "./history.ts";

const owner = "history-owner";
let calls, rows, assets, databaseError, authError;
process.env.SUPABASE_URL = "https://history-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
mock.module("../jobs/background-jobs.ts", { namedExports: { getBackgroundJobForUser: async () => null } });
mock.module("../media/media-storage.ts", { namedExports: { getMediaAssetForOwner: async () => null } });
mock.module("../storage/storage.ts", { namedExports: { isTrustedStorageUrl: (url) => url.startsWith("https://media.example.com/") } });
mock.module("../supabase/gateway-retry-fetch.ts", { namedExports: { gatewayRetryFetch: (...args) => fetch(...args) } });
class FirebaseAuthRequestError extends Error { constructor(message, status) { super(message); this.status = status; } }
mock.module("../firebase/server-auth.ts", { namedExports: {
  FirebaseAuthRequestError, requireFirebaseUser: async () => { if (authError) throw authError; return { uid: owner }; },
} });
const { listCharacterHistoryForUser } = await import("./identity.ts");
const { GET } = await import("../../app/api/characters/history/route.ts");
function fixture(index = 1) {
  const id = `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`;
  const assetId = `${String(index).padStart(8, "0")}-2222-4222-8222-222222222222`;
  const generationId = `generation-${index}`;
  const url = `https://media.example.com/characters/${index}.png`;
  const storageKey = `images/generated/${owner}/${generationId}.png`;
  const createdAt = "2026-10-05T12:00:00.123456+00:00";
  return { row: { id, user_id: owner, job_type: "generate_image", status: "completed", created_at: createdAt,
    input_json: { characterSource: "ugc-pilot-characters", characterVersion: 2, prompt: `Presenter ${index}`,
      promptSource: "user", mode: "custom", model: "gpt_image", generationId, candidateIndex: 1,
      businessProfileId: null, businessProfileVersion: null },
    output_json: { url, key: storageKey, model: "gpt_image", generationId }, output_reference: `generationId:${generationId}` },
    asset: { id: assetId, user_id: owner, source_record_id: id, source_type: "generated_image", status: "ready",
      deleted_at: null, collection: "image", mime_type: "image/png", storage_key: storageKey,
      url, created_at: createdAt, metadata: {} } };
}
beforeEach(() => {
  calls = []; databaseError = false; authError = null;
  const f = fixture(); rows = [f.row]; assets = [f.asset];
  mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.href);
    calls.push({ url, init });
    if (databaseError) return Response.json({ message: "private database failure" }, { status: 500 });
    if (url.pathname.endsWith("background_jobs")) {
      assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
      assert.equal(url.searchParams.get("job_type"), "eq.generate_image");
      assert.equal(url.searchParams.get("status"), "eq.completed");
      assert.equal(url.searchParams.get("input_json"), 'cs.{"characterSource":"ugc-pilot-characters"}');
      assert.equal(url.searchParams.get("order"), "created_at.desc,id.desc");
      let result = rows;
      const or = url.searchParams.get("or");
      if (or) {
        const id = or.match(/id\.lt\.([a-f\d-]+)/)[1];
        result = result.filter((row) => row.id < id);
      }
      return Response.json(result.slice(0, Number(url.searchParams.get("limit"))));
    }
    assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
    assert.equal(url.searchParams.get("deleted_at"), "is.null");
    assert.equal(url.searchParams.get("collection"), "in.(image,influencer)");
    assert.equal(url.searchParams.get("status"), "eq.ready");
    assert.equal(url.searchParams.get("source_type"), "eq.generated_image");
    return Response.json(assets);
  });
});
afterEach(() => mock.restoreAll());

test("history lists stored unselected and saved images with owned, bounded bulk queries", async () => {
  const second = fixture(2);
  second.asset.collection = "influencer";
  second.asset.metadata = { characterIdentity: { source: "ugc-pilot-characters", version: 1, jobId: second.row.id, selectedAt: "2026-10-05T13:00:00Z" } };
  rows.unshift(second.row); assets.push(second.asset);
  const page = await listCharacterHistoryForUser(owner, null);
  assert.equal(page.images.length, 2);
  assert.equal(page.images[0].saved, true);
  assert.equal(page.images[1].saved, false);
  assert.equal(page.nextCursor, null);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.searchParams.get("limit"), "26");
});

test("keyset pages do not repeat images when a batch shares one timestamp", async () => {
  const fixtures = Array.from({ length: 29 }, (_, i) => fixture(29 - i));
  rows = fixtures.map((f) => f.row); assets = fixtures.map((f) => f.asset);
  const first = await listCharacterHistoryForUser(owner, null);
  assert.equal(first.images.length, 25);
  assert.equal(parseCharacterHistoryCursor(first.nextCursor).createdAt, rows[24].created_at);
  const second = await listCharacterHistoryForUser(owner, first.nextCursor);
  assert.equal(second.images.length, 4);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.images, ...second.images].map((image) => image.jobId)).size, 29);
});

test("foreign assets, mismatched outputs and untrusted image hosts cannot enter history", async () => {
  for (const change of [{ user_id: "foreign-owner" }, { deleted_at: "2026-10-05T13:00:00Z" },
    { url: "https://attacker.example.com/image.png" }, { source_record_id: fixture(2).row.id }, { status: "uploading" }]) {
    assets = [{ ...fixture().asset, ...change }];
    assert.deepEqual((await listCharacterHistoryForUser(owner, null)).images, []);
  }
});

test("malformed or filter-injecting history cursors fail before contacting storage", async () => {
  for (const value of ["", "not-json", JSON.stringify({ createdAt: "2026-10-05T12:00:00Z),user_id.eq.other", id: rows[0].id }),
    JSON.stringify({ createdAt: rows[0].created_at, id: rows[0].id, userId: "foreign-owner" })]) {
    await assert.rejects(listCharacterHistoryForUser(owner, value), CharacterHistoryCursorError);
  }
  assert.equal(calls.length, 0);
});

test("history route uses verified owner and ignores supplied owner IDs", async () => {
  const response = await GET(new Request("https://www.getugcpilot.com/api/characters/history?userId=foreign-owner"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).images[0].prompt, "Presenter 1");
});

test("history route requires verified sign-in and keeps database diagnostics private", async () => {
  for (const status of [401, 403]) {
    authError = new FirebaseAuthRequestError("Sign in or verify your email.", status);
    assert.equal((await GET(new Request("https://www.getugcpilot.com/api/characters/history"))).status, status);
  }
  assert.equal(calls.length, 0);
  authError = null; databaseError = true;
  mock.method(console, "error", () => {});
  const failed = await GET(new Request("https://www.getugcpilot.com/api/characters/history"));
  assert.equal(failed.status, 500);
  assert.equal(JSON.stringify(await failed.json()).includes("private"), false);
  const invalid = await GET(new Request("https://www.getugcpilot.com/api/characters/history?cursor=invalid"));
  assert.equal(invalid.status, 400);
});
