import assert from "node:assert/strict";
import { after, mock, test } from "node:test";

const envNames = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
process.env.SUPABASE_URL = "https://database.fixture.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-key";
mock.module("@/lib/storage/storage", { namedExports: { buildPublicStorageUrl: key => `https://media.fixture.test/${key}` } });
const requests = [];
let fail = false;
let editRevision = 3, rejectWrite = false;
const writes = [];
mock.method(globalThis, "fetch", async (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url ?? String(input));
  assert.equal(url.hostname, "database.fixture.test", "Test never sends a production request");
  requests.push(url);
  if (fail) return Response.json({ message: "Test database failure" }, { status: 503 });
  const method = options?.method ?? input.method ?? "GET";
  if (method === "PATCH") {
    const body = options?.body ? JSON.parse(options.body) : await input.clone().json();
    writes.push({ url, body });
    return Response.json(rejectWrite ? null : { id: "edit", revision: body.revision });
  }
  return Response.json(url.pathname.endsWith("/media_assets") ? [{ id: "image", user_id: "owner" }] :
    { id: "edit", revision: editRevision, render_status: "rendering", render_error: null, updated_at: "2026-10-11T00:00:00Z" });
});
const { getMediaAssetsForOwnerByIds } = await import("../media/media-storage.ts");
const { getTrendingCarouselEditStatus, upsertTrendingCreativeEdit } = await import("./creative-edits.ts");
after(() => {
  mock.restoreAll();
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

test("Save verifies all distinct slide uploads in one bounded owner/deletion-scoped request", async () => {
  requests.length = 0;
  assert.deepEqual(await getMediaAssetsForOwnerByIds({ assetIds: [], userId: "owner" }), []);
  assert.equal(requests.length, 0);
  await assert.rejects(getMediaAssetsForOwnerByIds({ assetIds: Array.from({ length: 21 }, (_, index) => `image-${index}`), userId: "owner" }), /at most 20/);
  assert.equal(requests.length, 0);
  const result = await getMediaAssetsForOwnerByIds({ assetIds: ["image", "image", "other"], userId: "owner" });
  assert.equal(result.length, 1); assert.equal(requests.length, 1);
  const query = requests[0].searchParams;
  assert.equal(query.get("user_id"), "eq.owner");
  assert.equal(query.get("deleted_at"), "is.null");
  assert.equal(query.get("id"), 'in.(image,other)');
});

test("polling queries only status columns under the owner and carousel creative", async () => {
  requests.length = 0;
  const result = await getTrendingCarouselEditStatus({ userId: "owner", creativeId: "creative" });
  assert.equal(result.render_status, "rendering"); assert.equal(requests.length, 1);
  const query = requests[0].searchParams;
  assert.equal(query.get("user_id"), "eq.owner");
  assert.equal(query.get("format"), "eq.carousel");
  assert.equal(query.get("creative_id"), "eq.creative");
  assert.equal(query.get("select"), "id,revision,render_status,render_error,updated_at");
  assert.ok(!query.get("select").includes("content"));
});

test("database read failures surface without authorizing images or claiming completion", async () => {
  fail = true;
  try {
    await assert.rejects(getMediaAssetsForOwnerByIds({ assetIds: ["image"], userId: "owner" }), /Test database failure/);
    await assert.rejects(getTrendingCarouselEditStatus({ userId: "owner", creativeId: "creative" }), /Test database failure/);
  } finally { fail = false; }
});

const save = () => upsertTrendingCreativeEdit({ assignmentId: "assignment", creativeId: "creative", format: "carousel",
  expectedRevision: 3, content: { format: "carousel", version: "trending-creative-edit-v1", slides: [] }, positions: {}, userId: "owner" });

test("a newer save during image verification cannot be overwritten by the old submitted revision", async () => {
  editRevision = 4; writes.length = 0;
  try {
    await assert.rejects(save(), error => error.status === 409);
    assert.equal(writes.length, 0, "revision conflict must be detected before writing");
  } finally { editRevision = 3; }
});

test("the final write keeps owner and revision predicates and rejects a lost revision race", async () => {
  writes.length = 0;
  assert.equal((await save()).revision, 4);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url.searchParams.get("user_id"), "eq.owner");
  assert.equal(writes[0].url.searchParams.get("revision"), "eq.3");
  assert.equal(writes[0].body.revision, 4);
  rejectWrite = true;
  try { await assert.rejects(save(), error => error.status === 409); }
  finally { rejectWrite = false; }
});
