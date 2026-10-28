import assert from "node:assert/strict";
import { mock, test } from "node:test";

const posts = Array.from({ length: 203 }, (_, i) => ({ id: `post-${i}`, user_id: "owner", status: i === 202 ? "scheduled" : "published", scheduled_for: `2030-01-01T00:${String(Math.floor(i / 60)).padStart(2,"0")}:${String(i % 60).padStart(2,"0")}Z`, updated_at: "2030-01-01", metadata: {}, timezone: "UTC" }));
Object.assign(posts[202], { source_kind: "library_item", library_item_id: "carousel-library", metadata: { sourceSurface: "trending", mediaMode: "carousel" } });
posts.push({ ...posts[202], id: "other-owner", user_id: "other" });
const targets = [{ id: "target", scheduled_post_id: "post-202", status: "scheduled", platform: "tiktok", settings: {} }];
let failureAt = null;
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => ({ from(table) {
  let rows = table === "scheduled_posts" ? posts : targets; let start = 0, end = Infinity;
  const builder = {
    select() { return this; }, order() { return this; },
    eq(key, value) { rows = rows.filter(row => row[key] === value); return this; },
    in(key, values) { rows = rows.filter(row => values.includes(row[key])); return this; },
    gte(key, value) { rows = rows.filter(row => row[key] >= value); return this; },
    lte(key, value) { rows = rows.filter(row => row[key] <= value); return this; },
    range(from, to) { start = from; end = to; return this; },
    then(resolve) { return Promise.resolve(resolve(failureAt === start && table === "scheduled_posts" ? { data: null, error: { message: "page failed" } } : { data: rows.slice(start, end + 1), error: null })); },
  }; return builder;
} }) } });
process.env.SUPABASE_URL = "https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
const { listScheduledPostsForUser } = await import("./db.ts");

test("includes scheduled carousel after 200 older posts with its target and excludes other owners", async () => {
  const result = await listScheduledPostsForUser({ userId: "owner" });
  assert.equal(result.length, 203);
  assert.equal(result.at(-1).id, "post-202");
  assert.equal(result.at(-1).sourceKind, "library_item");
  assert.equal(result.at(-1).libraryItemId, "carousel-library");
  assert.equal(result.at(-1).metadata.sourceSurface, "trending");
  assert.equal(result.at(-1).metadata.mediaMode, "carousel");
  assert.equal(result.at(-1).targets[0].id, "target");
  assert.equal(result.at(-1).targets[0].status, "scheduled");
  assert.ok(result.every(post => post.id !== "other-owner"));
  const filtered = await listScheduledPostsForUser({ userId: "owner", status: "scheduled" });
  assert.deepEqual(filtered.map(post => post.id), ["post-202"]);
  const ranged = await listScheduledPostsForUser({ userId: "owner", from: "2030-01-01T00:03:22Z", to: "2030-01-01T00:03:22Z" });
  assert.deepEqual(ranged.map(post => post.id), ["post-202"]);
});

test("later page failure is surfaced instead of returning incomplete schedules", async () => {
  failureAt = 200;
  try { await assert.rejects(listScheduledPostsForUser({ userId: "owner" }), /page failed/); }
  finally { failureAt = null; }
});
