# UGC Pilot Cloud MCP V1: approved contracts

Status: **Phase 1 approved by the user on 2026-09-27. Phase 2 implementation authorized.**

This document contains the 12 approved V1 tools. `cancel_job` is
excluded. All tool arguments use `snake_case`, reject unknown fields, and never
accept a user ID.
The authenticated principal comes from a token issued for this MCP resource.
Successful tool calls return structured content matching the output shape below.
The companion [JSON Schema contract](ugc-pilot-cloud-mcp-v1-tool-schemas.json)
contains the exact `inputSchema` and `outputSchema` for each of the 12 tools.
It is the Phase 1 design artifact; the Phase 2 server skeleton lives separately.

The contracts use these exact shared wire shapes. `?` means the field may be
omitted; `null` is written explicitly when a field is always present but may be
empty. UUIDs are canonical UUID strings, timestamps are ISO 8601 UTC strings,
and arrays preserve the order returned by the service.

```ts
type Collection = "image" | "video" | "influencer";
type SourceType = "upload" | "influencer_upload" | "demo_upload" |
  "catalog_influencer" | "generated_image" | "generated_video" |
  "edit_export" | "combined_render" | "wall_text_render" |
  "reaction_render";
type Ratio = "9:16" | "1:1" | "4:5" | "16:9" | "other";
type JobStatus = "created" | "queued" | "processing" |
  "waiting_external_service" | "rendering" | "uploading_output" |
  "cancel_requested" | "stalled" | "completed" | "failed" | "cancelled";

type AssetSummary = {
  id: string; // UUID
  title: string;
  collection: Collection;
  source_type: SourceType;
  mime_type: string;
  width: number | null; // positive integer if present
  height: number | null; // positive integer if present
  duration_seconds: number | null; // positive if present
  created_at: string;
};
type Asset = AssetSummary & {
  file_name: string | null;
  file_size_bytes: number | null; // positive integer if present
  ratio: Ratio;
  thumbnail_url: string | null; // HTTPS if present
  updated_at: string;
  url: string; // HTTPS, returned only after owner lookup
};
type JobReceiptItem = { job_id: string; status: JobStatus }; // UUID
type GenerationReceipt = { jobs: JobReceiptItem[]; partial: boolean };
type EmptyInput = Record<string, never>;
```

For every `EmptyInput` below, the actual MCP `inputSchema` is
`{"type":"object","additionalProperties":false}`. Every other input and
output is a JSON object with exactly the stated fields and no additional
properties. Required fields have no `?`. Optional fields have the limits shown
below. Runtime validation must reject invalid enums, bounds, and combinations
instead of silently applying the current website API's fallback defaults.
Semantic checks that depend on stored state, such as ownership, upload state,
media collection, idempotency fingerprints, and the number of returned jobs,
remain mandatory server-side checks beyond JSON Schema validation.

## Tool contracts

### 1. `get_profile`

Description: identify the connected UGC Pilot account without exposing a token.

```ts
input: EmptyInput;
output: {
  id: string; // Firebase UID from the verified MCP principal
  name?: string; // Firebase display name, only when available
  email?: string; // only when available
  nickname?: string; // only if an existing, user-recognizable label is available
};
```

This tool carries `_meta["openai/profile"]: true` for ChatGPT account
identification. The `id` remains the same across token refresh and reconnect;
it is never derived from email or a display label. Plan belongs in
`get_entitlements`.

### 2. `get_entitlements`

Description: show current plan, credits, and generation access. The generation
tools independently enforce these same rules at call time.

```ts
input: EmptyInput;
output: {
  plan: "free" | "starter" | "growth";
  access_source: "free" | "dodo" | "complimentary";
  active: boolean;
  credits_remaining: number; // integer >= 0
  credits_reserved: number; // integer >= 0
  image_credit_cost: number; // integer >= 0
  video_credits_per_second: number; // integer >= 0
  features: { image_generation: boolean; video_generation: boolean };
};
```

No invented maximum concurrent jobs or premium model flags are returned.

### 3. `get_saas_brand`

Description: return the owner's completed business profile as grounded creative
context. `source_url` is the existing `business_profiles.source_url`: present
when a website or app URL was supplied and saved; null for a context-only setup.
A URL is not required for a mobile app profile.

```ts
input: EmptyInput;
output: {
  id: string; // business_profiles.id UUID
  name: string; // required, from context_json.businessName
  source_url: string | null; // validated HTTP(S) URL if present
  logo_url: string | null; // existing business logo, not a media asset ID
  context: {
    product_summary: string; // from context_json.productSummary
    target_audience: string[]; // nonempty; from context_json.targetAudience
    category: string | null;
    business_model: "b2b" | "b2c" | "both" | null;
    main_problem: string | null;
    main_promise: string | null;
    value_propositions: string[];
    differentiators: string[];
    brand_tone: string | null;
    claims_to_avoid: string[];
    missing_info: string[];
  };
};
```

The output maps existing `context_json` fields; `value_propositions` maps
`valueProps`. It does not invent colors, a logo asset ID, or audience facts.
New URL-based onboarding requires a supported name, product summary of at least
20 characters, and nonempty target audience before saving the analysis. Manual
entry requires these fields too. Older completed profiles and AI-IDE context
may still lack them because the shared onboarding-complete check currently
requires only a business name and a selected goal. This tool returns
`BRAND_INCOMPLETE` rather than a partial success when any of the three facts is
missing. URL onboarding handles failed extraction by opening manual entry; it
does not interrupt a successful extraction or present a partial brand as ready.

### 4. `list_assets`

Description: discover ready, undeleted assets owned by the connected user.
Search matches saved title and filename. Sort is `(updated_at DESC, id DESC)`;
the cursor is opaque and bound to the user and filters.

```ts
input: {
  collection?: Collection;
  source_type?: SourceType;
  query?: string; // trimmed, 1..100 characters
  limit?: number; // integer 1..50, default 20
  cursor?: string; // opaque, 1..2048 characters
};
output: {
  items: AssetSummary[]; // at most limit
  next_cursor: string | null;
};
```

### 5. `get_asset`

Description: get metadata and a usable URL for one ready, undeleted asset.

```ts
input: { asset_id: string }; // UUID
output: { asset: Asset };
```

The existing storage URL is public after creation; this tool's owner check
controls discovery, not the lifetime of a URL already shared elsewhere.

### 6. `create_upload`

Description: reserve one media record and return a short-lived signed PUT URL.
The upload itself is an HTTPS PUT to `upload_url` with `required_headers`.

```ts
input: {
  collection: Collection;
  file_name: string; // 1..255 chars; no path separators or NUL
  mime_type: "image/jpeg" | "image/png" | "image/webp" |
    "video/mp4" | "video/quicktime" | "video/webm";
  file_size_bytes: number; // positive integer; <=25 MiB for image,
                           // <=250 MiB for video/influencer
  title?: string; // trimmed, 1..140 chars
};
output: {
  upload_id: string; // UUID, same as reserved media asset ID
  upload_url: string; // HTTPS signed PUT URL
  expires_at: string; // UTC timestamp, currently 10 minutes after issuance
  required_headers: {
    "Content-Type": string;
    "x-goog-content-length-range": string; // 1,file_size_bytes
    "x-goog-if-generation-match": "0"; // upload to a new object only
  };
};
```

The MIME type must match the collection. No arbitrary `project_id`, storage key,
or owner ID comes from the model.
The signed PUT enforces the declared maximum size at GCS and rejects a second
write to the same object. The client must send every `required_headers` entry.
The service allows at most five outstanding, unconfirmed MCP uploads and
500 MiB of their declared bytes per account. An owner-deleted unconfirmed
upload stays in that quota until its storage cleanup succeeds; a quota
rejection does not return an upload URL.

### 7. `confirm_upload`

Description: verify the uploaded object and mark the reserved asset ready.

```ts
input: {
  upload_id: string; // UUID
  width: number; // positive integer
  height: number; // positive integer
  duration_seconds?: number; // positive; required for video/influencer,
                             // omitted for image
};
output: { asset: Asset };
```

Verification includes owner, MCP upload state, object existence,
declared versus actual MIME and size, and allowed size. Dimensions and video
duration are client-supplied metadata, as in today's website completion route;
they are validated for shape but not independently extracted from the file.
The signed PUT URL expires after 10 minutes, but an object uploaded while the
URL was valid can be confirmed later. Confirmation does not have a deadline.
Confirmation of an already ready upload returns the same asset only if its
stored object still matches; it must never register another asset.

### 8. `delete_asset`

Description: delete exactly one owned asset. Ready assets retain the existing
soft-delete behavior, so previously shared public URLs may still work.
Owner-deleted, unconfirmed MCP uploads are sealed with a tiny tombstone to
block their still-valid signed URL; the tombstone is removed after the URL's
validity window. Cleanup does not set a deadline for confirming an active
upload.

```ts
input: { asset_id: string }; // UUID
output: { asset_id: string; deleted: true };
```

### 9. `get_capabilities`

Description: return currently usable generation settings after intersecting
configured backend support with the user's active plan. Models and providers
are deliberately absent.

```ts
input: EmptyInput;
output: {
  image_generation: {
    available: boolean;
    aspect_ratios: Array<"4:5" | "1:1" | "9:16" | "16:9">;
    counts: Array<1 | 2 | 4>;
    max_reference_images: 0 | 1;
  };
  video_generation: {
    available: boolean;
    aspect_ratios: Array<"9:16" | "16:9">;
    durations_seconds: Array<3 | 4 | 5 | 6 | 7 | 8 | 9 | 10>;
    counts: Array<1 | 2 | 4>;
    max_reference_images: 0 | 1;
    max_reference_videos: 0;
  };
};
```

An unavailable feature has `available:false`; its setting arrays may be empty.
Video references are excluded from V1 by product decision.

### 10. `generate_image`

Description: reserve credits and queue one, two, or four independent image
jobs. Return job IDs immediately; use `get_job` for results. An idempotent
retry can return a job that has already progressed or completed.

```ts
input: {
  prompt: string; // trimmed, 1..2000 chars
  aspect_ratio?: "4:5" | "1:1" | "9:16" | "16:9"; // default 9:16
  reference_asset_id?: string; // UUID of one owned, ready image
  count?: 1 | 2 | 4; // default 1
  client_request_id: string; // trimmed, 1..200 chars
};
output: GenerationReceipt; // 1..count jobs; partial=true only if some
                           // children queued and another failed
```

The client request ID is scoped to the principal and image operation. A retry
with identical normalized input returns the existing receipt; the same ID with
different input returns `IDEMPOTENCY_CONFLICT`. This needs an input fingerprint
check that the current background-job and billing unique keys lack.

### 11. `generate_video`

Description: reserve credits and queue one, two, or four independent video
jobs. Return job IDs immediately; use `get_job` for results. An idempotent
retry can return a job that has already progressed or completed.

```ts
input: {
  prompt: string; // trimmed, 1..1000 chars
  aspect_ratio?: "9:16" | "16:9"; // default 9:16
  duration_seconds: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  reference_asset_id?: string; // UUID of one owned, ready image
  count?: 1 | 2 | 4; // default 1
  client_request_id: string; // trimmed, 1..200 chars
};
output: GenerationReceipt;
```

The same idempotency and ownership rules as `generate_image` apply. The backend
uses its existing video route/worker configuration; the tool does not accept a
provider name, video reference, or arbitrary external reference URL.

### 12. `get_job`

Description: poll an owned MCP image/video generation job. Only a completed
job may return output asset IDs, each still retrievable via `get_asset`.

```ts
input: { job_id: string }; // UUID
output: {
  id: string; // UUID
  type: "image_generation" | "video_generation";
  status: JobStatus;
  progress: number | null; // 0..100 when present
  stage: string | null;
  output_asset_ids: string[]; // UUIDs, empty before completion
  error: { code: string; message: string; retryable: boolean } | null;
  created_at: string;
  updated_at: string;
};
```

No raw provider payload, secret, internal storage key, or unrelated website job
output is exposed.

## Authorization, effects, and existing integration points

Every tool requires an authenticated MCP bearer token issued by a first-party
OAuth issuer in the existing app after Firebase sign-in. `401` means
missing/invalid token; `403` means insufficient OAuth scope. Asset and job IDs
are always looked up with the verified Firebase owner ID. These scope names
are proposed as part of the contract, not an existing auth feature.

| Tool | Scope | Entitlement and ownership | Effect / annotation | Existing service |
| --- | --- | --- | --- | --- |
| `get_profile` | `account:read` | Self only | Read only | MCP token principal (Firebase identity verified at issuance) |
| `get_entitlements` | `account:read` | Self only | Read only | `getUserSubscription` |
| `get_saas_brand` | `brand:read` | Completed owner profile | Read only | `getBusinessProfileForUser` |
| `list_assets` | `assets:read` | Own ready, undeleted rows | Read only | `listMediaAssets` (add search/pagination) |
| `get_asset` | `assets:read` | Own ready, undeleted row | Read only | `getMediaAssetForOwner` |
| `create_upload` | `assets:write` | Own record; server-set owner | Write | `createMediaUploadTarget`, MCP quota reservation RPC, `createSignedPutUrl` |
| `confirm_upload` | `assets:write` | Own pending upload | Write | `getMediaAssetForOwner`, `headStorageObject`, `markMediaAssetReady` |
| `delete_asset` | `assets:write` | Own undeleted row | Destructive hint | Conditional MCP upload deletion or `softDeleteMediaAsset` |
| `get_capabilities` | `account:read` | Self plan | Read only | `getUserSubscription`, AI Studio settings |
| `generate_image` | `generation:write` | Active Starter/Growth, enough credits, owned reference | Write, costly | AI Studio image job/credit services |
| `generate_video` | `generation:write` | Active Starter/Growth, enough credits, owned reference | Write, costly | AI Studio video job/credit services |
| `get_job` | `jobs:read` | Own MCP image/video job | Read only | `getBackgroundJobForUser` |

All read-only tools set `readOnlyHint:true`. `delete_asset` sets
`destructiveHint:true`. Upload and generation tools set `readOnlyHint:false`;
the latter also describe their credit cost before invocation. Client-side
confirmation is governed by each MCP client's UI; the server never assumes a
model's response is an authorization or billing check.

## Client compatibility findings for the OAuth design

The auth design must preserve a stable Firebase UID across token refreshes and
reconnections. Each tool should advertise its required OAuth scope in its MCP
`securitySchemes`, alongside protected-resource metadata. ChatGPT's tool-level
linking flow also expects `_meta["mcp/www_authenticate"]` when a tool returns an
authentication challenge. The Phase 2 transport design must reconcile that
client behavior with the protocol's HTTP `401` response for invalid or expired
bearer tokens; this is a verification requirement, not a reason to weaken token
validation.

ChatGPT supports Client ID Metadata Documents (CIMD) and Dynamic Client
Registration (DCR), and uses a stable redirect URI when the issuer advertises
and returns the RFC 9207 `iss` parameter correctly. Claude's custom connector
UI also allows an explicitly configured OAuth client ID and secret. The user
approved CIMD and DCR for Phase 2. Actual ChatGPT, Claude, and coding-client
connections still require verification on the production domains.

Client references: [OpenAI MCP authentication](https://developers.openai.com/plugins/build/auth),
[OpenAI profile tool](https://developers.openai.com/plugins/build/mcp-server),
[Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp),
and [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).

## Error contract

Authentication and scope failures are HTTP OAuth errors. A valid authenticated
tool call that fails returns MCP `isError:true` with one structured error:
`{ code: string, message: string, retryable: boolean }`. Messages are safe for
clients and do not include credentials, provider payloads, or another user's
existence. Unknown or cross-user IDs both return `NOT_FOUND`.

| Tool(s) | Expected codes beyond `INVALID_INPUT`, `INTERNAL_ERROR` |
| --- | --- |
| `get_profile` | None |
| `get_entitlements`, `get_capabilities` | `ENTITLEMENTS_UNAVAILABLE` |
| `get_saas_brand` | `ONBOARDING_REQUIRED`, `BRAND_NOT_FOUND`, `BRAND_INCOMPLETE` |
| `list_assets` | `INVALID_CURSOR`, `ASSETS_UNAVAILABLE` |
| `get_asset` | `NOT_FOUND` |
| `create_upload` | `UNSUPPORTED_MEDIA_TYPE`, `FILE_TOO_LARGE`, `UPLOAD_QUOTA_EXCEEDED`, `STORAGE_UNAVAILABLE` |
| `confirm_upload` | `NOT_FOUND`, `UPLOAD_NOT_READY`, `UPLOAD_MISMATCH`, `UNSUPPORTED_MEDIA_TYPE`, `FILE_TOO_LARGE`, `STORAGE_UNAVAILABLE` |
| `delete_asset` | `NOT_FOUND` |
| `generate_image`, `generate_video` | `PLAN_REQUIRED`, `INSUFFICIENT_CREDITS`, `REFERENCE_NOT_FOUND`, `UNSUPPORTED_REFERENCE`, `IDEMPOTENCY_CONFLICT`, `GENERATION_UNAVAILABLE` |
| `get_job` | `NOT_FOUND` |

## Decisions and implementation gaps exposed by this review

1. The first onboarding screen accepts a product URL, including an App Store
   or Google Play listing. It analyzes the submitted page in a background job
   and stores the result in `source_url`. A live audit of two websites, two App
   Store listings, and two Play Store listings populated name, summary, and
   audience in all six cases. The store-specific metadata helper still fetches
   **name and icon for the preview only**; the analysis reads the listing text.
   New URL-based onboarding makes one focused recovery pass when required facts
   are missing, then opens manual entry if they remain unavailable. A low
   confidence label by itself does not trigger manual entry. The saved intake
   type is `website` even for an app-store URL, so the MCP brand contract does
   not expose that
   misleading internal classification. The six-source audit does not prove
   arbitrary URLs will yield sufficient context.
2. Manual and AI-IDE-context onboarding can complete with `source_url = null`.
   That is valid and sufficient if the saved business context meets the agreed
   minimum. The MCP must never prompt for a missing mobile link.
3. `BusinessProfileRecord` currently omits `source_url` even though the DB row
   stores it. The shared mapping needs to expose it before `get_saas_brand`.
   `context_json.businessName` is the saved brand name; there is no separate
   business-name column. The current onboarding-complete predicate checks name
   and selected goals, so the MCP needs its explicit summary/audience check.
4. `listMediaAssets` needs bounded owner-scoped search and cursor pagination.
5. `confirm_upload` needs declared-versus-actual-size checks. The signed PUT
   URL enforces its own expiry, so no confirmation deadline is stored. The
   existing website route accepts dimensions and duration from the client, so
   the V1 contract requires those fields as metadata.
6. Current generation routes trust storage URLs and do not compare request
   fingerprints for repeated idempotency keys. Shared services need owner ID
   resolution and a payload conflict check before MCP generation can ship.
7. Firebase login exists, but no MCP-compatible OAuth authorization server or
   MCP-specific token audience exists. The user chose a first-party issuer in
   the existing app, retaining Firebase sign-in and the current Supabase DB.
   The proposed implementation uses authorization code + PKCE, explicit consent
   for requested scopes, short-lived MCP-audience access tokens, rotating
   revocable refresh tokens, hashed token/code storage, protected-resource and
   authorization-server metadata, and client registration through Client ID
   Metadata Documents or pre-registration, with Dynamic Client Registration
   only if the target clients require it. The issuer, consent, and token records
   belong in the current Supabase database. Exact token lifetimes, registration
   compatibility, and migration details require security design before Phase 2.
8. Video-to-video currently routes through Runway without applying the
   requested 3–10 second duration, while the website reserves credits based on
   that request. The user chose image references only for MCP V1; fixing the
   shared video-reference path is separate work.

Protocol reference: [MCP tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools),
[authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization),
and [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports).
