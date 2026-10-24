import "server-only";
import { McpServer,requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { confirmableOutputSchema,confirmedToolDescription,omitConfirmToken,requireConfirmation,withConfirmToken } from "./confirm-token";
import { executeTool,oauthMetadata,principal } from "./read-tools";
import { businessContextOperationSchema,businessContextStateSchema,businessContextReceiptSchema,businessContextResultSchema,businessContextSaveSchema,businessContextWriteSchema } from "./business-context-contract";
import { businessContextStorageConfigured,getMcpBusinessContextRequest,listMcpBusinessContextRequests,mutateMcpBusinessContext,readMcpBusinessContext,withBusinessContextReadiness } from "./business-context-service";

const readOnly={readOnlyHint:true,destructiveHint:false,openWorldHint:false} as const;
export const registeredBusinessContextMcpTools=["get_business_context_capabilities","get_business_context","save_business_context_draft","apply_business_context","get_business_context_request","list_business_context_requests"] as const;
export function registerBusinessContextMcpTools(server:McpServer) {
  server.registerTool("get_business_context_capabilities",{description:"Read Business Context editing gate and limits. Does not analyze a website, initialize onboarding, alter a profile or generate content.",inputSchema:z.strictObject({}),
    outputSchema:z.strictObject({write_enabled:z.boolean(),storage_configured:z.boolean(),schema_verification_required:z.literal(true),required_write_scope:z.literal("brand:write"),reanalyze_available:z.literal(false),onboarding_available:z.literal(true),future_content_only:z.literal(true)}),annotations:readOnly,scopeChallenge:requireScopes("brand:read"),_meta:oauthMetadata("brand:read")},
    (_args,ctx)=>executeTool(async()=>{principal(ctx,"brand:read");return {write_enabled:process.env.MCP_BUSINESS_CONTEXT_WRITES_ENABLED==="true",storage_configured:businessContextStorageConfigured(),schema_verification_required:true,required_write_scope:"brand:write",reanalyze_available:false,onboarding_available:true,future_content_only:true};}));
  server.registerTool("get_business_context",{description:"Read the active Business Context, goals and shared Settings draft with exact revisions and factual readiness. Missing profile is null. Reads never start analysis, onboarding or content generation.",inputSchema:z.strictObject({}),
    outputSchema:businessContextStateSchema.extend({draft_readiness:z.strictObject({fact_count:z.number().int().nonnegative(),status:z.enum(["ready","needs_facts"])}).nullable()}),annotations:readOnly,scopeChallenge:requireScopes("brand:read"),_meta:oauthMetadata("brand:read")},
    (_args,ctx)=>executeTool(async()=>withBusinessContextReadiness(await readMcpBusinessContext(principal(ctx,"brand:read")))));
  for(const {operation,tool} of [{operation:"save_draft",tool:"save_business_context_draft"},{operation:"apply",tool:"apply_business_context"}] as const){
    const description=operation==="apply"?"Apply exactly reviewed Business Context to a new active profile version using the website's atomic promotion. Requires factual anchors, current context/profile/draft revisions, fresh brand:write consent and enabled gate. Existing content and today's pinned pack stay unchanged; next local-day content uses the new version. Preserve UUID and exact inputs for recovery.":"Save the requested Business Context into the application's shared Settings draft without changing active profile/version. Preserves saved goals and rejects stale context/profile/draft revisions. No provider request. Requires brand:write and enabled gate; preserve UUID and exact inputs.";
    server.registerTool(tool,{description:confirmedToolDescription(description),
      inputSchema:withConfirmToken(operation==="apply"?businessContextWriteSchema:businessContextSaveSchema),outputSchema:confirmableOutputSchema(businessContextResultSchema),annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false,idempotentHint:true},scopeChallenge:requireScopes("brand:write"),_meta:oauthMetadata("brand:write")},
      (args,ctx)=>executeTool(async()=>{
        const owner=principal(ctx,"brand:write");
        const {request_id,...input}=omitConfirmToken(args);
        return requireConfirmation({tool,accountId:owner,args,effect:"mutate_profile",summary:operation==="apply"?"Apply the reviewed Business Context as the new active profile version.":"Save Business Context into the shared Settings draft without changing the active profile.",creditCost:0,creditCostIsEstimate:false,affected:[{type:"business_context",id:request_id,label:operation==="apply"?"Active business profile":"Business Context draft"}],run:()=>mutateMcpBusinessContext(owner,request_id,operation,input)});
      }));
  }
  server.registerTool("get_business_context_request",{description:"Recover an owned immutable accepted Business Context receipt without repeating a save or apply. Its state is historical; get_business_context reads current website state. Works while writes are disabled.",inputSchema:z.strictObject({request_id:z.uuid()}),outputSchema:z.strictObject({receipt:businessContextReceiptSchema}),annotations:readOnly,scopeChallenge:requireScopes("brand:read"),_meta:oauthMetadata("brand:read")},
    ({request_id},ctx)=>executeTool(()=>getMcpBusinessContextRequest(principal(ctx,"brand:read"),request_id)));
  server.registerTool("list_business_context_requests",{description:"Discover accepted Business Context request UUIDs after interruption using owner-scoped stable paging. Never repeats a mutation.",inputSchema:z.strictObject({limit:z.number().int().min(1).max(50).default(20),cursor:z.string().min(1).max(1024).optional()}),
    outputSchema:z.strictObject({items:z.array(z.strictObject({request_id:z.uuid(),operation:businessContextOperationSchema,created_at:z.string()})).max(50),next_cursor:z.string().nullable()}),annotations:readOnly,scopeChallenge:requireScopes("brand:read"),_meta:oauthMetadata("brand:read")},
    (args,ctx)=>executeTool(()=>listMcpBusinessContextRequests(principal(ctx,"brand:read"),args)));
}
