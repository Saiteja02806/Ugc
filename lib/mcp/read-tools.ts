import "server-only";

import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";

import { getUserSubscription, type UserSubscriptionInfo } from "@/lib/billing/subscription-db";
import { getBusinessProfileForUser, isBusinessProfileOnboardingComplete } from "@/lib/business-profiles/db";
import { getMissingBusinessProfileOnboardingFields } from "@/lib/business-profiles/schema";
import {
  AI_STUDIO_GENERATION_QUANTITIES,
  AI_STUDIO_IMAGE_ASPECT_RATIOS,
  AI_STUDIO_VIDEO_ASPECT_RATIOS,
} from "@/lib/ai-studio/generation-settings";
import { MCP_VIDEO_DURATIONS, registeredGenerationMcpTools } from "./generation-contract";
import { getMediaAssetForOwner, listMediaAssetsPage, type MediaAssetRow } from "@/lib/media/media-storage";
import { mediaSourceTypes } from "@/lib/media/types";
import { decodeAssetCursor, encodeAssetCursor } from "./asset-cursor";

const empty = z.strictObject({});
const uuid = z.uuid().describe("A UGC Pilot resource ID.");
const sourceUrl = z.url().regex(/^https?:\/\//i);
const httpsUrl = z.url().regex(/^https:\/\//i);
const nullableText = z.string().nullable();
const mediaCollectionDescription =
  "Asset group: image for still images, video for videos, or influencer for creator footage.";
const mediaSourceTypeDescription =
  "How UGC Pilot created the asset: upload (library upload), influencer_upload (creator footage upload), demo_upload (demo footage), catalog_influencer (built-in creator asset), generated_image or generated_video (AI output), edit_export (editor export), combined_render (composed video), wall_text_render, or reaction_render.";
// Website audio references do not expand the public MCP V1 asset contract.
export const MCP_MEDIA_COLLECTIONS = ["influencer", "video", "image"] as const;
const mediaCollection = z.enum(MCP_MEDIA_COLLECTIONS).describe(mediaCollectionDescription);
const mediaSourceType = z.enum(mediaSourceTypes).describe(mediaSourceTypeDescription);
export const generationCount = z.literal([1, 2, 4]).describe(
  "Number of outputs to create. Choose 1, 2, or 4.",
);
const videoToolRegistered = registeredGenerationMcpTools.includes("generate_video");
const videoDuration = z.literal(MCP_VIDEO_DURATIONS);
const assetSummary = z.strictObject({
  id: uuid,
  title: z.string(),
  collection: mediaCollection,
  source_type: mediaSourceType,
  mime_type: z.string(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  duration_seconds: z.number().positive().nullable(),
  created_at: z.string(),
});
export const asset = assetSummary.extend({
  file_name: nullableText,
  file_size_bytes: z.number().int().positive().nullable(),
  ratio: z.enum(["9:16", "1:1", "4:5", "16:9", "other"]),
  thumbnail_url: httpsUrl.nullable(),
  updated_at: z.string(),
  url: httpsUrl,
});

type ToolContext = { http?: { authInfo?: { scopes: string[]; extra?: Record<string, unknown> } } };

export function principal(ctx: ToolContext, scope: string) {
  const auth = ctx.http?.authInfo;
  const uid = auth?.extra?.firebaseUid;
  if (!auth || typeof uid !== "string" || !uid.trim()) throw new ToolFailure("UNAUTHENTICATED", "Connect your UGC Pilot account.");
  if (!auth.scopes.includes(scope)) throw new ToolFailure("INSUFFICIENT_SCOPE", `The ${scope} permission is required.`);
  return uid;
}

export class ToolFailure extends Error {
  constructor(public code: string, message: string, public retryable = false) {
    super(message);
  }
}

function success(output: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(output) }], structuredContent: output };
}

function failure(error: unknown) {
  const known = error instanceof ToolFailure ? error : null;
  const code = known?.code ?? (error instanceof Error && error.message === "ENTITLEMENTS_UNAVAILABLE" ? "ENTITLEMENTS_UNAVAILABLE" : "INTERNAL_ERROR");
  if (!known && code === "INTERNAL_ERROR") {
    console.error(JSON.stringify({ event: "mcp.read_tool.error", name: error instanceof Error ? error.name : "UnknownError" }));
  }
  const payload = {
    code,
    message: known?.message ?? (code === "ENTITLEMENTS_UNAVAILABLE" ? "Current plan and credits are temporarily unavailable." : "The request could not be completed."),
    retryable: known?.retryable ?? true,
  };
  return { isError: true as const, content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
}

export async function executeTool(output: () => Promise<Record<string, unknown>>) {
  try { return success(await output()); } catch (error) { return failure(error); }
}

async function loadEntitlements(userId: string): Promise<UserSubscriptionInfo> {
  try {
    return await getUserSubscription(userId, { strict: true, refreshCredits: false });
  } catch {
    throw new ToolFailure("ENTITLEMENTS_UNAVAILABLE", "Current plan and credits are temporarily unavailable.", true);
  }
}

function toSummary(row: MediaAssetRow) {
  return {
    id: row.id,
    title: row.title,
    collection: row.collection,
    source_type: row.source_type,
    mime_type: row.mime_type,
    width: row.width,
    height: row.height,
    duration_seconds: row.duration_seconds,
    created_at: row.created_at,
  };
}

export function toAsset(row: MediaAssetRow) {
  return {
    ...toSummary(row),
    file_name: row.file_name,
    file_size_bytes: row.file_size_bytes,
    ratio: row.ratio,
    thumbnail_url: row.thumbnail_url,
    updated_at: row.updated_at,
    url: row.url,
  };
}

const readOnly = { readOnlyHint: true } as const;
export function oauthMetadata(scope: string, extra: Record<string, unknown> = {}) {
  // SDK v2.1 serializes custom tool descriptor properties through `_meta`.
  // This is the ChatGPT compatibility mirror of the required OAuth scheme.
  return { securitySchemes: [{ type: "oauth2", scopes: [scope] }], ...extra };
}

export const registeredReadMcpTools = [
  "get_profile", "get_entitlements", "get_saas_brand", "list_assets", "get_asset", "get_capabilities",
] as const;

export function registerReadMcpTools(server: McpServer) {
  server.registerTool("get_profile", {
    description: "Identify the connected UGC Pilot account.",
    inputSchema: empty,
    outputSchema: z.strictObject({ id: z.string().min(1), name: z.string().min(1).optional(), email: z.email().optional(), nickname: z.string().min(1).optional() }),
    annotations: readOnly,
    scopeChallenge: requireScopes("account:read"),
    _meta: oauthMetadata("account:read", { "openai/profile": true }),
  }, async (_args, ctx) => executeTool(async () => ({ id: principal(ctx, "account:read") })));

  server.registerTool("get_entitlements", {
    description: "Show the current plan, available credits, and generation access.",
    inputSchema: empty,
    outputSchema: z.strictObject({
      plan: z.enum(["free", "starter", "growth"]),
      access_source: z.enum(["free", "dodo", "complimentary"]),
      active: z.boolean(),
      credits_remaining: z.number().int().nonnegative(),
      credits_reserved: z.number().int().nonnegative(),
      image_credit_cost: z.number().int().nonnegative(),
      video_credits_per_second: z.number().int().nonnegative(),
      features: z.strictObject({ image_generation: z.boolean(), video_generation: z.boolean() }),
    }),
    annotations: readOnly,
    scopeChallenge: requireScopes("account:read"),
    _meta: oauthMetadata("account:read"),
  }, async (_args, ctx) => executeTool(async () => {
    const subscription = await loadEntitlements(principal(ctx, "account:read"));
    const active = subscription.isActive;
    return {
      plan: subscription.planKey,
      access_source: subscription.accessSource,
      active,
      credits_remaining: subscription.creditsRemaining,
      credits_reserved: subscription.creditsReserved,
      image_credit_cost: subscription.imageGenerationCreditCost,
      video_credits_per_second: subscription.videoGenerationCreditsPerSecond,
      features: { image_generation: active, video_generation: active && videoToolRegistered },
    };
  }));

  server.registerTool("get_saas_brand", {
    description: "Get the completed brand profile and grounded business context for this account.",
    inputSchema: empty,
    outputSchema: z.strictObject({
      id: uuid,
      name: z.string().min(1),
      source_url: sourceUrl.nullable(),
      logo_url: httpsUrl.nullable(),
      context: z.strictObject({
        product_summary: z.string().min(20),
        target_audience: z.array(z.string().min(1)).min(1),
        category: nullableText,
        business_model: z.enum(["b2b", "b2c", "both"]).nullable(),
        main_problem: nullableText,
        main_promise: nullableText,
        value_propositions: z.array(z.string()),
        differentiators: z.array(z.string()),
        brand_tone: nullableText,
        claims_to_avoid: z.array(z.string()),
        missing_info: z.array(z.string()),
      }),
    }),
    annotations: readOnly,
    scopeChallenge: requireScopes("brand:read"),
    _meta: oauthMetadata("brand:read"),
  }, async (_args, ctx) => executeTool(async () => {
    const profile = await getBusinessProfileForUser(principal(ctx, "brand:read"));
    if (!profile) throw new ToolFailure("BRAND_NOT_FOUND", "No brand profile was found for this account.");
    if (!isBusinessProfileOnboardingComplete(profile)) {
      throw new ToolFailure("ONBOARDING_REQUIRED", "Complete business onboarding before using this brand.");
    }
    if (getMissingBusinessProfileOnboardingFields(profile.context).length) {
      throw new ToolFailure("BRAND_INCOMPLETE", "The brand profile is missing required information.");
    }
    const context = profile.context;
    const result = {
      id: profile.id,
      name: context.businessName?.trim() ?? "",
      source_url: profile.sourceUrl,
      logo_url: profile.logoUrl,
      context: {
        product_summary: context.productSummary?.trim() ?? "",
        target_audience: context.targetAudience,
        category: context.category ?? null,
        business_model: context.businessModel ?? null,
        main_problem: context.mainProblem ?? null,
        main_promise: context.mainPromise ?? null,
        value_propositions: context.valueProps,
        differentiators: context.differentiators,
        brand_tone: context.brandTone ?? null,
        claims_to_avoid: context.claimsToAvoid,
        missing_info: context.missingInfo,
      },
    };
    if (!z.string().min(1).safeParse(result.name).success ||
        !z.string().min(20).safeParse(result.context.product_summary).success ||
        !z.array(z.string().min(1)).min(1).safeParse(result.context.target_audience).success ||
        (result.source_url && !sourceUrl.safeParse(result.source_url).success) ||
        (result.logo_url && !httpsUrl.safeParse(result.logo_url).success)) {
      throw new ToolFailure("BRAND_INCOMPLETE", "The brand profile is missing required information.");
    }
    return result;
  }));

  server.registerTool("list_assets", {
    description: "Find ready assets owned by the connected account, with search and pagination.",
    inputSchema: z.strictObject({
      collection: mediaCollection.optional().describe(`Optionally limit results. ${mediaCollectionDescription}`),
      source_type: mediaSourceType.optional().describe(`Optionally limit results. ${mediaSourceTypeDescription}`),
      query: z.string().trim().min(1).max(100).optional().describe("Optional words to find in asset titles."),
      limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of results to return, from 1 through 50."),
      cursor: z.string().min(1).max(2048).optional().describe("The next_cursor returned by an earlier call with the same filters."),
    }),
    outputSchema: z.strictObject({ items: z.array(assetSummary), next_cursor: z.string().min(1).nullable() }),
    annotations: readOnly,
    scopeChallenge: requireScopes("assets:read"),
    _meta: oauthMetadata("assets:read"),
  }, async (args, ctx) => executeTool(async () => {
    const userId = principal(ctx, "assets:read");
    const expected = { user_id: userId, collection: args.collection ?? null, source_type: args.source_type ?? null, query: args.query ?? null };
    const cursor = args.cursor ? decodeAssetCursor(args.cursor) : null;
    if (args.cursor && (!cursor || Object.entries(expected).some(([key, value]) => cursor[key as keyof typeof expected] !== value))) {
      throw new ToolFailure("INVALID_CURSOR", "The asset cursor is invalid for these filters.");
    }
    let rows: MediaAssetRow[];
    try {
      rows = await listMediaAssetsPage({
        userId, collection: args.collection, collections: MCP_MEDIA_COLLECTIONS,
        sourceType: args.source_type,
        query: args.query, limit: args.limit,
        after: cursor ? { updatedAt: cursor.updated_at, id: cursor.id } : undefined,
      });
    } catch {
      throw new ToolFailure("ASSETS_UNAVAILABLE", "The asset library is temporarily unavailable.", true);
    }
    const page = rows.slice(0, args.limit);
    const last = page.at(-1);
    return {
      items: page.map(toSummary),
      next_cursor: rows.length > args.limit && last ? encodeAssetCursor({
        v: 1, ...expected, updated_at: last.updated_at, id: last.id,
      }) : null,
    };
  }));

  server.registerTool("get_asset", {
    description: "Get one ready, undeleted asset owned by this account.",
    inputSchema: z.strictObject({ asset_id: uuid.describe("ID of the ready asset to retrieve.") }),
    outputSchema: z.strictObject({ asset }),
    annotations: readOnly,
    scopeChallenge: requireScopes("assets:read"),
    _meta: oauthMetadata("assets:read"),
  }, async ({ asset_id }, ctx) => executeTool(async () => {
    const row = await getMediaAssetForOwner({ assetId: asset_id, userId: principal(ctx, "assets:read") });
    if (!row || row.status !== "ready" || !mediaCollection.safeParse(row.collection).success) {
      throw new ToolFailure("NOT_FOUND", "Asset not found.");
    }
    if (!asset.safeParse(toAsset(row)).success) throw new ToolFailure("INTERNAL_ERROR", "The asset metadata is incomplete.", true);
    return { asset: toAsset(row) };
  }));

  server.registerTool("get_capabilities", {
    description: "Show generation settings usable with the current account plan.",
    inputSchema: empty,
    outputSchema: z.strictObject({
      image_generation: z.strictObject({ available: z.boolean(), aspect_ratios: z.array(z.enum(AI_STUDIO_IMAGE_ASPECT_RATIOS)), counts: z.array(generationCount), max_reference_images: z.union([z.literal(0), z.literal(1)]) }),
      video_generation: z.strictObject({ available: z.boolean(), aspect_ratios: z.array(z.enum(AI_STUDIO_VIDEO_ASPECT_RATIOS)), durations_seconds: z.array(videoDuration), counts: z.array(generationCount), max_reference_images: z.union([z.literal(0), z.literal(1)]), max_reference_videos: z.literal(0) }),
    }),
    annotations: readOnly,
    scopeChallenge: requireScopes("account:read"),
    _meta: oauthMetadata("account:read"),
  }, async (_args, ctx) => executeTool(async () => {
    const subscription = await loadEntitlements(principal(ctx, "account:read"));
    const imageAvailable = subscription.isActive && subscription.creditsRemaining >= subscription.imageGenerationCreditCost;
    const videoAvailable = videoToolRegistered && subscription.isActive &&
      subscription.creditsRemaining >= 3 * subscription.videoGenerationCreditsPerSecond;
    return {
      image_generation: {
        available: imageAvailable,
        aspect_ratios: imageAvailable ? [...AI_STUDIO_IMAGE_ASPECT_RATIOS] : [],
        counts: imageAvailable ? [...AI_STUDIO_GENERATION_QUANTITIES] : [],
        max_reference_images: imageAvailable ? 1 : 0,
      },
      video_generation: {
        available: videoAvailable,
        aspect_ratios: videoAvailable ? [...AI_STUDIO_VIDEO_ASPECT_RATIOS] : [],
        durations_seconds: videoAvailable ? [...MCP_VIDEO_DURATIONS] : [],
        counts: videoAvailable ? [...AI_STUDIO_GENERATION_QUANTITIES] : [],
        max_reference_images: videoAvailable ? 1 : 0,
        max_reference_videos: 0,
      },
    };
  }));
}
