import "server-only";
import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { AudioError, AUDIO_MAX_CHARACTERS, AUDIO_MODEL_IDS } from "@/worker/src/lib/audio-contract";
import { audioUploadInput, createAudioUploadForOwner, getAudioDownloadForOwner } from "@/lib/audio/transfer";
import { generateAudioForOwner } from "@/lib/audio/service";
import { audioAssetSchema, audioGenerationSchema, getAudioAssetForOwner, getAudioCapabilitiesForOwner,
  getAudioGenerationForOwner, listAudioForOwner, listAudioVoicesForOwner } from "@/lib/audio/mcp-library";
import { getAudioBookmarks, setAudioBookmark } from "@/lib/audio/bookmarks";
import { getAudioVoiceSelection, setAudioVoiceSelection } from "@/lib/audio/selection";
import { confirmableOutputSchema, confirmedToolDescription, requireConfirmation, withConfirmToken } from "./confirm-token";
import { executeTool, oauthMetadata, principal, ToolFailure } from "./read-tools";

export const registeredAudioMcpTools=["get_audio_capabilities","list_audio_voices","list_audio_assets","get_audio_asset",
  "list_audio_generations","get_audio_generation","generate_audio","get_audio_preferences","set_audio_voice_selection","set_audio_voice_bookmark","create_audio_upload"] as const;
const empty=z.strictObject({}),voiceId=z.string().regex(/^[\w-]{1,100}$/),nullableText=z.string().nullable();
const read={readOnlyHint:true,destructiveHint:false,openWorldHint:false} as const;
const preferenceWrite={readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false} as const;
const pageInput=z.strictObject({limit:z.number().int().min(1).max(50).default(20),cursor:z.string().max(2500).optional()});
const generationResult=z.strictObject({request_id:z.uuid(),confirmed:z.boolean(),generation:audioGenerationSchema.nullable()});
const voice=z.strictObject({id:voiceId,name:z.string(),description:z.string(),labels:z.record(z.string(),z.string()),category:z.string(),
  private:z.boolean(),available:z.boolean(),profile_id:z.uuid().nullable()});
async function audioErrors<T>(run:()=>Promise<T>) {
  try{return await run();}catch(error){
    if(error instanceof ToolFailure)throw error;
    if(error instanceof AudioError){
      const code=error.code==="invalid_cursor"?"INVALID_CURSOR":error.status===404?"NOT_FOUND":error.status===409?"AUDIO_CONFLICT":
        error.status===402?"INSUFFICIENT_CREDITS":error.status===403?"AUDIO_ACCESS_REQUIRED":error.status===429?"AUDIO_ALLOWANCE_EXCEEDED":
        error.status>=500?"AUDIO_UNAVAILABLE":"INVALID_AUDIO_INPUT";
      // Known service errors are sanitized; no database/provider payload is returned.
      throw new ToolFailure(code,error.message,error.status>=500||error.status===429);
    }
    throw new ToolFailure("AUDIO_UNAVAILABLE","Audio could not be confirmed. Preserve the request ID and check its history before submitting again.",true);
  }
}
export function registerAudioMcpTools(server:McpServer) {
  server.registerTool("get_audio_capabilities",{
    description:"Read account-specific audio generation/model/cost readiness without generating speech or modifying private voice verification. Reports MCP upload/download/clone limits separately from website capability.",
    inputSchema:empty,outputSchema:z.strictObject({generation_available:z.boolean(),generation_access:z.enum(["allowed","upgrade_required","unavailable"]),
      credit_cost_per_1000_characters:z.number().int().nonnegative(),max_characters:z.literal(AUDIO_MAX_CHARACTERS),
      speeds:z.strictObject({minimum:z.literal(0.8),maximum:z.literal(1.2)}),models:z.array(z.strictObject({id:z.string(),name:z.string(),languages:z.array(z.string())})),
      catalogue_source:z.enum(["account","public-preview"]),upload_available:z.boolean(),download_available:z.boolean(),voice_clone_available:z.literal(false),video_import_available:z.boolean(),message:z.string()}),
    annotations:read,scopeChallenge:requireScopes("account:read"),_meta:oauthMetadata("account:read"),
  },(_,ctx)=>executeTool(()=>audioErrors(()=>getAudioCapabilitiesForOwner(principal(ctx,"account:read")))));
  server.registerTool("list_audio_voices",{
    description:"Browse the current account's permitted voice catalogue. Public preview voices can be listed without generation access. Read-only: does not verify/promote private voices, generate a sample, or supply a storage URL.",
    inputSchema:empty,outputSchema:z.strictObject({items:z.array(voice),catalogue_source:z.enum(["account","public-preview"]),message:nullableText}),
    annotations:read,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read"),
  },(_,ctx)=>executeTool(()=>audioErrors(()=>listAudioVoicesForOwner(principal(ctx,"assets:read")))));
  server.registerTool("list_audio_assets",{
    description:"Page through owned saved audio metadata, excluding deleted recordings. Audio uses a separate private library. usable_for_video excludes reference recordings and free test audio; these IDs are not generic get_asset IDs. Use import_audio_for_video to create a separate editing snapshot.",
    inputSchema:pageInput,outputSchema:z.strictObject({items:z.array(audioAssetSchema),next_cursor:nullableText}),
    annotations:read,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read"),
  },(args,ctx)=>executeTool(()=>audioErrors(async()=>{
    const page=await listAudioForOwner(principal(ctx,"assets:read"),"assets",args.limit,args.cursor);
    return {items:page.items.map(item=>audioAssetSchema.parse(item)),next_cursor:page.next_cursor};
  })));
  server.registerTool("get_audio_asset",{
    description:"Read owned private audio metadata and an expiring verified download link when ready/configured. Feed the link to the local binary helper; refresh this read if it expires. Free tests/reference recordings stay ineligible for video use. Does not copy or convert the record into a visual-media-library asset.",
    inputSchema:z.strictObject({asset_id:z.uuid()}),outputSchema:z.strictObject({asset:audioAssetSchema,download:z.strictObject({url:z.url().regex(/^https:\/\//),expires_at:z.iso.datetime({offset:true}),mime_type:z.string(),file_size_bytes:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).nullable()}),
    annotations:read,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read"),
  },(args,ctx)=>executeTool(()=>audioErrors(async()=>{const owner=principal(ctx,"assets:read");return {asset:await getAudioAssetForOwner(owner,args.asset_id),download:await getAudioDownloadForOwner(owner,args.asset_id)};})));
  server.registerTool("list_audio_generations",{
    description:"Page through owned website and MCP audio request history with stable request UUIDs, safe states and verified completed generated audio IDs. Hides scripts, provider diagnostics and storage. Does not resume or requeue jobs.",
    inputSchema:pageInput,outputSchema:z.strictObject({items:z.array(audioGenerationSchema),next_cursor:nullableText}),
    annotations:read,scopeChallenge:requireScopes("jobs:read"),_meta:oauthMetadata("jobs:read"),
  },(args,ctx)=>executeTool(()=>audioErrors(async()=>{
    const page=await listAudioForOwner(principal(ctx,"jobs:read"),"generations",args.limit,args.cursor);
    return {items:page.items.map(item=>audioGenerationSchema.parse(item)),next_cursor:page.next_cursor};
  })));
  server.registerTool("get_audio_generation",{
    description:"Recover audio generation by the saved CLIENT request UUID, including after a lost submission response. Unconfirmed does not prove no submission. Read-only across generation rollout/plan changes; never dispatches a job.",
    inputSchema:z.strictObject({request_id:z.uuid()}),outputSchema:generationResult,
    annotations:read,scopeChallenge:requireScopes("jobs:read"),_meta:oauthMetadata("jobs:read"),
  },(args,ctx)=>executeTool(()=>audioErrors(()=>getAudioGenerationForOwner(principal(ctx,"jobs:read"),args.request_id))));
  server.registerTool("generate_audio",{
    description:confirmedToolDescription("Generate requested speech using the application's existing voices, models, plan/rollout/quota/credit rules. May spend credits and provider allowance. Save a new request UUID and exact inputs before submission; recover with get_audio_generation, or replay identical inputs. Do not generate to test connectivity. Output is a private audio-library ID; use get_audio_asset for its expiring download, while video import remains a separate adapter."),
    inputSchema:withConfirmToken(z.strictObject({request_id:z.uuid(),script:z.string().trim().min(1).max(AUDIO_MAX_CHARACTERS),voice_id:voiceId,
      model_id:z.enum(AUDIO_MODEL_IDS),speed:z.number().min(0.8).max(1.2).default(1),name:z.string().trim().min(1).max(100).default("Untitled audio")})),
    outputSchema:confirmableOutputSchema(z.strictObject({request_id:z.uuid(),generation_id:z.uuid(),status:z.string(),test_only:z.boolean(),credits:z.number().int().nonnegative()})),
    annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false},scopeChallenge:requireScopes("generation:write"),_meta:oauthMetadata("generation:write"),
  },(args,ctx)=>executeTool(async()=>{
    const owner=principal(ctx,"generation:write");
    return requireConfirmation({
      tool:"generate_audio",accountId:owner,args,effect:"spend_credits",
      summary:"Generate speech. This may spend credits or provider allowance.",
      creditCost:null,creditCostIsEstimate:true,
      affected:[{type:"audio_request",id:args.request_id,label:args.name}],
      run:()=>audioErrors(async()=>{
        const result=await generateAudioForOwner(owner,{requestKey:args.request_id,script:args.script,voiceId:args.voice_id,modelId:args.model_id,speed:args.speed,name:args.name});
        return {request_id:args.request_id,generation_id:result.id,status:result.status,test_only:result.testOnly,credits:result.credits};
      }),
    });
  }));
  server.registerTool("create_audio_upload",{
    description:"Prepare a requested local audio transfer from measured file metadata/SHA-256. Save the request UUID and exact file/purpose before calling. Returns a short-lived content-bound POST link, not an uploaded asset. Use the local binary helper to send exact bytes; recover with get_audio_generation by the same UUID or renew this identical intent. Three MB/three minute audio limit; uses the website's existing plan/quota/replay service. Never accepts arbitrary source URLs or uploads just to test connection.",
    inputSchema:audioUploadInput,outputSchema:z.strictObject({request_id:z.uuid(),url:z.url().regex(/^https:\/\//),method:z.literal("POST"),headers:z.strictObject({"Content-Type":z.string()}),expires_at:z.iso.datetime({offset:true})}),
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},scopeChallenge:requireScopes("assets:write"),_meta:oauthMetadata("assets:write"),
  },(args,ctx)=>executeTool(()=>audioErrors(()=>createAudioUploadForOwner(principal(ctx,"assets:write"),args))));
  server.registerTool("get_audio_preferences",{
    description:"Read the same saved voice selection and bookmarks as the website. Preferences do not grant access to a voice; resolve IDs against list_audio_voices before generating.",
    inputSchema:empty,outputSchema:z.strictObject({voice_id:voiceId.nullable(),bookmarked_voice_ids:z.array(voiceId)}),
    annotations:read,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read"),
  },(_,ctx)=>executeTool(()=>audioErrors(async()=>{
    const owner=principal(ctx,"assets:read"),[voice_id,bookmarked_voice_ids]=await Promise.all([getAudioVoiceSelection(owner),getAudioBookmarks(owner)]);
    return {voice_id,bookmarked_voice_ids};
  })));
  server.registerTool("set_audio_voice_selection",{
    description:"Save the user's requested voice preference in the website's shared account record. Idempotent assignment; does not grant voice access or generate speech.",
    inputSchema:z.strictObject({voice_id:voiceId}),outputSchema:z.strictObject({voice_id:voiceId}),annotations:preferenceWrite,
    scopeChallenge:requireScopes("assets:write"),_meta:oauthMetadata("assets:write"),
  },(args,ctx)=>executeTool(()=>audioErrors(async()=>{
    await setAudioVoiceSelection(principal(ctx,"assets:write"),args.voice_id);return {voice_id:args.voice_id};
  })));
  server.registerTool("set_audio_voice_bookmark",{
    description:"Bookmark or remove the selected voice bookmark using the same account preferences as the website. Repeating the same assignment is safe. Does not grant voice access or generate speech.",
    inputSchema:z.strictObject({voice_id:voiceId,bookmarked:z.boolean()}),outputSchema:z.strictObject({voice_id:voiceId,bookmarked:z.boolean()}),annotations:preferenceWrite,
    scopeChallenge:requireScopes("assets:write"),_meta:oauthMetadata("assets:write"),
  },(args,ctx)=>executeTool(()=>audioErrors(async()=>{
    await setAudioBookmark(principal(ctx,"assets:write"),args.voice_id,args.bookmarked);return args;
  })));
}
