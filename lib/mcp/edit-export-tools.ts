import "server-only";
import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { EditDraftError, editDraftRevision } from "@/lib/edit/draft-contract";
import { editExportRuntime, getEditExportForOwner, startEditExportForOwner } from "@/lib/edit/export-service";
import { executeTool, oauthMetadata, principal, ToolFailure } from "./read-tools";

export const registeredEditExportMcpTools=["get_edit_export_capabilities","export_edit_draft","get_edit_export"] as const;
const result=z.strictObject({request_id:z.uuid(),draft_id:z.uuid().nullable(),revision:editDraftRevision.nullable(),job_id:z.uuid().nullable(),
  outcome:z.enum(["unconfirmed","pending","completed","failed","cancelled","output_unavailable"]),status:z.string().nullable(),
  progress:z.number().min(0).max(100).nullable(),output_asset_ids:z.array(z.uuid()).max(1),message:z.string()});
const readOnly={readOnlyHint:true,destructiveHint:false,openWorldHint:false} as const;
async function errors<T>(run:()=>Promise<T>) {
  try{return await run();}catch(e){if(e instanceof EditDraftError)throw new ToolFailure(e.code,e.message,e.status>=500);
    if(e instanceof ToolFailure)throw e;
    throw new ToolFailure("EXPORT_UNAVAILABLE","Could not confirm the Edit export. Keep the request ID and check its status.",true);}
}
export function registerEditExportMcpTools(server:McpServer) {
  server.registerTool("get_edit_export_capabilities",{
    description:"Check dedicated Edit-page export availability without submitting a render. Uses the application's existing trim/text renderer and saved draft revisions.",
    inputSchema:z.strictObject({}),outputSchema:z.strictObject({available:z.boolean(),reason:z.enum(["available","not_enabled","not_configured"]),
      ratios:z.array(z.enum(["9:16","1:1","4:5","16:9"])),required_write_scope:z.literal("creative:write")}),annotations:readOnly,
    scopeChallenge:requireScopes("account:read"),_meta:oauthMetadata("account:read"),
  },(_,ctx)=>executeTool(async()=>{
    principal(ctx,"account:read");const runtime=editExportRuntime();
    const reason=!runtime.enabled?"not_enabled":!runtime.configured?"not_configured":"available";
    return {available:reason==="available",reason,ratios:["9:16","1:1","4:5","16:9"],required_write_scope:"creative:write"};
  }));
  server.registerTool("export_edit_draft",{
    description:"Render the selected SAVED Edit-page draft revision with the website's renderer. Read/save the draft first. This submits real video processing; use only for a requested export. Save a request UUID and reuse it with identical draft ID/revision after interruption; it recovers one durable job without rendering newer edits. Returns a receipt, not an immediate download. Check get_edit_export, then get_asset for the ready output.",
    inputSchema:z.strictObject({draft_id:z.uuid(),expected_revision:editDraftRevision,request_id:z.uuid()}),
    outputSchema:result.extend({replayed:z.boolean()}),annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false},
    scopeChallenge:requireScopes("creative:write"),_meta:oauthMetadata("creative:write"),
  },(args,ctx)=>executeTool(()=>errors(()=>startEditExportForOwner({userId:principal(ctx,"creative:write"),draftId:args.draft_id,
    requestId:args.request_id,expectedRevision:args.expected_revision}))));
  server.registerTool("get_edit_export",{
    description:"Read one owned Edit export by its saved request UUID. Does not submit, requeue or regenerate media. Recover the exported revision/job and verified ready output asset ID; remains available when creation is disabled. Removed outputs are reported as unavailable.",
    inputSchema:z.strictObject({request_id:z.uuid()}),outputSchema:result,annotations:readOnly,
    scopeChallenge:requireScopes("jobs:read"),_meta:oauthMetadata("jobs:read"),
  },(args,ctx)=>executeTool(()=>errors(()=>getEditExportForOwner(principal(ctx,"jobs:read"),args.request_id))));
}
