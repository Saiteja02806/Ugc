import "server-only";
import { createHash } from "node:crypto";
import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  AI_STUDIO_GENERATION_QUANTITIES, AI_STUDIO_IMAGE_ASPECT_RATIOS, AI_STUDIO_IMAGE_MODELS,
  AI_STUDIO_VIDEO_ASPECT_RATIOS, AI_STUDIO_VIDEO_MODELS, AI_STUDIO_VIDEO_RESOLUTIONS,
  SLIDESHOW_IMAGE_MODELS, getAIStudioImageModelLabel, getAIStudioVideoDurations,
  getAIStudioVideoModelLabel, getAIStudioVideoResolutions, isAIStudioVideoModelAvailable,
} from "@/lib/ai-studio/generation-settings";
import type { GenerateRequest } from "@/lib/ai-studio/image-generation-api";
import type { GenerateVideoRequest } from "@/lib/ai-studio/video-generation-api";
import { getGenerationCreditCost, getUserSubscription } from "@/lib/billing/subscription-db";
import { createAndDispatchReservedMcpGenerationJob, dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { getBackgroundJobByIdempotencyKey, getMissingBackgroundJobStorageEnvVars, McpGenerationJobError, type Json } from "@/lib/jobs/background-jobs";
import { getMediaAssetForOwner, type MediaAssetRow } from "@/lib/media/media-storage";
import { isTrustedMediaReferenceUrl } from "@/lib/media/media-reference";
import { getMissingJobQueueEnvVars } from "@/lib/queues/job-queue";
import { generationChildIdempotencyKey } from "./generation-idempotency";
import { asGenerationFailure, requireGenerationAccess } from "./generation-tools";
import { executeTool, generationCount, oauthMetadata, principal, ToolFailure } from "./read-tools";

export const registeredGenerationOptionsMcpTools = ["get_generation_options", "generate_image_with_options", "generate_video_with_options", "get_generation_request"] as const;
const uuid = z.uuid().transform(value => value.toLowerCase());
const ids = (max: number) => z.array(uuid).max(max).refine(value => new Set(value).size === value.length, "Choose distinct references.");
const receipt = z.strictObject({ job_id: z.uuid(), status: z.string() });
const batchResult = z.strictObject({ jobs: z.array(receipt).min(1).max(4), partial: z.boolean() });
const requestInput = z.strictObject({ kind: z.enum(["image", "video"]), client_request_id: uuid });
const common = { prompt: z.string().trim().min(1), count: generationCount.default(1), client_request_id: uuid };
export const advancedImageInput = z.strictObject({
  ...common, format: z.enum(["ai_studio", "slideshow"]).default("ai_studio"),
  model: z.enum([...AI_STUDIO_IMAGE_MODELS, "gpt_image_2_5"]),
  aspect_ratio: z.enum(AI_STUDIO_IMAGE_ASPECT_RATIOS),
  reference_image_asset_ids: ids(14).default([]), attached_image_asset_ids: ids(14).default([]),
  regeneration_image_asset_id: uuid.optional(),
});
export const advancedVideoInput = z.strictObject({
  ...common, format: z.enum(["ai_studio", "hook", "wall_text"]).default("ai_studio"),
  model: z.enum(AI_STUDIO_VIDEO_MODELS), resolution: z.enum(AI_STUDIO_VIDEO_RESOLUTIONS),
  duration_seconds: z.number().int().min(2).max(30), aspect_ratio: z.enum(AI_STUDIO_VIDEO_ASPECT_RATIOS),
  reference_image_asset_ids: ids(6).default([]), reference_audio_asset_ids: ids(1).default([]),
  reference_video_asset_id: uuid.optional(), reference_video_mode: z.literal("edit").optional(),
  use_gallery_video_reference: z.boolean().default(false), reference_id: z.string().trim().min(1).max(200).optional(),
});
const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const write = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const;
const enabled = () => process.env.MCP_ADVANCED_GENERATION_ENABLED === "true";
const jobType = (kind: "image" | "video") => kind === "image" ? "generate_image" as const : "generate_hook_video" as const;
function fingerprint(kind: "image" | "video", args: unknown) {
  return createHash("sha256").update(JSON.stringify({ contract: "advanced-v1", kind, args })).digest("hex");
}

async function reference(owner: string, id: string, kind: "image" | "video" | "audio") {
  const row = await getMediaAssetForOwner({ assetId: id, userId: owner });
  if (!row || row.id.toLowerCase() !== id || row.user_id !== owner || row.deleted_at !== null || row.status !== "ready")
    throw new ToolFailure("REFERENCE_NOT_FOUND", "Choose your own ready reference file.");
  if (row.collection !== kind || !row.mime_type.startsWith(`${kind}/`) || !row.url.startsWith("https://") || !isTrustedMediaReferenceUrl(row.url))
    throw new ToolFailure("UNSUPPORTED_REFERENCE", "The saved file is not a supported reference type.");
  return row;
}

function referenceSnapshot(rows: MediaAssetRow[]) {
  return createHash("sha256").update(JSON.stringify(rows.map(row => ({
    id: row.id, storage_key: row.storage_key, url: row.url, mime_type: row.mime_type,
    size: row.file_size_bytes, duration: row.duration_seconds, updated_at: row.updated_at,
    metadata: row.metadata,
  })))).digest("hex");
}

async function existing(owner: string, kind: "image" | "video", key: string, expectedFingerprint?: string, recoverDelivery = false) {
  const jobs = [];
  const records = [];
  let expectedCount: number | undefined;
  let expectedValidatedHash: string | undefined;
  for (let index = 1; index <= 4; index++) {
    const idempotencyKey = generationChildIdempotencyKey({ userId: owner, kind, clientRequestId: key, childIndex: index });
    const job = await getBackgroundJobByIdempotencyKey(idempotencyKey, { userId: owner, jobType: jobType(kind) });
    if (!job) continue;
    const input = job.input;
    if (job.userId !== owner || job.jobType !== jobType(kind) || job.idempotencyKey !== idempotencyKey ||
        !input || typeof input !== "object" || Array.isArray(input) || input.mcpSource !== "ugc-pilot-cloud-mcp" ||
        input.mcpGenerationContract !== "advanced-v1" || input.mcpClientRequestId !== key || input.batchIndex !== index ||
        typeof input.batchSize !== "number" || ![1,2,4].includes(input.batchSize) || index > Number(input.batchSize) ||
        typeof input.mcpValidatedInputFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(input.mcpValidatedInputFingerprint) ||
        typeof input.mcpRequestFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(input.mcpRequestFingerprint))
      throw new ToolFailure("IDEMPOTENCY_CONFLICT", "This request ID belongs to different work.");
    if (expectedCount !== undefined && expectedCount !== input.batchSize || expectedFingerprint && expectedFingerprint !== input.mcpRequestFingerprint)
      throw new ToolFailure("IDEMPOTENCY_CONFLICT", "This request ID belongs to different work.");
    if (expectedValidatedHash && expectedValidatedHash !== input.mcpValidatedInputFingerprint)
      throw new ToolFailure("IDEMPOTENCY_CONFLICT", "The saved batch contains different reference inputs.");
    expectedValidatedHash = input.mcpValidatedInputFingerprint;
    expectedCount = Number(input.batchSize);
    expectedFingerprint ??= input.mcpRequestFingerprint;
    records.push(job);
    jobs.push({ job_id: job.id, status: job.status });
  }
  // Validate every sibling before replaying any frozen delivery.
  if (recoverDelivery) for (const record of records) await dispatchQueuedBackgroundJobForRecovery(record);
  return { jobs, partial: Boolean(jobs.length && jobs.length !== expectedCount) };
}

async function start(owner: string, kind: "image" | "video", key: string, hash: string, amount: number, inputs: Record<string, Json | undefined>[], snapshot: string) {
  const jobs = [];
  // Freeze resolved URLs, measured durations, reference roles and price across
  // siblings, while excluding per-output IDs and batch positions.
  const canonical = { ...inputs[0] };
  delete canonical.videoId; delete canonical.generationId; delete canonical.batchIndex;
  const validatedHash = createHash("sha256").update(JSON.stringify({amount,input:canonical,reference_snapshot:snapshot})).digest("hex");
  for (const [index,input] of inputs.entries()) {
    try {
      const job = await createAndDispatchReservedMcpGenerationJob({
        advanced: true, userId: owner, jobType: jobType(kind), amount, fingerprint: hash,
        idempotencyKey: generationChildIdempotencyKey({userId:owner,kind,clientRequestId:key,childIndex:index+1}),
        input: {...input, mcpSource:"ugc-pilot-cloud-mcp", mcpRequestFingerprint:hash,
          mcpGenerationContract:"advanced-v1", mcpClientRequestId:key, mcpValidatedInputFingerprint:validatedHash, userId:owner, projectId:"ai-studio"},
      });
      jobs.push({job_id:job.id,status:job.status});
    } catch(error) {
      if(error instanceof McpGenerationJobError && error.code === "IDEMPOTENCY_CONFLICT") asGenerationFailure(error);
      if(!jobs.length) asGenerationFailure(error);
      return Response.json({jobs,partial:true});
    }
  }
  return Response.json({jobs,partial:false});
}

async function responseResult(response: Response) {
  const data = await response.json();
  if(!response.ok) {
    if(response.status >= 500) throw new ToolFailure("GENERATION_UNAVAILABLE","Generation is temporarily unavailable. Preserve the request ID.",true);
    throw new ToolFailure("INVALID_GENERATION_INPUT",typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : "Choose supported generation options.");
  }
  return batchResult.parse(data);
}

async function guard(owner: string, kind: "image" | "video", key: string, hash: string) {
  const prior=await existing(owner,kind,key,hash,true);
  if(prior.jobs.length && !prior.partial) return prior;
  if(!enabled()) throw new ToolFailure("GENERATION_NOT_ENABLED","Advanced generation is not enabled. Existing requests can still be read with get_generation_request.");
  await requireGenerationAccess(owner,jobType(kind),true);
  return null;
}

const imageFormatLimits=z.strictObject({format:z.enum(["ai_studio","slideshow"]),max_style_references:z.number().int(),max_attached_references:z.number().int(),max_total_references:z.number().int(),regeneration:z.boolean()});
const videoFormatLimits=z.strictObject({format:z.enum(["ai_studio","hook","wall_text"]),max_image_references:z.number().int(),max_audio_references:z.number().int(),max_video_references:z.number().int(),max_total_references:z.number().int(),max_video_reference_seconds:z.number(),video_edit_mode:z.boolean(),max_edit_image_references:z.number().int(),max_edit_video_seconds:z.number()});
const optionsResult=z.strictObject({
  creation_available:z.boolean(), generation_access:z.enum(["allowed","plan_required","unavailable"]),
  counts:z.array(generationCount), image_credit_cost:z.number().int().nonnegative(), video_credit_cost_per_second:z.number().int().nonnegative(),
  image_models:z.array(z.strictObject({id:z.enum([...AI_STUDIO_IMAGE_MODELS,"gpt_image_2_5"]),name:z.string(),formats:z.array(z.enum(["ai_studio","slideshow"])),aspect_ratios:z.array(z.enum(AI_STUDIO_IMAGE_ASPECT_RATIOS)),max_style_references:z.number().int(),max_total_references:z.number().int(),available:z.boolean(),format_limits:z.array(imageFormatLimits)})),
  video_models:z.array(z.strictObject({id:z.enum(AI_STUDIO_VIDEO_MODELS),name:z.string(),available:z.boolean(),formats:z.array(z.enum(["ai_studio","hook","wall_text"])),resolutions:z.array(z.enum(AI_STUDIO_VIDEO_RESOLUTIONS)),durations_seconds:z.array(z.number().int()),aspect_ratios:z.array(z.enum(AI_STUDIO_VIDEO_ASPECT_RATIOS)),max_image_references:z.number().int(),max_audio_references:z.number().int(),max_video_references:z.number().int(),format_limits:z.array(videoFormatLimits)})),
});

export function registerGenerationOptionsMcpTools(server: McpServer) {
  server.registerTool("get_generation_options",{
    description:"Read the application model, quality, duration and reference contracts for the advanced generation tools, including plan/runtime/rollout availability. Does not generate, initialize free credits or alter the older V1 tools.",
    inputSchema:z.strictObject({}),outputSchema:optionsResult,annotations:read,scopeChallenge:requireScopes("account:read"),_meta:oauthMetadata("account:read"),
  },(_,ctx)=>executeTool(async()=>{
    const owner=principal(ctx,"account:read");
    let access:"allowed"|"plan_required"|"unavailable"="unavailable";
    try {const plan=await getUserSubscription(owner,{strict:true,refreshCredits:false,initializeFreeCredits:false});access=plan.isActive||plan.freeGenerationCredits.granted>0?"allowed":"plan_required";} catch {}
    const stored=!getMissingBackgroundJobStorageEnvVars().length;
    const imageAvailable=enabled()&&access==="allowed"&&stored&&!getMissingJobQueueEnvVars(["generate_image"]).length;
    const videoAvailable=enabled()&&access==="allowed"&&stored&&!getMissingJobQueueEnvVars(["generate_hook_video"]).length;
    const available=imageAvailable||videoAvailable;
    return {creation_available:available,generation_access:access,counts:[...AI_STUDIO_GENERATION_QUANTITIES],
      image_credit_cost:getGenerationCreditCost("image"),video_credit_cost_per_second:getGenerationCreditCost("video",1),
      image_models:[...new Set([...AI_STUDIO_IMAGE_MODELS,...SLIDESHOW_IMAGE_MODELS])].map(id=>({id,name:getAIStudioImageModelLabel(id),
        formats:[...(AI_STUDIO_IMAGE_MODELS.includes(id as typeof AI_STUDIO_IMAGE_MODELS[number])?["ai_studio" as const]:[]),...(SLIDESHOW_IMAGE_MODELS.includes(id as typeof SLIDESHOW_IMAGE_MODELS[number])?["slideshow" as const]:[])],
        aspect_ratios:[...AI_STUDIO_IMAGE_ASPECT_RATIOS],max_style_references:id==="seedream_5_pro"?1:14,max_total_references:id==="seedream_5_pro"?1:14,available:imageAvailable,
        format_limits:[...(AI_STUDIO_IMAGE_MODELS.includes(id as typeof AI_STUDIO_IMAGE_MODELS[number])?[{format:"ai_studio" as const,max_style_references:1,max_attached_references:0,max_total_references:1,regeneration:false}]:[]),
          ...(SLIDESHOW_IMAGE_MODELS.includes(id as typeof SLIDESHOW_IMAGE_MODELS[number])?[{format:"slideshow" as const,max_style_references:14,max_attached_references:14,max_total_references:14,regeneration:true}]:[])],
      })),
      video_models:AI_STUDIO_VIDEO_MODELS.map(id=>({id,name:getAIStudioVideoModelLabel(id),available:videoAvailable&&isAIStudioVideoModelAvailable(id),
        formats:id==="google_omni"||id==="wan_3_0"?["ai_studio" as const,"hook" as const,"wall_text" as const]:["ai_studio" as const],
        resolutions:[...getAIStudioVideoResolutions(id)],durations_seconds:[...getAIStudioVideoDurations(id)],aspect_ratios:[...AI_STUDIO_VIDEO_ASPECT_RATIOS],
        max_image_references:id==="kling_3_0"?2:6,max_audio_references:id==="seedance_2_5"?1:0,max_video_references:id==="seedance_2_5"||id==="google_omni"?1:0,
        format_limits:[{format:"ai_studio" as const,max_image_references:id==="kling_3_0"?2:6,max_audio_references:id==="seedance_2_5"?1:0,max_video_references:id==="seedance_2_5"?1:0,max_total_references:id==="kling_3_0"?2:6,max_video_reference_seconds:id==="seedance_2_5"?30:0,video_edit_mode:false,max_edit_image_references:0,max_edit_video_seconds:0},
          ...(id==="google_omni"||id==="wan_3_0"?(["hook","wall_text"] as const).map(format=>({format,max_image_references:6,max_audio_references:0,max_video_references:id==="google_omni"?1:0,max_total_references:6,max_video_reference_seconds:id==="google_omni"?3:0,video_edit_mode:id==="google_omni",max_edit_image_references:id==="google_omni"?1:0,max_edit_video_seconds:id==="google_omni"?10:0})):[])],
      })),
    };
  }));
  server.registerTool("get_generation_request",{
    description:"Recover an owned advanced image/video batch by its saved client UUID, including a lost submission response or partial batch. Read-only after rollout/plan/reference changes; does not dispatch work. Unconfirmed does not prove no submission. Use get_job for output IDs.",
    inputSchema:requestInput,outputSchema:z.strictObject({client_request_id:z.uuid(),confirmed:z.boolean(),jobs:z.array(receipt).max(4),partial:z.boolean()}),
    annotations:read,scopeChallenge:requireScopes("jobs:read"),_meta:oauthMetadata("jobs:read"),
  },(args,ctx)=>executeTool(async()=>{const result=await existing(principal(ctx,"jobs:read"),args.kind,args.client_request_id);return {client_request_id:args.client_request_id,confirmed:result.jobs.length>0,...result};}));
  server.registerTool("generate_image_with_options",{
    description:"Generate requested AI Studio or slideshow images with the application's selected model/ratio and owned style, attachment and edit-target references. May spend credits. Read get_generation_options first. Save a fresh client UUID and exact inputs before submitting; recover with get_generation_request. Does not render slideshow text or test connectivity.",
    inputSchema:advancedImageInput,outputSchema:batchResult,annotations:write,scopeChallenge:requireScopes("generation:write"),_meta:oauthMetadata("generation:write"),
  },(args,ctx)=>executeTool(async()=>{
    const owner=principal(ctx,"generation:write"),hash=fingerprint("image",args);
    const prior=await guard(owner,"image",args.client_request_id,hash);if(prior)return prior;
    if(args.format==="ai_studio"&&(args.reference_image_asset_ids.length>1||args.attached_image_asset_ids.length||args.regeneration_image_asset_id))
      throw new ToolFailure("INVALID_GENERATION_INPUT","AI Studio accepts one image reference. Use slideshow for style/attachment/edit-target references.");
    const style=await Promise.all(args.reference_image_asset_ids.map(id=>reference(owner,id,"image")));
    const attachments = await Promise.all([...args.attached_image_asset_ids,...(args.regeneration_image_asset_id?[args.regeneration_image_asset_id]:[])].map(id=>reference(owner,id,"image")));
    const body:GenerateRequest={prompt:args.prompt,aspectRatio:args.aspect_ratio,model:args.model,quantity:args.count,
      ...(args.format==="slideshow"?{exploreFormat:"slideshow",...(style.length?{referenceImageUrls:style.map(row=>row.url)}:{}),
        ...(args.attached_image_asset_ids.length?{referenceImageAssetIds:args.attached_image_asset_ids}:{}),
        ...(args.regeneration_image_asset_id?{regenerationImageAssetId:args.regeneration_image_asset_id}:{})}:style.length?{referenceImageUrl:style[0].url}:{})};
    const { generateAIStudioImageForOwner } = await import("@/lib/ai-studio/image-generation-api");
    return responseResult(await generateAIStudioImageForOwner(owner,body,args.client_request_id,{startBatch:batch=>start(owner,"image",args.client_request_id,hash,batch.amountPerImage,batch.inputs,referenceSnapshot([...style,...attachments]))}));
  }));
  server.registerTool("generate_video_with_options",{
    description:"Generate requested AI Studio, Hook or Wall-of-Text videos using the application's model/quality/duration and owned reference options. Gallery reference and paired soundtrack provenance are resolved by the existing server validator. May spend credits. Save a fresh client UUID and exact inputs; recover with get_generation_request. Private audio-library IDs must first become supported media references. Never generate for connectivity checks.",
    inputSchema:advancedVideoInput,outputSchema:batchResult,annotations:write,scopeChallenge:requireScopes("generation:write"),_meta:oauthMetadata("generation:write"),
  },(args,ctx)=>executeTool(async()=>{
    const owner=principal(ctx,"generation:write"),hash=fingerprint("video",args);
    const prior=await guard(owner,"video",args.client_request_id,hash);if(prior)return prior;
    if (!(getAIStudioVideoDurations(args.model) as readonly number[]).includes(args.duration_seconds))
      throw new ToolFailure("INVALID_GENERATION_INPUT", "Choose a duration listed for the selected model. Requested durations are never silently shortened.");
    const images=await Promise.all(args.reference_image_asset_ids.map(id=>reference(owner,id,"image")));
    const audio=await Promise.all(args.reference_audio_asset_ids.map(id=>reference(owner,id,"audio")));
    const video=args.reference_video_asset_id?await reference(owner,args.reference_video_asset_id,"video"):null;
    const body:GenerateVideoRequest={prompt:args.prompt,aspectRatio:args.aspect_ratio,model:args.model,quantity:args.count,
      resolution:args.resolution,durationSeconds:args.duration_seconds,referenceImageUrls:images.map(row=>row.url),
      referenceAudioUrls:audio.map(row=>row.url),referenceAudioAssetIds:args.reference_audio_asset_ids,
      ...(video?{referenceVideoUrl:video.url,referenceVideoAssetId:video.id,referenceVideoDurationSeconds:video.duration_seconds}:{}),
      ...(args.format!=="ai_studio"?{exploreFormat:args.format,referenceType:args.format}:{}),
      ...(args.reference_video_mode?{referenceVideoMode:args.reference_video_mode}:{}),
      ...(args.reference_id?{referenceId:args.reference_id}:{}),useGalleryVideoReference:args.use_gallery_video_reference};
    const { generateAIStudioVideoForOwner } = await import("@/lib/ai-studio/video-generation-api");
    return responseResult(await generateAIStudioVideoForOwner(owner,body,args.client_request_id,{startBatch:batch=>start(owner,"video",args.client_request_id,hash,batch.amountPerVideo,batch.inputs,referenceSnapshot([...images,...audio,...(video?[video]:[])]))}));
  }));
}
