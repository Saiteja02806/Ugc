import assert from "node:assert/strict";
import test from "node:test";
import { assertFreeTrialContentAccess } from "./free-trial.ts";
import { getTrendingPlanEntitlement } from "../trending/unified-daily-feed-db.ts";

test("the final trial pack can finish without granting a fourth pack", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://quota-test.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-test";
  const startedAt = new Date(Date.now() - 86_400_000).toISOString();
  let expiresAt = new Date(Date.now() + 86_400_000).toISOString();
  let daysUsed = 3;
  let feedExists = true;
  let lookupFails = false;
  let paid = false;
  let feedLookups = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://quota-test.invalid", "never use production in this test");
    const table = url.pathname.split("/").at(-1);
    const method = init?.method ?? "GET";
    assert.ok(["GET", "HEAD"].includes(method), "checking access must not allocate quota");
    if (table === "billing_subscriptions") return Response.json(paid ? [{ plan_key: "starter" }] : []);
    if (table === "complimentary_plan_grants") return Response.json([]);
    if (table === "subscription_entitlements") return Response.json({ daily_trending_limit: 50 });
    if (table === "free_trial_entitlements") return Response.json({
      started_at: startedAt, expires_at: expiresAt, content_days_limit: 3,
      daily_content_pieces: 20, instagram_schedule_limit: null,
    });
    if (table === "free_trial_instagram_schedule_usage") return new Response(null, { headers: { "content-range": "*/0" } });
    if (table === "daily_trending_feeds" && method === "HEAD") return new Response(null, { headers: { "content-range": `*/${daysUsed}` } });
    if (table === "daily_trending_feeds") {
      feedLookups += 1;
      assert.equal(url.searchParams.get("user_id"), "eq.owner");
      assert.equal(url.searchParams.get("plan_key"), "eq.free");
      assert.deepEqual(url.searchParams.getAll("created_at"), [`gte.${startedAt}`, `lt.${expiresAt}`]);
      if (lookupFails) return Response.json({ message: "database unavailable", code: "test_failure" }, { status: 403 });
      return Response.json(feedExists && url.searchParams.get("id") === "eq.third-pack" ? { daily_limit: 20 } : null);
    }
    throw new Error(`Unexpected table: ${table}`);
  };
  try {
    const entitlement = await getTrendingPlanEntitlement("owner", { existingFeedId: "third-pack" });
    assert.deepEqual(entitlement, { dailyLimit: 20, displayName: "Free", planKey: "free" });
    const resumed = await assertFreeTrialContentAccess("owner", { existingFeedId: "third-pack" });
    assert.equal(resumed.trial.contentDaysRemaining, 0);
    assert.equal(resumed.trial.dailyContentPieces, 20);
    await assert.rejects(getTrendingPlanEntitlement("owner"), { code: "free_trial_content_days_exhausted" });
    await assert.rejects(getTrendingPlanEntitlement("owner", { existingFeedId: "another-users-pack" }), { code: "free_trial_content_days_exhausted" });
    feedExists = false;
    await assert.rejects(getTrendingPlanEntitlement("owner", { existingFeedId: "third-pack" }), { code: "free_trial_content_days_exhausted" });
    feedExists = true;
    lookupFails = true;
    await assert.rejects(getTrendingPlanEntitlement("owner", { existingFeedId: "third-pack" }), /Could not verify the allocated trial pack/);
    lookupFails = false;
    const previousLookups = feedLookups;
    expiresAt = new Date(Date.now() - 1000).toISOString();
    await assert.rejects(getTrendingPlanEntitlement("owner", { existingFeedId: "third-pack" }), { code: "free_trial_content_expired" });
    assert.equal(feedLookups, previousLookups, "expired access does not resume generation");
    expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    daysUsed = 2;
    assert.equal((await getTrendingPlanEntitlement("owner")).dailyLimit, 20);
    paid = true;
    assert.equal((await getTrendingPlanEntitlement("owner")).planKey, "pro");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});
