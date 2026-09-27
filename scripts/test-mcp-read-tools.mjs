import assert from "node:assert/strict";
import { createHash } from "node:crypto";

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
const foreignAsset = { ...fixtureAsset("44444444-4444-4444-8444-444444444444", "2026-09-26T09:00:00.000Z"), user_id: "owner-b" };
const deletedAsset = { ...fixtureAsset("55555555-5555-4555-8555-555555555555", "2026-09-26T09:00:00.000Z"), deleted_at: "2026-09-27T00:00:00.000Z" };
const uploadingAsset = { ...fixtureAsset("66666666-6666-4666-8666-666666666666", "2026-09-26T09:00:00.000Z"), status: "uploading" };
let billingMode = "outage";
let brandMode = "missing";
let refreshCalls = 0;
let assetListUnavailable = false;
let bearerMode = "valid";
let seenBearerHash = null;
const softDeletedIds = new Set();
const confirmedIds = new Set();
const mcpUploadRows = new Map();
let forceConcurrentConfirm = false;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
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
  if (url.pathname.endsWith("/rest/v1/media_assets")) {
    seenAssetRequests.push(url);
    if (method === "POST") {
      const inserted = JSON.parse(init.body);
      assert.equal(inserted.user_id, "owner-a");
      assert.equal(inserted.status, "uploading");
      assert.deepEqual(inserted.metadata, { mcpUpload: true });
      const row = { ...fixtureAsset(inserted.id, inserted.updated_at), ...inserted, created_at: new Date().toISOString(), deleted_at: null };
      mcpUploadRows.set(row.id, row);
      return Response.json(row);
    }
    const owner = url.searchParams.get("user_id");
    assert.ok(owner === "eq.owner-a" || owner === "eq.owner-b");
    assert.equal(url.searchParams.get("deleted_at"), "is.null");
    const id = url.searchParams.get("id");
    if (method === "PATCH") {
      const pending = mcpUploadRows.get(id?.slice(3));
      if (pending) {
        assert.equal(url.searchParams.get("status"), "eq.uploading");
        if (pending.status !== "uploading" || owner !== `eq.${pending.user_id}`) return Response.json(null);
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
    if (id) return Response.json([...mcpUploadRows.values(), firstAsset, secondAsset, foreignAsset, deletedAsset, uploadingAsset]
      .find((row) => id === `eq.${row.id}` && `eq.${row.user_id}` === owner && !row.deleted_at && !softDeletedIds.has(row.id)) ?? null);
    if (assetListUnavailable) return Response.json({ message: "local asset outage" }, { status: 400 });
    assert.equal(url.searchParams.get("status"), "eq.ready");
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
  if (url.pathname.endsWith("/rest/v1/billing_subscriptions")) {
    if (billingMode === "outage") return Response.json({ message: "local billing outage" }, { status: 400 });
    const active = url.searchParams.get("status") === "eq.active";
    const row = { plan_key: "growth", status: "active", last_event_at: "2026-09-27T00:00:00.000Z" };
    const paid = billingMode === "growth" || billingMode === "expired-growth";
    return Response.json(active ? (paid ? [row] : []) : paid ? row : null);
  }
  if (url.pathname.endsWith("/rest/v1/billing_credit_balances")) {
    return Response.json(["growth", "expired-growth"].includes(billingMode) ? {
      credit_limit: 600, used_credits: 10, reserved_credits: 5,
      period_start: "2026-09-01T00:00:00.000Z",
      period_end: billingMode === "expired-growth" ? "2026-09-01T01:00:00.000Z" : "2026-10-01T00:00:00.000Z",
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
const authenticatedRoute = await mcpRoutePost(routeRequest());
assert.equal(authenticatedRoute.status, 200);
assert.equal(authenticatedRoute.headers.get("cache-control"), "no-store");
const routeBodyText = await authenticatedRoute.text();
const routeDataLine = routeBodyText.split("\n").find((line) => line.startsWith("data: "));
const routeBody = JSON.parse(routeDataLine ? routeDataLine.slice(6) : routeBodyText);
assert.ok(routeBody.result.tools.some((tool) => tool.name === "get_profile"));
assert.equal(seenBearerHash, `eq.${createHash("sha256").update(bearerSecret).digest("hex")}`);
for (const mode of ["missing", "expired", "revoked", "wrong-resource"]) {
  bearerMode = mode;
  const rejected = await mcpRoutePost(routeRequest());
  assert.equal(rejected.status, 401, mode);
  assert.match(rejected.headers.get("www-authenticate") ?? "", /resource_metadata=/);
}
bearerMode = "store-error";
const tokenStoreError = await mcpRoutePost(routeRequest());
assert.equal(tokenStoreError.status, 503);
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
const freeCapabilities = await call("tools/call", { name: "get_capabilities", arguments: {} });
assert.equal(freeCapabilities.body.result.structuredContent.image_generation.available, false);
billingMode = "growth";
const growth = await call("tools/call", { name: "get_entitlements", arguments: {} });
assert.equal(growth.body.result.structuredContent.plan, "growth");
assert.equal(growth.body.result.structuredContent.credits_remaining, 585);
assert.equal(growth.body.result.structuredContent.features.video_generation, false);
const paidCapabilities = await call("tools/call", { name: "get_capabilities", arguments: {} });
assert.equal(paidCapabilities.body.result.structuredContent.video_generation.available, false);
assert.equal(paidCapabilities.body.result.structuredContent.video_generation.max_reference_videos, 0);
billingMode = "expired-growth";
const renewedPreview = await call("tools/call", { name: "get_entitlements", arguments: {} });
assert.equal(renewedPreview.body.result.structuredContent.credits_remaining, 600);
assert.equal(renewedPreview.body.result.structuredContent.credits_reserved, 0);
assert.equal(refreshCalls, 0, "read-only tools must not run the billing rollover RPC");

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
const createdUpload = await call("tools/call", { name: "create_upload", arguments: createArgs }, writeAuth);
assert.equal(createdUpload.status, 200, JSON.stringify(createdUpload));
const uploadReceipt = createdUpload.body.result.structuredContent;
assert.equal(uploadReceipt.required_headers["Content-Type"], "image/png");
assert.ok(Date.parse(uploadReceipt.expires_at) > Date.now());
assert.match(uploadReceipt.upload_url, /^https:\/\/local-mcp-upload\.example\.test\//);
assert.equal(signedUploads.at(-1).expiresInSeconds, 600);
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
