import "server-only";
import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getUserSubscription } from "@/lib/billing/subscription-db";
import { getBusinessProfileForUser } from "@/lib/business-profiles/db";
import { ReferenceTextSchema, RemixOutputSchema, RemixRequestSchema } from "@/lib/explore/reference-text";
import { executeTool, oauthMetadata, principal, ToolFailure } from "./read-tools";
import type { RecreateReference } from "@/lib/explore/recreate-types";

const format = z.enum(["hook","wall_text","slideshow"]);
const identifier = z.string().min(1).max(160);
const https = z.url({ protocol:/^https$/ });
const reference = z.strictObject({
  id:identifier, format, title:z.string(), category:z.string().nullable(), category_label:z.string().nullable(),
  poster_url:https, video_url:https.nullable(), duration_seconds:z.number().positive().nullable(),
  slides:z.array(z.strictObject({ id:identifier, url:https, width:z.number().positive(), height:z.number().positive() })),
  paired_audio:z.strictObject({ title:z.string(), url:https, duration_seconds:z.number().positive() }).nullable(),
});
const resultSchema = z.strictObject({ request_key:z.uuid(), outcome:z.enum(["completed","failed","uncertain"]),
  source:ReferenceTextSchema.nullable(), output:RemixOutputSchema.nullable(), message:z.string() });
const readOnly = { readOnlyHint:true, destructiveHint:false, openWorldHint:false } as const;
export const registeredReferenceMcpTools = ["get_reference_capabilities","list_references","get_reference","remix_reference_text","get_text_remix","list_text_remixes"] as const;
function summary(item: RecreateReference) {
  return { id:item.id, format:item.format, title:item.title, category:item.category, category_label:item.categoryLabel,
    poster_url:item.posterUrl, video_url:item.videoUrl ?? null, duration_seconds:item.durationSeconds ?? null,
    slides:item.slides, paired_audio:item.pairedAudio ? { title:item.pairedAudio.title, url:item.pairedAudio.url, duration_seconds:item.pairedAudio.durationSeconds } : null };
}
async function access(owner: string, initializeFreeCredits = false) {
  try {
    const plan = await getUserSubscription(owner,{ strict:true, refreshCredits:false, initializeFreeCredits });
    return { allowed:plan.isActive || plan.freeGenerationCredits.granted > 0, initializationRequired:!plan.isActive && plan.freeGenerationCredits.granted === 0 };
  } catch { throw new ToolFailure("ENTITLEMENTS_UNAVAILABLE","Current reference/text access is unavailable.",true); }
}
async function requireAccess(owner: string, initializeFreeCredits = false) {
  if (!(await access(owner,initializeFreeCredits)).allowed) throw new ToolFailure("ACCESS_REQUIRED","Your account does not currently have application text-remix access.");
}
async function receipt(response: Response, requestKey: string) {
  const body = await response.json();
  if (body.ok && response.status === 200) return resultSchema.parse({ request_key:requestKey, outcome:"completed", source:body.source, output:body.output, message:"Saved text remix is ready. This has not edited or rendered a video." });
  if (body.outcome === "uncertain" || body.outcome === "failed") return resultSchema.parse({ request_key:requestKey, outcome:body.outcome, source:null, output:null,
    message:body.message ?? "Preserve this request key and recover its saved result before submitting new work." });
  const code = response.status === 404 ? "NOT_FOUND" : response.status === 409 ? "REMIX_CONFLICT" : response.status === 429 ? "RATE_LIMITED" : response.status >= 500 ? "REMIX_UNAVAILABLE" : "INVALID_INPUT";
  throw new ToolFailure(code,body.message ?? "The text remix could not be confirmed.",response.status >= 500);
}
function referenceFailure(error: unknown): never {
  if (error instanceof Error && "code" in error && ["NOT_FOUND","INVALID_INPUT","INVALID_CURSOR"].includes(String(error.code))) throw new ToolFailure(String(error.code),error.message);
  throw error;
}
export function registerReferenceMcpTools(server: McpServer) {
  server.registerTool("get_reference_capabilities",{
    description:"Read reference/text-remix access and runtime readiness without initializing credits, extracting text or calling a provider.",
    inputSchema:z.strictObject({}), outputSchema:z.strictObject({ catalogue_available:z.literal(true), text_access:z.enum(["allowed","initialization_required"]),
      remix_available:z.boolean(), remix_enabled:z.boolean(), provider_configured:z.boolean(), storage_configured:z.boolean(), business_context_ready:z.boolean(),
      formats:z.array(format), max_instructions_characters:z.literal(2000), max_source_characters:z.literal(6000), max_source_blocks:z.literal(20), daily_request_limit:z.literal(20), quota_window_hours:z.literal(24), required_write_scope:z.literal("creative:write") }),
    annotations:readOnly, scopeChallenge:requireScopes("account:read"), _meta:oauthMetadata("account:read"),
  },async (_args,ctx) => executeTool(async () => {
    const owner = principal(ctx,"account:read"), allowed = await access(owner), profile = await getBusinessProfileForUser(owner);
    const enabled = process.env.MCP_TEXT_REMIX_ENABLED === "true" && process.env.EXPLORE_TEXT_REMIX_ENABLED === "true";
    const provider = Boolean(process.env.OPENAI_API_KEY?.trim());
    const storage = Boolean((process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
    const ready = Boolean(profile?.context.businessName && profile.context.productSummary);
    return { catalogue_available:true, text_access:allowed.allowed ? "allowed" : "initialization_required", remix_available:(allowed.allowed || allowed.initializationRequired) && enabled && provider && storage && ready,
      remix_enabled:enabled, provider_configured:provider, storage_configured:storage, business_context_ready:ready, formats:["hook","wall_text","slideshow"],
      max_instructions_characters:2000, max_source_characters:6000, max_source_blocks:20, daily_request_limit:20, quota_window_hours:24, required_write_scope:"creative:write" };
  }));
  server.registerTool("list_references",{
    description:"Browse the application's published Hook, Wall-of-Text and slideshow reference catalogue, including slide IDs and supplied paired soundtrack metadata. Catalogue identities are distinct from owned media IDs; this does not upload, transcribe or render anything.",
    inputSchema:z.strictObject({ format:format.optional(), query:z.string().max(160).optional(), category:identifier.optional(), limit:z.number().int().min(1).max(50).default(20), cursor:z.string().min(1).max(1024).optional() }),
    outputSchema:z.strictObject({ items:z.array(reference).max(50), total:z.number().int().nonnegative(), next_cursor:z.string().nullable() }),
    annotations:readOnly, scopeChallenge:requireScopes("assets:read"), _meta:oauthMetadata("assets:read"),
  },async (args,ctx) => executeTool(async () => {
    principal(ctx,"assets:read");
    try { const service = await import("@/lib/explore/reference-access"); const page = service.listExploreReferences(args); return { ...page,items:page.items.map(summary) }; }
    catch (error) { return referenceFailure(error); }
  }));
  server.registerTool("get_reference",{
    description:"Retrieve one application reference and its existing reviewed text. Select a slide_id for slideshow text. Reports missing/unreviewed extraction without generating it. Uses the application's text access policy.",
    inputSchema:z.strictObject({ reference_id:identifier, slide_id:identifier.nullable().default(null) }),
    outputSchema:z.strictObject({ reference, source:ReferenceTextSchema.nullable(), text_status:z.enum(["ready","needs_review","no_text","slide_required","not_prepared","unavailable"]) }),
    annotations:readOnly, scopeChallenge:requireScopes("assets:read"), _meta:oauthMetadata("assets:read"),
  },async ({ reference_id,slide_id },ctx) => executeTool(async () => {
    const owner = principal(ctx,"assets:read"); await requireAccess(owner);
    try { const service = await import("@/lib/explore/reference-access"); const result = service.getExploreReference(reference_id,slide_id); return { ...result, reference:summary(result.reference) }; }
    catch (error) { return referenceFailure(error); }
  }));
  server.registerTool("remix_reference_text",{
    description:"Generate and save a requested business-specific text remix through the application's same provider/claim service. May use provider allowance. Save the caller's stable requestKey and exact inputs before calling; recover interrupted or uncertain work with get_text_remix. First-use submission may initialize the application's standard one-time free allowance. This does not edit a draft or render media.",
    inputSchema:RemixRequestSchema, outputSchema:resultSchema,
    annotations:{ readOnlyHint:false, destructiveHint:true, openWorldHint:true, idempotentHint:true }, scopeChallenge:requireScopes("creative:write"), _meta:oauthMetadata("creative:write"),
  },async (args,ctx) => executeTool(async () => {
    const owner = principal(ctx,"creative:write");
    if (process.env.MCP_TEXT_REMIX_ENABLED !== "true") throw new ToolFailure("REMIX_UNAVAILABLE","IDE text-remix creation is not enabled. Saved results remain readable.");
    // Explicit new work follows website first-use access; catalogue/history reads never grant credits.
    await requireAccess(owner,true);
    const service = await import("@/lib/explore/remix-text-api");
    return receipt(await service.remixTextForOwner(owner,args),args.requestKey);
  }));
  server.registerTool("get_text_remix",{
    description:"Read and verify an owned saved application or MCP text-remix result by its caller request UUID. Never claims, calls a provider or retries. Remains readable after plan/gate changes; pending/failed work is not automatically repeated.",
    inputSchema:z.strictObject({ request_key:z.uuid() }), outputSchema:resultSchema,
    annotations:readOnly, scopeChallenge:requireScopes("jobs:read"), _meta:oauthMetadata("jobs:read"),
  },async ({request_key},ctx) => executeTool(async () => {
    const owner = principal(ctx,"jobs:read"), service = await import("@/lib/explore/remix-text-api");
    return receipt(await service.getTextRemixForOwner(owner,request_key),request_key);
  }));
  server.registerTool("list_text_remixes",{
    description:"Discover this account's saved website/MCP text-remix request keys, status and timestamps. Metadata only; recover a selected result with get_text_remix. No provider call or current creation access is required.",
    inputSchema:z.strictObject({limit:z.number().int().min(1).max(50).default(20),cursor:z.string().min(1).max(1024).optional()}),
    outputSchema:z.strictObject({items:z.array(z.strictObject({request_key:z.uuid(),status:z.enum(["pending","completed","failed"]),created_at:z.string(),updated_at:z.string()})).max(50),next_cursor:z.string().nullable()}),
    annotations:readOnly,scopeChallenge:requireScopes("jobs:read"),_meta:oauthMetadata("jobs:read"),
  },async(args,ctx)=>executeTool(async()=>{
    const owner=principal(ctx,"jobs:read"),service=await import("@/lib/explore/remix-text-api");
    const response=await service.listTextRemixesForOwner(owner,args),body=await response.json();
    if(!body.ok)throw new ToolFailure(response.status>=500?"REMIX_UNAVAILABLE":"INVALID_CURSOR",body.message,response.status>=500);
    return {items:body.items,next_cursor:body.next_cursor};
  }));

}
