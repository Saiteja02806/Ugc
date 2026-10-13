import "server-only";
import { McpServer, requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { isBackgroundOnboardingEnabled } from "../business-profiles/onboarding-rollout";
import { getMissingBackgroundJobCloudTasksEnvVars } from "../jobs/gcp-cloud-tasks";
import { businessContextStorageConfigured } from "./business-context-service";
import { onboardingStateSchema, onboardingMutationSchema, onboardingMutationResultSchema, onboardingReceiptSchema } from "./business-onboarding-contract";
import { readMcpBusinessOnboarding, mutateMcpBusinessOnboarding, getMcpBusinessOnboardingRequest, listMcpBusinessOnboardingRequests } from "./business-onboarding-service";
import { executeTool, oauthMetadata, principal } from "./read-tools";

export const registeredBusinessOnboardingMcpTools = ["get_business_onboarding_capabilities", "get_business_onboarding", "mutate_business_onboarding", "get_business_onboarding_request", "list_business_onboarding_requests"] as const;
const readOnly = { readOnlyHint:true, destructiveHint:false, openWorldHint:false } as const;
export function registerBusinessOnboardingMcpTools(server: McpServer) {
  server.registerTool("get_business_onboarding_capabilities", {
    description:"Read onboarding storage, background enrollment and analysis queue configuration. Read capability calls never start analysis, grant application access or prepare content. Saved mode must be read with get_business_onboarding; enrollment does not replace persisted legacy/draft state.",
    inputSchema:z.strictObject({}), outputSchema:z.strictObject({ storage_configured:z.boolean(), analysis_queue_configured:z.boolean(), background_enrolled:z.boolean(),
      write_tools_available:z.literal(true), write_enabled:z.boolean(), schema_verification_required:z.literal(true), required_write_scope:z.literal("brand:write"), completion_can_prepare_trending:z.literal(true) }),
    annotations:readOnly, scopeChallenge:requireScopes("brand:read"), _meta:oauthMetadata("brand:read"),
  }, (_args,ctx) => executeTool(async () => {
    const owner = principal(ctx,"brand:read");
    return { storage_configured:businessContextStorageConfigured(), analysis_queue_configured:getMissingBackgroundJobCloudTasksEnvVars(["media_analysis"]).length===0,
      background_enrolled:isBackgroundOnboardingEnabled(owner), write_tools_available:true, write_enabled:process.env.MCP_BUSINESS_ONBOARDING_WRITES_ENABLED==="true", schema_verification_required:true, required_write_scope:"brand:write", completion_can_prepare_trending:true };
  }));
  server.registerTool("get_business_onboarding", {
    description:"Read your existing website onboarding mode, profile completion, saved background answers and analysis/finalization job IDs, or the latest 20 legacy setup jobs. Missing profile/draft is null. Never starts or retries analysis, submits setup, changes goals/logos or renders content. Job IDs can be used with get_job for current status. Reads are observations, not an atomic mutation receipt.",
    inputSchema:z.strictObject({}), outputSchema:onboardingStateSchema, annotations:readOnly, scopeChallenge:requireScopes("brand:read"), _meta:oauthMetadata("brand:read"),
  }, (_args,ctx) => executeTool(() => readMcpBusinessOnboarding(principal(ctx,"brand:read"))));
  server.registerTool("mutate_business_onboarding", {
    description:"Start or resume the application's saved onboarding: website, manual details/description or mobile-app IDE facts; save identity and verified owned logo; save goals; submit goals/timezone; reopen a background submission. Use the exact expected_state from get_business_onboarding and a saved UUID. Omit logo_storage_key to preserve the current logo, null to remove it. Legacy edit/reopen is unsupported. Requires brand:write, deployed schema and an enabled write gate. Start can analyze a source; submit can activate application access/trial and prepare Trending content. Preserve exact UUID/inputs; recover receipts after a lost response before any new action.",
    inputSchema:onboardingMutationSchema, outputSchema:onboardingMutationResultSchema,
    annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:true},scopeChallenge:requireScopes("brand:write"),_meta:oauthMetadata("brand:write"),
  },(args,ctx)=>executeTool(()=>mutateMcpBusinessOnboarding(principal(ctx,"brand:write"),args)));
  server.registerTool("get_business_onboarding_request", {
    description:"Recover your immutable accepted onboarding receipt and durable job IDs without repeating the action. Accepted answers/profile are historical; get_business_onboarding reads current progress. Works while onboarding writes are disabled. Use get_operation/retry_operation only under their supported job policies.",
    inputSchema:z.strictObject({request_id:z.uuid()}),outputSchema:z.strictObject({receipt:onboardingReceiptSchema}),annotations:readOnly,scopeChallenge:requireScopes("brand:read"),_meta:oauthMetadata("brand:read"),
  },({request_id},ctx)=>executeTool(()=>getMcpBusinessOnboardingRequest(principal(ctx,"brand:read"),request_id)));
  server.registerTool("list_business_onboarding_requests", {
    description:"Discover your accepted onboarding UUIDs with stable owner-bound paging after interruption. Never repeats setup, submits goals or prepares content.",
    inputSchema:z.strictObject({limit:z.number().int().min(1).max(50).default(20),cursor:z.string().min(1).max(1024).optional()}),
    outputSchema:z.strictObject({items:z.array(z.strictObject({request_id:z.uuid(),mode:z.enum(["legacy","background"]),action:z.enum(["start","identity","goals","submit","edit"]),created_at:z.string()})).max(50),next_cursor:z.string().nullable()}),
    annotations:readOnly,scopeChallenge:requireScopes("brand:read"),_meta:oauthMetadata("brand:read"),
  },(args,ctx)=>executeTool(()=>listMcpBusinessOnboardingRequests(principal(ctx,"brand:read"),args)));
}
