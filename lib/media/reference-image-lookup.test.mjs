import assert from "node:assert/strict";
import { after, mock, test } from "node:test";

const originalUrl = process.env.SUPABASE_URL, originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_URL = "https://database.example.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-reference-lookup-key";
const calls = [], rows = [{ url: "https://storage.example.test/owned.png" }];
const query = {
  select: value => { calls.push(["select", value]); return query; },
  eq: (field, value) => { calls.push(["eq", field, value]); return query; },
  in: (field, values) => { calls.push(["in", field, values]); return query; },
  is: (field, value) => { calls.push(["is", field, value]); return Promise.resolve({ data: rows, error: null }); },
};
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => ({
  from: table => { calls.push(["from", table]); return query; },
}) } });
const { getMediaAssetsForOwnerByUrls } = await import("./media-storage.ts");
after(() => {
  if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
});

test("image URL lookup scopes the bounded query to the authenticated owner and excludes deleted rows", async () => {
  assert.deepEqual(await getMediaAssetsForOwnerByUrls({ urls: [rows[0].url, rows[0].url], userId: "owner-a" }), rows);
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "user_id" && call[2] === "owner-a"));
  assert.ok(calls.some(call => call[0] === "is" && call[1] === "deleted_at" && call[2] === null));
  assert.deepEqual(calls.find(call => call[0] === "in"), ["in", "url", [rows[0].url]]);
});

test("empty or excessive image batches do not issue a database query", async () => {
  calls.length = 0;
  assert.deepEqual(await getMediaAssetsForOwnerByUrls({ urls: [], userId: "owner-a" }), []);
  await assert.rejects(getMediaAssetsForOwnerByUrls({ urls: Array.from({ length: 7 }, (_, i) => `${rows[0].url}?${i}`), userId: "owner-a" }), /at most six/);
  assert.equal(calls.length, 0);
});
