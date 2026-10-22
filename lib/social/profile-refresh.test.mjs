import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { beforeEach, mock, test } from "node:test";

process.env.SUPABASE_URL = "https://fixture.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "fixture-encryption-key-for-tests-only";
process.env.TIKTOK_CLIENT_KEY = "fixture-client";
process.env.TIKTOK_CLIENT_SECRET = "fixture-secret";
function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY).digest(), iv);
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), bytes.toString("base64url")].join(".");
}
let rows, writes, reads, rpcCalls;
const at = "2026-01-01T00:00:00Z";
const row = (platform, owner = "owner") => ({
  id: `${owner}-${platform}`, user_id: owner, platform,
  provider: platform === "instagram" ? "meta" : "tiktok", status: "connected", revoked_at: null,
  connected_at: at, updated_at: at, expires_at: null, refresh_expires_at: null,
  token_refreshed_at: at, refresh_token_ciphertext: encrypt("refresh-token"),
  access_token_ciphertext: encrypt("old-token"), platform_account_id: `${platform}-id`,
  platform_account_name: "Saved name", platform_account_username: null,
  scopes: ["user.info.basic", "video.publish"], last_error_code: null,
  metadata: { authorizationRevision: "consent-1", ...(platform === "instagram" ? { accountType: "BUSINESS", profilePictureUrl: "https://scontent.cdninstagram.com/old.jpg" } : { avatarUrl: "https://p16.tiktokcdn.com/old.jpg" }) },
});
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => ({
  from: () => {
    let filters = [], patch;
    const result = () => {
      assert.ok(filters.some(([key, value]) => key === "user_id" && value === "owner"));
      const matching = rows.filter(row => filters.every(([key, value]) =>
        key === "metadata" ? JSON.stringify(row.metadata) === value : row[key] === value));
      if (patch) { writes.push({ filters, patch }); for (const row of matching) Object.assign(row, patch); }
      return { data: matching.map(row => ({ ...row, metadata: { ...row.metadata } })), error: null };
    };
    const query = {
      select() { return query; }, eq(k, v) { filters.push([k, v]); return query; },
      is(k, v) { filters.push([k, v]); return query; }, filter(k, _op, v) { filters.push([k, v]); return query; },
      order() { return query; }, update(value) { patch = value; return query; },
      maybeSingle: async () => { const value = result(); return { ...value, data: value.data[0] ?? null }; },
      then: resolve => Promise.resolve(result()).then(resolve),
    };
    return query;
  },
  rpc: async (name, args) => {
    rpcCalls.push(name);
    assert.equal(args.p_user_id, "owner");
    const record = rows.find(r => r.id === args.p_connection_id && r.user_id === args.p_user_id);
    if (name === "complete_social_connection_token_refresh") Object.assign(record, {
      access_token_ciphertext: args.p_access_token_ciphertext, refresh_token_ciphertext: args.p_refresh_token_ciphertext,
      expires_at: args.p_expires_at, token_refreshed_at: new Date().toISOString(), scopes: args.p_scopes,
    });
    return { data: record ? [record] : [], error: null };
  },
}) } });
const { getSocialConnectionProfileForOwner, listSocialConnections, refreshSocialConnectionProfilesForOwner } = await import("./oauth.ts");
beforeEach(() => { rows = [row("instagram"), row("tiktok"), row("tiktok", "foreign")]; writes = []; reads = []; rpcCalls = []; });
async function withProvider(run, responder) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    reads.push({ url: String(url), init });
    if (!String(url).includes("oauth/token")) assert.ok(init.signal);
    if (responder) return responder(String(url), init);
    return String(url).includes("tiktok")
      ? Response.json({ data: { user: { open_id: "tiktok-id", display_name: "New TikTok name", avatar_url: "https://p16.tiktokcdn.com/new.jpg" } } })
      : Response.json({ id: "instagram-id", account_type: "BUSINESS", username: "creator", profile_picture_url: "https://scontent.cdninstagram.com/new.jpg" });
  };
  try { await run(); } finally { globalThis.fetch = original; }
}
test("display reads flag old TikTok photos without contacting providers", async () => {
  await withProvider(async () => {
    const accounts = await listSocialConnections("owner");
    assert.equal(accounts.length, 2);
    assert.ok(accounts.every(c => c.profileNeedsRefresh));
    assert.equal(reads.length, 0);
    assert.equal(writes.length, 0);
  });
});
test("background renews both platforms, keeps authorization and excludes other owners", async () => {
  await withProvider(async () => {
    await refreshSocialConnectionProfilesForOwner("owner");
    assert.equal(reads.length, 2);
    assert.equal(writes.length, 2);
    assert.equal(rows[1].metadata.avatarUrl, "https://p16.tiktokcdn.com/new.jpg");
    assert.equal(rows[1].platform_account_name, "New TikTok name");
    assert.equal(rows[1].metadata.authorizationRevision, "consent-1");
    assert.equal(rows[2].metadata.avatarUrl, "https://p16.tiktokcdn.com/old.jpg");
    assert.ok(rows.slice(0, 2).every(r => Date.parse(r.metadata.profilePictureSyncedAt) > Date.now() - 1000));
    await refreshSocialConnectionProfilesForOwner("owner");
    assert.equal(reads.length, 2);
  });
});
test("forced renewal repairs fresh broken URLs but respects provider failure backoff", async () => {
  rows[1].metadata.profilePictureSyncedAt = new Date().toISOString();
  await withProvider(async () => {
    const params = { userId: "owner", connectionId: "owner-tiktok" };
    await getSocialConnectionProfileForOwner(params);
    assert.equal(reads.length, 0);
    const renewed = await getSocialConnectionProfileForOwner({ ...params, force: true });
    assert.equal(renewed.profilePictureUrl, "https://p16.tiktokcdn.com/new.jpg");
    assert.equal(reads.length, 1);
    rows[1].metadata.profileLookupRetryAt = new Date(Date.now() + 60_000).toISOString();
    await getSocialConnectionProfileForOwner({ ...params, force: true });
    assert.equal(reads.length, 1);
  });
});
test("provider failures preserve the last photo and back off forced and background reads", async () => {
  await withProvider(async () => {
    const params = { userId: "owner", connectionId: "owner-tiktok", force: true };
    const picture = await getSocialConnectionProfileForOwner(params);
    assert.equal(picture.profilePictureUrl, "https://p16.tiktokcdn.com/old.jpg");
    assert.equal(picture.profileNeedsRefresh, false);
    await getSocialConnectionProfileForOwner(params);
    assert.equal(reads.length, 1);
    assert.equal(rows[1].status, "connected");
    assert.equal(rows[1].metadata.authorizationRevision, "consent-1");
  }, () => Response.json({ error: { message: "Unavailable" } }, { status: 503 }));
});
test("revoked and foreign connections are not hydrated or exposed", async () => {
  rows[0].revoked_at = at;
  await withProvider(async () => {
    assert.equal(await getSocialConnectionProfileForOwner({ userId: "owner", connectionId: "owner-instagram" }), null);
    assert.equal(await getSocialConnectionProfileForOwner({ userId: "owner", connectionId: "foreign-tiktok" }), null);
    assert.equal(reads.length, 0);
  });
});
test("expired TikTok access refreshes through the existing token lease before profile lookup", async () => {
  rows[1].expires_at = at;
  await withProvider(async () => {
    const picture = await getSocialConnectionProfileForOwner({ userId: "owner", connectionId: "owner-tiktok" });
    assert.equal(picture.profilePictureUrl, "https://p16.tiktokcdn.com/new.jpg");
    assert.deepEqual(rpcCalls, ["claim_social_connection_token_refresh", "complete_social_connection_token_refresh"]);
    assert.ok(writes[0].filters.some(([key, value]) => key === "token_refreshed_at" && value === rows[1].token_refreshed_at));
  }, (url, init) => {
    if (url.includes("oauth/token")) return Response.json({ access_token: "new-token", refresh_token: "new-refresh", expires_in: 86400, refresh_expires_in: 864000, open_id: "tiktok-id", scope: "user.info.basic,video.publish" });
    assert.equal(init.headers.Authorization, "Bearer new-token");
    return Response.json({ data: { user: { open_id: "tiktok-id", avatar_url: "https://p16.tiktokcdn.com/new.jpg" } } });
  });
});

test("a late provider failure cannot overwrite a newer successfully renewed photo", async () => {
  await withProvider(async () => {
    await getSocialConnectionProfileForOwner({ userId: "owner", connectionId: "owner-tiktok" });
    assert.equal(rows[1].metadata.avatarUrl, "https://p16.tiktokcdn.com/concurrent.jpg");
    assert.equal(rows[1].metadata.profileLookupRetryAt, undefined);
    assert.equal(rows[1].metadata.authorizationRevision, "consent-1");
  }, () => {
    rows[1].metadata = { ...rows[1].metadata, avatarUrl: "https://p16.tiktokcdn.com/concurrent.jpg", profilePictureSyncedAt: new Date().toISOString() };
    return Response.json({ error: { message: "Temporary failure" } }, { status: 503 });
  });
});
