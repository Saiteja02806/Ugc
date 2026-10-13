import "server-only";
import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { AudioError } from "@/worker/src/lib/audio-contract";
import { audioVideoImportInput, audioVideoImportResult, importAudioForVideo, getAudioVideoImportForOwner } from "@/lib/audio/video-import";
import { executeTool, oauthMetadata, principal, ToolFailure } from "./read-tools";

export const registeredAudioVideoImportMcpTools=["import_audio_for_video","get_audio_video_import"] as const;
async function errors<T>(run:()=>Promise<T>){
  try{return await run();}catch(error){
    if(error instanceof ToolFailure)throw error;
    if(error instanceof AudioError)throw new ToolFailure(error.status===409?"AUDIO_IMPORT_CONFLICT":error.status===403?"AUDIO_INELIGIBLE":error.status===429?"UPLOAD_QUOTA_EXCEEDED":"AUDIO_IMPORT_UNAVAILABLE",error.message,error.status>=500||error.status===429);
    throw new ToolFailure("AUDIO_IMPORT_UNAVAILABLE","Audio import could not be confirmed. Preserve its request ID and check it before trying again.",true);
  }
}
export function registerAudioVideoImportMcpTools(server:McpServer){
  server.registerTool("import_audio_for_video",{
    description:"Copy explicitly selected owned ready saved audio into an independent video-editing audio snapshot, matching the website's attachment flow. Excludes voice references and free tests. Save a request UUID before calling; reuse it after a lost response. Only a ready media_asset_id can be used as finish_video's demoAudioAssetId or backgroundAssetId. Uses the current media-upload storage policy; the private original remains private. Does not render or charge generation credits. import_id identifies this separate copy for delete_asset, including a pending copy; deleting it does not delete the original private audio.",
    inputSchema:audioVideoImportInput,outputSchema:audioVideoImportResult,
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},
    scopeChallenge:requireScopes("assets:write"),_meta:oauthMetadata("assets:write"),
  },(args,ctx)=>executeTool(()=>errors(()=>importAudioForVideo(principal(ctx,"assets:write"),args))));
  server.registerTool("get_audio_video_import",{
    description:"Recover a saved audio-to-video import by its CLIENT request UUID. Read-only: never copies bytes, creates a reservation, or renders. Unconfirmed does not prove no request was accepted. import_id identifies this separate copy for delete_asset; media_asset_id is ready-only for finishing. A ready media_asset_id is a separate editing snapshot, usable even if its original audio is later retired.",
    inputSchema:z.strictObject({request_id:z.uuid()}),outputSchema:audioVideoImportResult,
    annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},
    scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read"),
  },(args,ctx)=>executeTool(()=>errors(()=>getAudioVideoImportForOwner(principal(ctx,"assets:read"),args.request_id))));
}
