import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ONE_TIME_FREE_GENERATION_CREDITS } from "../lib/billing/free-generation-credit-policy.ts";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://local-mcp-test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-secret";
process.env.GCP_STORAGE_BUCKET = "local-mcp-test-bucket";
process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://local-mcp-storage.example.test";

const seenAssetRequests = [];
const fixtureAsset = (id, updatedAt) => ({
  id, user_id: "owner-a", collection: "image", source_type: "upload",
  title: `Asset ${id.slice(0, 8)}`, file_name: "image.png", file_size_bytes: 1024,
  mime_type: "image/png", width: 640, height: 640, duration_seconds: null,
  ratio: "1:1", thumbnail_url: null, url: `https://cdn.example.test/${id}.png`,
  created_at: "2026-09-26T10:00:00.000Z", updated_at: updatedAt,
  deleted_at: null, status: "ready", metadata: {}, parent_asset_id: null,
  project_id: null, source_record_id: null, storage_key: `asset/${id}`,
});
const firstAsset = fixtureAsset("11111111-1111-4111-8111-111111111111", "2026-09-27T10:00:00.000Z");
const secondAsset = fixtureAsset("22222222-2222-4222-8222-222222222222", "2026-09-26T10:00:00.000Z");
const audioAsset = { ...fixtureAsset("55555555-5555-4555-8555-555555555555", "2026-09-28T10:00:00.000Z"), collection: "audio", mime_type: "audio/mpeg" };
const foreignAsset = { ...fixtureAsset("44444444-4444-4444-8444-444444444444", "2026-09-26T09:00:00.000Z"), user_id: "owner-b" };
const deletedAsset = { ...fixtureAsset("55555555-5555-4555-8555-555555555555", "2026-09-26T09:00:00.000Z"), deleted_at: "2026-09-27T00:00:00.000Z" };
const uploadingAsset = { ...fixtureAsset("66666666-6666-4666-8666-666666666666", "2026-09-26T09:00:00.000Z"), status: "uploading" };
let billingMode = "outage";
let brandMode = "missing";
let refreshCalls = 0;
let freeCreditWrites = 0;
let freeCreditMode = "existing";
let assetListUnavailable = false;
let bearerMode = "valid";
let seenBearerHash = null;
const softDeletedIds = new Set();
const confirmedIds = new Set();
const mcpUploadRows = new Map();
let forceConcurrentConfirm = false;
let uploadQuotaExceeded = false;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  if (url.pathname.endsWith("/rest/v1/rpc/ensure_free_generation_credit_balance")) {
    freeCreditWrites += 1;
    return Response.json({ granted: 2, remaining: 2, reserved: 0, used: 0 });
  }
  if (url.pathname.endsWith("/rest/v1/free_generation_credit_balances")) {
    assert.equal(method, "GET", "MCP reads must not create free allowances");
    assert.equal(url.searchParams.get("user_id"), "eq.owner-a");
    if (freeCreditMode === "outage") return Response.json({ message: "local free ledger outage" }, { status: 503 });
    return Response.json(freeCreditMode === "missing" ? null : freeCreditMode === "invalid"
      ? { credit_limit: 2, used_credits: 2, reserved_credits: 1 }
      : { credit_limit: 2, used_credits: 0, reserved_credits: 1 });
  }
  if (url.pathname.endsWith("/rest/v1/mcp_oauth_tokens")) {
    seenBearerHash = url.searchParams.get("token_hash");
    assert.equal(url.searchParams.get("token_type"), "eq.access");
    if (bearerMode === "store-error") return Response.json({ code: "PGRST205", message: "local token store outage" }, { status: 400 });
    if (bearerMode === "missing") return Response.json(null);
    return Response.json({
      client_id: "local-test-client", firebase_uid: "owner-a",
      resource: bearerMode === "wrong-resource" ? "https://other.example.test/mcp" : "https://mcp.getugcpilot.com/mcp",
      scopes: ["account:read", "brand:read", "assets:read"],
      expires_at: bearerMode === "expired" ? "2020-01-01T00:00:00.000Z" : "2099-01-01T00:00:00.000Z",
      revoked_at: bearerMode === "revoked" ? "2026-09-27T00:00:00.000Z" : null,
      token_type: "access",
    });
  }
  if (url.pathname.endsWith("/rest/v1/rpc/mcp_create_upload_asset")) {
    if (uploadQuotaExceeded) return Response.json({ code: "P0001", message: "mcp_upload_quota_exceeded" }, { status: 400 });
    const reservation = JSON.parse(init.body);
    assert.equal(reservation.p_user_id, "owner-a");
    assert.equal(reservation.p_max_unconfirmed_count, 5);
    assert.equal(reservation.p_max_unconfirmed_bytes, 500 * 1024 * 1024);
    const row = {
      ...fixtureAsset(reservation.p_asset_id, new Date().toISOString()),
      user_id: reservation.p_user_id, collection: reservation.p_collection,
      source_type: reservation.p_source_type, source_record_id: reservation.p_asset_id,
      title: reservation.p_title, file_name: reservation.p_file_name,
      file_size_bytes: reservation.p_file_size_bytes, mime_type: reservation.p_mime_type,
      storage_key: reservation.p_storage_key, url: reservation.p_url,
      width: null, height: null, ratio: "other", status: "uploading",
      metadata: { mcpUpload: true }, created_at: new Date().toISOString(),
    };
    mcpUploadRows.set(row.id, row);
    return Response.json(row);
  }
  if (url.pathname.endsWith("/rest/v1/rpc/mcp_claim_deleted_upload_cleanup")) {
    const input = JSON.parse(init.body);
    const rows = [...mcpUploadRows.values()].filter(row => row.user_id === input.p_user_id &&
      row.status === "uploading" && row.deleted_at &&
      row.deleted_at <= input.p_deleted_before && !row.metadata.mcpUploadCleanupComplete &&
      !row.metadata.mcpUploadCleanupClaimToken).slice(0, input.p_limit);
    for (const row of rows) row.metadata.mcpUploadCleanupClaimToken = input.p_claim_token;
    return Response.json(rows);
  }
  if (url.pathname.endsWith("/rest/v1/rpc/mcp_finish_deleted_upload_cleanup")) {
    const input = JSON.parse(init.body);
    const row = mcpUploadRows.get(input.p_asset_id);
    if (!row || row.metadata.mcpUploadCleanupClaimToken !== input.p_claim_token) return Response.json(false);
    delete row.metadata.mcpUploadCleanupClaimToken;
    row.metadata.mcpUploadCleanupComplete = true;
    return Response.json(true);
  }
  if (url.pathname.endsWith("/rest/v1/media_assets")) {
    seenAssetRequests.push(url);
    const owner = url.searchParams.get("user_id");
    assert.ok(owner === "eq.owner-a" || owner === "eq.owner-b");
    assert.equal(url.searchParams.get("deleted_at"), "is.null");
    const id = url.searchParams.get("id");
    if (method === "PATCH") {
      const pending = mcpUploadRows.get(id?.slice(3));
      if (pending) {
        const expectedStatus = url.searchParams.get("status");
        if (expectedStatus && (expectedStatus !== "eq.uploading" || pending.status !== "uploading")) return Response.json(null);
        if (owner !== `eq.${pending.user_id}`) return Response.json(null);
        Object.assign(pending, JSON.parse(init.body));
        if (forceConcurrentConfirm) {
          forceConcurrentConfirm = false;
          return Response.json(null);
        }
        return Response.json(pending);
      }
      if (id === `eq.${uploadingAsset.id}`) {
        assert.equal(url.searchParams.get("status"), "eq.uploading");
        if (confirmedIds.has(uploadingAsset.id)) return Response.json(null);
        confirmedIds.add(uploadingAsset.id);
        return Response.json({ ...uploadingAsset, status: "ready", width: 640, height: 640 });
      }
      const asset = [firstAsset, secondAsset].find((row) => id === `eq.${row.id}` && !softDeletedIds.has(row.id));
      if (asset) softDeletedIds.add(asset.id);
      return Response.json(asset ? { ...asset, deleted_at: "2026-09-27T12:00:00.000Z" } : null);
    }
    if (id) return Response.json([...mcpUploadRows.values(), firstAsset, secondAsset, audioAsset, foreignAsset, deletedAsset, uploadingAsset]
      .find((row) => id === `eq.${row.id}` && `eq.${row.user_id}` === owner && !row.deleted_at && !softDeletedIds.has(row.id)) ?? null);
    if (assetListUnavailable) return Response.json({ message: "local asset outage" }, { status: 400 });
    assert.equal(url.searchParams.get("status"), "eq.ready");
    if (!url.searchParams.get("collection")?.startsWith("eq.")) {
      // Filtering must happen in SQL before LIMIT so audio cannot poison a page.
      assert.equal(url.searchParams.get("collection"), "in.(influencer,video,image)");
    }
    const rows = url.searchParams.get("or")?.includes("updated_at.lt")
      ? [secondAsset] : [firstAsset, secondAsset];
    return Response.json(rows);
  }
  if (url.pathname.endsWith("/rest/v1/business_profiles")) {
    assert.equal(url.searchParams.get("user_id"), "eq.owner-a");
    return Response.json(brandMode === "missing" ? null : {
      id: "33333333-3333-4333-8333-333333333333",
      user_id: "owner-a", source_url: brandMode === "with-url" ? "https://apps.apple.com/app/example" : null,
      logo_url: null, onboarding_status: brandMode === "onboarding" ? "incomplete" : "completed", onboarding_version: 3,
      onboarding_step: 3, primary_goals: ["increase_revenue"],
      context_json: {
        businessName: "Meal Map", productSummary: brandMode === "missing-summary" ? null : "Meal Map makes meal planning simple for busy households.",
        targetAudience: ["Busy households"], category: "Meal planning", businessModel: "b2c",
        mainProblem: "Planning meals takes time", mainPromise: "Plan faster", valueProps: ["Quick plans"],
        differentiators: ["Flexible meals"], brandTone: "Helpful", claimsToAvoid: [], missingInfo: [],
      },
    });
  }
  if (url.pathname.endsWith("/rest/v1/rpc/refresh_billing_credit_balance")) {
    refreshCalls += 1;
    return Response.json(null);
  }
  if (url.pathname.endsWith("/rest/v1/rpc/ensure_free_generation_credit_balance")) {
    assert.equal(JSON.parse(init.body).p_user_id, "owner-a");
    return Response.json({ granted: ONE_TIME_FREE_GENERATION_CREDITS,
      remaining: ONE_TIME_FREE_GENERATION_CREDITS, reserved: 0, used: 0 });
  }
  if (url.pathname.endsWith("/rest/v1/billing_subscriptions")) {
    if (billingMode === "outage") return Response.json({ message: "local billing outage" }, { status: 400 });
    const row = { plan_key: "growth", status: "active", last_event_at: "2026-09-27T00:00:00.000Z" };
    const paid = billingMode === "growth" || billingMode === "expired-growth";
    return Response.json(paid ? [row] : []);
  }
  if (url.pathname.endsWith("/rest/v1/billing_credit_balances")) {
    return Response.json(["growth", "expired-growth"].includes(billingMode) ? {
      credit_limit: 600, used_credits: 10, reserved_credits: 5,
      period_start: "2026-09-01T00:00:00.000Z",
      period_end: billingMode === "expired-growth" ? "2020-09-01T01:00:00.000Z" : "2099-10-01T00:00:00.000Z",

    } : null);
  }
  if (url.pathname.endsWith("/rest/v1/subscription_entitlements")) return Response.json([]);
  if (url.pathname.endsWith("/rest/v1/complimentary_plan_grants")) return Response.json(null);
  if (url.pathname.endsWith("/rest/v1/free_trial_entitlements")) return Response.json(null);
  if (url.pathname.endsWith("/rest/v1/social_connections") || url.pathname.endsWith("/rest/v1/free_trial_instagram_schedule_usage")) {
    return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
  }
  throw new Error(`Unexpected local service request: ${url.pathname}`);
};

const { mcpHandler, registeredMcpTools } = await import("../lib/mcp/server.ts");
const { decodeAssetCursor, encodeAssetCursor } = await import("../lib/mcp/asset-cursor.ts");
const { POST: mcpRoutePost } = await import("../app/mcp/route.ts");
const { gcsStorageProvider } = await import("../lib/storage/gcs.ts");
const signedUploads = [];
const tombstonedObjects = [];
const deletedObjects = [];
let headMode = "ready";
let headCalls = 0;
gcsStorageProvider.createSignedPutUrl = async (params) => {
  signedUploads.push(params);
  return `https://local-mcp-upload.example.test/${params.key}?signature=local-test`;
};
gcsStorageProvider.headObject = async ({ key }) => {
  headCalls += 1;
  if (headMode === "missing") throw Object.assign(new Error("missing"), { name: "NoSuchKey", code: "NoSuchKey" });
  if (headMode === "unavailable") throw new Error("local storage outage");
  const row = [...mcpUploadRows.values()].find((candidate) => candidate.storage_key === key);
  assert.ok(row, `Unknown local upload object ${key}`);
  return {
    ContentType: headMode === "mismatch" ? "image/jpeg" : row.mime_type,
    ContentLength: headMode === "oversize" ? 26 * 1024 * 1024 : row.file_size_bytes,
  };
};
gcsStorageProvider.uploadBuffer = async ({ key, buffer, contentType }) => {
  assert.deepEqual(buffer, Buffer.from([0]));
  assert.equal(contentType, "application/octet-stream");
  tombstonedObjects.push(key);
  return { key, url: `https://local-mcp-storage.example.test/${key}` };
};
gcsStorageProvider.deleteObject = async ({ key }) => { deletedObjects.push(key); };

const resource = new URL("https://mcp.getugcpilot.com/mcp");
const unauthenticated = await mcpRoutePost(new Request(resource, { method: "POST" }));
assert.equal(unauthenticated.status, 401);
assert.match(unauthenticated.headers.get("www-authenticate") ?? "", /resource_metadata=/);
const invalidOrigin = await mcpRoutePost(new Request(resource, {
  method: "POST",
  headers: { authorization: "Bearer local-route-bearer-secret", origin: "https://other.example.test" },
}));
assert.equal(invalidOrigin.status, 403);
const bearerSecret = "local-route-bearer-secret";
const routeRequest = () => new Request(resource, {
  method: "POST",
  headers: {
    authorization: `Bearer ${bearerSecret}`,
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2025-06-18",
  },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
});
const requestLogs = [];
const originalInfo = console.info;
let authenticatedRoute;
try {
  console.info = (line) => requestLogs.push(JSON.parse(line));
  authenticatedRoute = await mcpRoutePost(routeRequest());
} finally {
  console.info = originalInfo;
}
assert.equal(authenticatedRoute.status, 200);
assert.equal(authenticatedRoute.headers.get("cache-control"), "no-store");
const authenticatedRequestId = authenticatedRoute.headers.get("x-request-id");
assert.match(authenticatedRequestId ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(requestLogs.find((entry) => entry.event === "mcp.request").request_id, authenticatedRequestId);
assert.ok(!JSON.stringify(requestLogs).includes(bearerSecret), "Correlation logs must not disclose credentials");
const routeBodyText = await authenticatedRoute.text();
const routeDataLine = routeBodyText.split("\n").find((line) => line.startsWith("data: "));
const routeBody = JSON.parse(routeDataLine ? routeDataLine.slice(6) : routeBodyText);
assert.ok(routeBody.result.tools.some((tool) => tool.name === "get_profile"));
for (const tool of routeBody.result.tools) {
  assert.deepEqual(tool.securitySchemes, tool._meta.securitySchemes);
}
assert.equal(seenBearerHash, `eq.${createHash("sha256").update(bearerSecret).digest("hex")}`);
const oversizedRequest = routeRequest();
const oversized = await mcpRoutePost(new Request(oversizedRequest.url, {
  method: "POST", headers: oversizedRequest.headers,
  body: JSON.stringify({ padding: "a".repeat(64 * 1024) }),
}));
assert.equal(oversized.status, 413);
assert.equal(oversized.headers.get("cache-control"), "no-store");
const streamHeaders = new Headers(oversizedRequest.headers);
streamHeaders.set("content-length", "1");
const oversizedStream = await mcpRoutePost(new Request(resource, {
  method: "POST", headers: streamHeaders, duplex: "half",
  body: new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(40 * 1024));
    controller.enqueue(new Uint8Array(40 * 1024));
    controller.close();
  } }),
}));
assert.equal(oversizedStream.status, 413);
const malformed = await mcpRoutePost(new Request(resource, {
  method: "POST", headers: oversizedRequest.headers, body: "{invalid",
}));
assert.equal(malformed.status, 400);
for (const mode of ["missing", "expired", "revoked", "wrong-resource"]) {
  bearerMode = mode;
  const rejected = await mcpRoutePost(routeRequest());
  assert.equal(rejected.status, 401, mode);
  assert.notEqual(rejected.headers.get("x-request-id"), authenticatedRequestId);
  assert.ok(rejected.headers.has("x-request-id"));
  assert.match(rejected.headers.get("www-authenticate") ?? "", /resource_metadata=/);
}
bearerMode = "store-error";
const tokenStoreError = await mcpRoutePost(routeRequest());
assert.equal(tokenStoreError.status, 503);
assert.ok(tokenStoreError.headers.has("x-request-id"));
bearerMode = "valid";
const makeAuth = (firebaseUid, scopes) => ({
  token: "local-test-token", clientId: "local-test-client", scopes,
  resource, extra: { firebaseUid },
});
let callId = 0;
async function call(method, params, authInfo = makeAuth("owner-a", ["account:read", "brand:read", "assets:read"])) {
  const id = ++callId;
  const request = new Request(resource, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const response = await mcpHandler.fetch(request, { authInfo });
  const text = await response.text();
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  const body = JSON.parse(dataLine ? dataLine.slice(6) : text);
  return { status: response.status, body };
}

const discovered = await call("tools/list", {});
assert.equal(discovered.status, 200, JSON.stringify(discovered));
assert.deepEqual(discovered.body.result.tools.map((tool) => tool.name).sort(), [...registeredMcpTools].sort());
assert.equal(discovered.body.result.tools.find((tool) => tool.name === "get_profile")._meta["openai/profile"], true);
for (const tool of discovered.body.result.tools) {
  assert.equal(tool._meta.securitySchemes[0].type, "oauth2");
  assert.equal(tool._meta.securitySchemes[0].scopes.length, 1);
}
const listAssetsSchema = discovered.body.result.tools.find((tool) => tool.name === "list_assets").inputSchema;
assert.match(listAssetsSchema.properties.source_type.description, /combined_render/u);
assert.match(listAssetsSchema.properties.collection.description, /influencer/u);
const imageCountSchema = discovered.body.result.tools.find((tool) => tool.name === "generate_image").inputSchema.properties.count;
assert.deepEqual(imageCountSchema.enum, [1, 2, 4]);
const capabilitiesSchema = discovered.body.result.tools.find((tool) => tool.name === "get_capabilities").outputSchema;
assert.deepEqual(capabilitiesSchema.properties.image_generation.properties.counts.items.enum, [1, 2, 4]);

const profile = await call("tools/call", { name: "get_profile", arguments: {} });
assert.deepEqual(profile.body.result.structuredContent, { id: "owner-a" });

const missingScope = await call("tools/call", { name: "get_profile", arguments: {} }, makeAuth("owner-a", ["assets:read"]));
assert.notDeepEqual(missingScope.body.result?.structuredContent, { id: "owner-a" });
assert.ok(missingScope.body.result?._meta?.["mcp/www_authenticate"] || missingScope.body.error, JSON.stringify(missingScope.body));

const badId = await call("tools/call", { name: "get_asset", arguments: { asset_id: "wrong" } });
assert.ok(badId.body.error || badId.body.result?.isError);

const asset = await call("tools/call", { name: "get_asset", arguments: { asset_id: firstAsset.id } });
assert.equal(asset.body.result.structuredContent.asset.id, firstAsset.id);
const crossUser = await call("tools/call", { name: "get_asset", arguments: { asset_id: foreignAsset.id } });
assert.equal(JSON.parse(crossUser.body.result.content[0].text).code, "NOT_FOUND");
const unsupportedAsset = await call("tools/call", { name: "get_asset", arguments: { asset_id: audioAsset.id } });
assert.equal(JSON.parse(unsupportedAsset.body.result.content[0].text).code, "NOT_FOUND");
const deleted = await call("tools/call", { name: "get_asset", arguments: { asset_id: deletedAsset.id } });
assert.equal(JSON.parse(deleted.body.result.content[0].text).code, "NOT_FOUND");
const uploading = await call("tools/call", { name: "get_asset", arguments: { asset_id: uploadingAsset.id } });
assert.equal(JSON.parse(uploading.body.result.content[0].text).code, "NOT_FOUND");

const firstPage = await call("tools/call", { name: "list_assets", arguments: { limit: 1 } });
assert.equal(firstPage.body.result.structuredContent.items.length, 1);
assert.equal(firstPage.body.result.structuredContent.items[0].id, firstAsset.id);
const nextCursor = firstPage.body.result.structuredContent.next_cursor;
assert.ok(nextCursor);
const secondPage = await call("tools/call", { name: "list_assets", arguments: { limit: 1, cursor: nextCursor } });
assert.equal(secondPage.body.result.structuredContent.items[0].id, secondAsset.id);
assert.equal(secondPage.body.result.structuredContent.next_cursor, null);
const wrongOwnerCursor = await call("tools/call", { name: "list_assets", arguments: { cursor: nextCursor } }, makeAuth("owner-b", ["assets:read"]));
assert.equal(JSON.parse(wrongOwnerCursor.body.result.content[0].text).code, "INVALID_CURSOR");
const wrongFilterCursor = await call("tools/call", { name: "list_assets", arguments: { cursor: nextCursor, collection: "video" } });
assert.equal(JSON.parse(wrongFilterCursor.body.result.content[0].text).code, "INVALID_CURSOR");
const searched = await call("tools/call", { name: "list_assets", arguments: { query: "plan,_%", limit: 1 } });
assert.equal(searched.body.result.structuredContent.items.length, 1);
assert.ok(seenAssetRequests.at(-1).searchParams.get("or").includes("file_name.ilike."));
assert.ok(seenAssetRequests.at(-1).searchParams.get("or").includes("\\_\\%"));
assetListUnavailable = true;
const unavailableAssets = await call("tools/call", { name: "list_assets", arguments: {} });
assert.equal(JSON.parse(unavailableAssets.body.result.content[0].text).code, "ASSETS_UNAVAILABLE");
assetListUnavailable = false;

const brand = await call("tools/call", { name: "get_saas_brand", arguments: {} });
assert.equal(JSON.parse(brand.body.result.content[0].text).code, "BRAND_NOT_FOUND");
brandMode = "onboarding";
const onboardingBrand = await call("tools/call", { name: "get_saas_brand", arguments: {} });
assert.equal(JSON.parse(onboardingBrand.body.result.content[0].text).code, "ONBOARDING_REQUIRED");
brandMode = "missing-summary";
const incompleteBrand = await call("tools/call", { name: "get_saas_brand", arguments: {} });
assert.equal(JSON.parse(incompleteBrand.body.result.content[0].text).code, "BRAND_INCOMPLETE");
brandMode = "complete";
const contextOnlyBrand = await call("tools/call", { name: "get_saas_brand", arguments: {} });
assert.equal(contextOnlyBrand.body.result.structuredContent.name, "Meal Map");
assert.equal(contextOnlyBrand.body.result.structuredContent.source_url, null);
brandMode = "with-url";
const urlBrand = await call("tools/call", { name: "get_saas_brand", arguments: {} });
assert.equal(urlBrand.body.result.structuredContent.source_url, "https://apps.apple.com/app/example");
const entitlements = await call("tools/call", { name: "get_entitlements", arguments: {} });
assert.equal(JSON.parse(entitlements.body.result.content[0].text).code, "ENTITLEMENTS_UNAVAILABLE");
billingMode = "free";
const free = await call("tools/call", { name: "get_entitlements", arguments: {} });
assert.equal(free.body.result.structuredContent.plan, "free");
assert.equal(free.body.result.structuredContent.features.video_generation, false);
assert.equal(free.body.result.structuredContent.credits_remaining, 1);
assert.equal(free.body.result.structuredContent.credits_reserved, 1);
freeCreditMode = "missing";
const noFreeAllocation = await call("tools/call", { name: "get_entitlements", arguments: {} });
assert.equal(noFreeAllocation.body.result.structuredContent.credits_remaining, 0);
for (const mode of ["outage", "invalid"]) {
  freeCreditMode = mode;
  const unavailableFreeLedger = await call("tools/call", { name: "get_entitlements", arguments: {} });
  assert.equal(JSON.parse(unavailableFreeLedger.body.result.content[0].text).code, "ENTITLEMENTS_UNAVAILABLE");
}
freeCreditMode = "existing";
const freeCapabilities = await call("tools/call", { name: "get_capabilities", arguments: {} });
assert.equal(freeCapabilities.body.result.structuredContent.image_generation.available, false);
billingMode = "growth";
const growth = await call("tools/call", { name: "get_entitlements", arguments: {} });
assert.equal(growth.body.result.structuredContent.plan, "growth");
assert.equal(growth.body.result.structuredContent.credits_remaining, 585);
assert.equal(growth.body.result.structuredContent.features.video_generation, true);
const paidCapabilities = await call("tools/call", { name: "get_capabilities", arguments: {} });
assert.equal(paidCapabilities.body.result.structuredContent.video_generation.available, true);
assert.deepEqual(paidCapabilities.body.result.structuredContent.video_generation.durations_seconds, [3, 4, 5, 6, 7, 8, 9, 10]);
assert.equal(paidCapabilities.body.result.structuredContent.video_generation.max_reference_videos, 0);
billingMode = "expired-growth";
const renewedPreview = await call("tools/call", { name: "get_entitlements", arguments: {} });
assert.equal(renewedPreview.body.result.structuredContent.credits_remaining, 600);
assert.equal(renewedPreview.body.result.structuredContent.credits_reserved, 0);
assert.equal(refreshCalls, 0, "read-only tools must not run the billing rollover RPC");
assert.equal(freeCreditWrites, 0, "MCP reads must not initialize a free credit allocation");

const writeAuth = makeAuth("owner-a", ["assets:write"]);
const createArgs = {
  collection: "image", file_name: "dashboard.png", mime_type: "image/png",
  file_size_bytes: 1024, title: "Dashboard",
};
const forbiddenCreate = await call("tools/call", { name: "create_upload", arguments: createArgs });
assert.ok(forbiddenCreate.body.result?._meta?.["mcp/www_authenticate"] || forbiddenCreate.body.error);
const unsupportedCreate = await call("tools/call", { name: "create_upload", arguments: { ...createArgs, collection: "video" } }, writeAuth);
assert.equal(JSON.parse(unsupportedCreate.body.result.content[0].text).code, "UNSUPPORTED_MEDIA_TYPE");
const oversizedCreate = await call("tools/call", { name: "create_upload", arguments: { ...createArgs, file_size_bytes: 26 * 1024 * 1024 } }, writeAuth);
assert.equal(JSON.parse(oversizedCreate.body.result.content[0].text).code, "FILE_TOO_LARGE");
const signedUrlImplementation = gcsStorageProvider.createSignedPutUrl;
gcsStorageProvider.createSignedPutUrl = async () => { throw new Error("local signing outage"); };
const signingOutage = await call("tools/call", { name: "create_upload", arguments: createArgs }, writeAuth);
assert.equal(JSON.parse(signingOutage.body.result.content[0].text).code, "STORAGE_UNAVAILABLE");
assert.equal(mcpUploadRows.size, 0);
gcsStorageProvider.createSignedPutUrl = signedUrlImplementation;
uploadQuotaExceeded = true;
const quotaRejection = await call("tools/call", { name: "create_upload", arguments: createArgs }, writeAuth);
assert.equal(JSON.parse(quotaRejection.body.result.content[0].text).code, "UPLOAD_QUOTA_EXCEEDED");
uploadQuotaExceeded = false;
const createdUpload = await call("tools/call", { name: "create_upload", arguments: createArgs }, writeAuth);
assert.equal(createdUpload.status, 200, JSON.stringify(createdUpload));
const uploadReceipt = createdUpload.body.result.structuredContent;
assert.equal(uploadReceipt.required_headers["Content-Type"], "image/png");
assert.equal(uploadReceipt.required_headers["x-goog-content-length-range"], "1,1024");
assert.equal(uploadReceipt.required_headers["x-goog-if-generation-match"], "0");
assert.ok(Date.parse(uploadReceipt.expires_at) > Date.now());
assert.match(uploadReceipt.upload_url, /^https:\/\/local-mcp-upload\.example\.test\//);
assert.equal(signedUploads.at(-1).expiresInSeconds, 600);
assert.equal(signedUploads.at(-1).maxBytes, 1024);
assert.equal(signedUploads.at(-1).createOnly, true);
const uploadedRow = mcpUploadRows.get(uploadReceipt.upload_id);
assert.equal(uploadedRow.user_id, "owner-a");
assert.deepEqual(uploadedRow.metadata, { mcpUpload: true });
const confirmArgs = { upload_id: uploadReceipt.upload_id, width: 640, height: 640 };
const foreignConfirm = await call("tools/call", { name: "confirm_upload", arguments: confirmArgs }, makeAuth("owner-b", ["assets:write"]));
assert.equal(JSON.parse(foreignConfirm.body.result.content[0].text).code, "NOT_FOUND");
assert.equal(headCalls, 0);
const websiteConfirm = await call("tools/call", { name: "confirm_upload", arguments: { ...confirmArgs, upload_id: uploadingAsset.id } }, writeAuth);
assert.equal(JSON.parse(websiteConfirm.body.result.content[0].text).code, "NOT_FOUND");
headMode = "missing";
const missingObject = await call("tools/call", { name: "confirm_upload", arguments: confirmArgs }, writeAuth);
assert.equal(JSON.parse(missingObject.body.result.content[0].text).code, "UPLOAD_NOT_READY");
headMode = "unavailable";
const storageOutage = await call("tools/call", { name: "confirm_upload", arguments: confirmArgs }, writeAuth);
assert.equal(JSON.parse(storageOutage.body.result.content[0].text).code, "STORAGE_UNAVAILABLE");
headMode = "mismatch";
const wrongObject = await call("tools/call", { name: "confirm_upload", arguments: confirmArgs }, writeAuth);
assert.equal(JSON.parse(wrongObject.body.result.content[0].text).code, "UPLOAD_MISMATCH");
headMode = "oversize";
const oversizedObject = await call("tools/call", { name: "confirm_upload", arguments: confirmArgs }, writeAuth);
assert.equal(JSON.parse(oversizedObject.body.result.content[0].text).code, "FILE_TOO_LARGE");
const originalDateNow = Date.now;
Date.now = () => Date.parse(uploadReceipt.expires_at) + 60_000;
let confirmedUpload;
try {
  headMode = "missing";
  const missingAfterExpiry = await call("tools/call", { name: "confirm_upload", arguments: confirmArgs }, writeAuth);
  assert.equal(JSON.parse(missingAfterExpiry.body.result.content[0].text).code, "UPLOAD_NOT_READY");
  headMode = "ready";
  confirmedUpload = await call("tools/call", { name: "confirm_upload", arguments: confirmArgs }, writeAuth);
} finally {
  Date.now = originalDateNow;
}
assert.equal(confirmedUpload.body.result.structuredContent.asset.id, uploadReceipt.upload_id);
assert.equal(uploadedRow.status, "ready");
const fetchedUpload = await call("tools/call", { name: "get_asset", arguments: { asset_id: uploadReceipt.upload_id } });
assert.equal(fetchedUpload.body.result.structuredContent.asset.id, uploadReceipt.upload_id);
const repeatedConfirm = await call("tools/call", { name: "confirm_upload", arguments: confirmArgs }, writeAuth);
assert.equal(repeatedConfirm.body.result.structuredContent.asset.id, uploadReceipt.upload_id);
const differentConfirm = await call("tools/call", { name: "confirm_upload", arguments: { ...confirmArgs, width: 800 } }, writeAuth);
assert.equal(JSON.parse(differentConfirm.body.result.content[0].text).code, "UPLOAD_MISMATCH");
const videoCreated = await call("tools/call", { name: "create_upload", arguments: {
  collection: "video", file_name: "demo.mp4", mime_type: "video/mp4", file_size_bytes: 2048,
} }, writeAuth);
const videoUploadId = videoCreated.body.result.structuredContent.upload_id;
const videoWithoutDuration = await call("tools/call", { name: "confirm_upload", arguments: {
  upload_id: videoUploadId, width: 1080, height: 1920,
} }, writeAuth);
assert.equal(JSON.parse(videoWithoutDuration.body.result.content[0].text).code, "INVALID_INPUT");
const videoConfirmed = await call("tools/call", { name: "confirm_upload", arguments: {
  upload_id: videoUploadId, width: 1080, height: 1920, duration_seconds: 4,
} }, writeAuth);
assert.equal(videoConfirmed.body.result.structuredContent.asset.collection, "video");
assert.equal(videoConfirmed.body.result.structuredContent.asset.duration_seconds, 4);
const racedCreated = await call("tools/call", { name: "create_upload", arguments: createArgs }, writeAuth);
forceConcurrentConfirm = true;
const racedConfirm = await call("tools/call", { name: "confirm_upload", arguments: {
  upload_id: racedCreated.body.result.structuredContent.upload_id, width: 640, height: 640,
} }, writeAuth);
assert.equal(racedConfirm.body.result.structuredContent.asset.id, racedCreated.body.result.structuredContent.upload_id);

const forbiddenDelete = await call("tools/call", { name: "delete_asset", arguments: { asset_id: firstAsset.id } });
assert.ok(forbiddenDelete.body.result?._meta?.["mcp/www_authenticate"] || forbiddenDelete.body.error);
const foreignDelete = await call("tools/call", { name: "delete_asset", arguments: { asset_id: foreignAsset.id } }, writeAuth);
assert.equal(JSON.parse(foreignDelete.body.result.content[0].text).code, "NOT_FOUND");
const deletion = await call("tools/call", { name: "delete_asset", arguments: { asset_id: firstAsset.id } }, writeAuth);
assert.deepEqual(deletion.body.result.structuredContent, { asset_id: firstAsset.id, deleted: true });
const repeatedDeletion = await call("tools/call", { name: "delete_asset", arguments: { asset_id: firstAsset.id } }, writeAuth);
assert.equal(JSON.parse(repeatedDeletion.body.result.content[0].text).code, "NOT_FOUND");
const tombstonesBeforeReadyDelete = tombstonedObjects.length;
const readyMcpDeletion = await call("tools/call", { name: "delete_asset", arguments: { asset_id: uploadedRow.id } }, writeAuth);
assert.equal(readyMcpDeletion.body.result.structuredContent.deleted, true);
assert.equal(tombstonedObjects.length, tombstonesBeforeReadyDelete, "Ready assets keep the soft-delete behavior.");
const pendingReceipt = await call("tools/call", { name: "create_upload", arguments: createArgs }, writeAuth);
const pendingId = pendingReceipt.body.result.structuredContent.upload_id;
const pendingRow = mcpUploadRows.get(pendingId);
const pendingDeletion = await call("tools/call", { name: "delete_asset", arguments: { asset_id: pendingId } }, writeAuth);
assert.equal(pendingDeletion.body.result.structuredContent.deleted, true);
assert.equal(tombstonedObjects.at(-1), pendingRow.storage_key);
assert.equal(deletedObjects.length, 0, "A still-valid signed URL must retain its tombstone.");
pendingRow.deleted_at = "2026-09-27T00:00:00.000Z";
await call("tools/call", { name: "create_upload", arguments: createArgs }, writeAuth);
assert.equal(deletedObjects.at(-1), pendingRow.storage_key);
assert.equal(pendingRow.metadata.mcpUploadCleanupComplete, true);

const { markMediaAssetReady } = await import("../lib/media/media-storage.ts");
const ready = await markMediaAssetReady({ assetId: uploadingAsset.id, userId: "owner-a", width: 640, height: 640, ratio: "1:1", expectedStatus: "uploading" });
assert.equal(ready.status, "ready");
const concurrentConfirmation = await markMediaAssetReady({ assetId: uploadingAsset.id, userId: "owner-a", width: 640, height: 640, ratio: "1:1", expectedStatus: "uploading" });
assert.equal(concurrentConfirmation, null);

const payload = {
  v: 1, user_id: "owner-a", collection: null, source_type: null, query: null,
  updated_at: "2026-09-27T10:00:00.000Z", id: "22222222-2222-4222-8222-222222222222",
};
const signed = encodeAssetCursor(payload);
assert.deepEqual(decodeAssetCursor(signed), payload);
assert.equal(decodeAssetCursor(`${signed.slice(0, -1)}x`), null);

assert.ok(seenAssetRequests.length >= 4);
console.log("MCP tools: bearer route validation, discovery, read tools, upload creation and late confirmation, owner isolation, retries, storage failures, and soft deletion passed.");
