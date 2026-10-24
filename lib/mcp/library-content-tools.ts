import "server-only";
import { McpServer,requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { confirmableOutputSchema,confirmedToolDescription,omitConfirmToken,requireConfirmation,withConfirmToken } from "./confirm-token";
import { executeTool,oauthMetadata,principal } from "./read-tools";
import { libraryStateSchema,libraryReceiptSchema,listCarouselLibrarySources,listLibraryItems,readLibraryItem,inspectCarouselLibrarySave,mutateLibrary,getLibraryRequest,listLibraryRequests } from "./library-content-service";

const id=z.uuid(),revision=z.string().regex(/^[a-f0-9]{64}$/);
const paging={limit:z.number().int().min(1).max(20).default(10),cursor:z.string().min(1).max(1024).optional()};
const readOnly={readOnlyHint:true,destructiveHint:false,openWorldHint:false} as const;
export const registeredLibraryContentMcpTools=["get_library_capabilities","list_library_items","get_library_item","inspect_carousel_library_save","list_carousel_library_sources","save_carousel_to_library","save_slideshow_to_library","remove_library_item","get_library_request","list_library_requests"] as const;
export function registerLibraryContentMcpTools(server:McpServer) {
  server.registerTool("get_library_capabilities",{description:"Read Library save/removal gates and supported source types. A catalogue entry does not prove schema rollout or rendering support.",inputSchema:z.strictObject({}),
    outputSchema:z.strictObject({write_enabled:z.boolean(),slideshow_save_enabled:z.boolean(),storage_configured:z.boolean(),schema_verification_required:z.literal(true),
      source_types:z.array(z.enum(["carousel","slideshow"])),slideshow_text_rendering_available:z.literal(false),requires_saved_revisions:z.literal(true),removal_preserves_source_media:z.literal(true)}),
    annotations:readOnly,scopeChallenge:requireScopes("account:read"),_meta:oauthMetadata("account:read")},
    (_args,ctx)=>executeTool(async()=>{principal(ctx,"account:read");return {write_enabled:process.env.MCP_LIBRARY_WRITES_ENABLED==="true",slideshow_save_enabled:process.env.MCP_LIBRARY_WRITES_ENABLED==="true"&&process.env.EXPLORE_SLIDESHOW_SAVING_ENABLED==="true",
      storage_configured:Boolean((process.env.SUPABASE_URL?.trim()||process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())&&process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),schema_verification_required:true,
      source_types:["carousel","slideshow"],slideshow_text_rendering_available:false,requires_saved_revisions:true,removal_preserves_source_media:true};}));
  server.registerTool("list_library_items",{description:"Browse this account's actual saved Carousel/slideshow Library with ordered rendered slides. Library IDs differ from media asset IDs. Optional removed entries are tombstones; this is not generic demo footage listing.",
    inputSchema:z.strictObject({...paging,project_id:z.string().trim().min(1).max(160).optional(),include_removed:z.boolean().default(false)}),outputSchema:z.strictObject({items:z.array(libraryStateSchema).max(20),next_cursor:z.string().nullable()}),
    annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},(args,ctx)=>executeTool(()=>listLibraryItems(principal(ctx,"assets:read"),args)));
  server.registerTool("get_library_item",{description:"Read the selected owned Library snapshot, ordered rendered outputs, removal state and exact revision. Does not edit, schedule or restore it.",inputSchema:z.strictObject({item_id:id}),outputSchema:libraryStateSchema,
    annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},({item_id},ctx)=>executeTool(()=>readLibraryItem(principal(ctx,"assets:read"),item_id.toLowerCase())));
  server.registerTool("inspect_carousel_library_save",{description:"Resolve the selected owned completed Carousel exactly as the website does, including its latest ready rendered edit. Read source/destination revisions before an intended save; queued/failed/incomplete edits reject without falling back to originals.",inputSchema:z.strictObject({carousel_id:id}),
    outputSchema:z.strictObject({carousel_id:id,source_revision:revision,destination_revision:revision,destination:z.array(libraryStateSchema),title:z.string(),slide_count:z.number().int().positive(),rendered_urls:z.array(z.string()),uses_saved_edit:z.boolean()}),
    annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},({carousel_id},ctx)=>executeTool(()=>inspectCarouselLibrarySave(principal(ctx,"assets:read"),carousel_id.toLowerCase())));
  server.registerTool("list_carousel_library_sources",{description:"Discover owned Carousel generation IDs, including unsaved outputs, using owner/filter-bound pagination. Defaults to completed generations. Inspect the selected source before saving: completion alone does not prove its latest edit is ready.",
    inputSchema:z.strictObject({...paging,project_id:z.string().trim().min(1).max(160).optional(),include_pending:z.boolean().default(false)}),
    outputSchema:z.strictObject({items:z.array(z.strictObject({id,project_id:z.string(),status:z.enum(["processing","completed","failed"]),slide_count:z.number().int().positive(),updated_at:z.string()})).max(20),next_cursor:z.string().nullable()}),
    annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},
    (args,ctx)=>executeTool(()=>listCarouselLibrarySources(principal(ctx,"assets:read"),args)));
  const output=z.strictObject({replayed:z.boolean(),receipt:libraryReceiptSchema});
  server.registerTool("save_carousel_to_library",{description:confirmedToolDescription("Save the intended completed owned Carousel/latest ready edit at the inspected source AND Library revisions. Refreshes an existing snapshot using the website's canonical payload; changed revisions reject. Recreating a removed save requires explicit allow_recreate_removed. Preserve request UUID/inputs before submitting."),
    inputSchema:withConfirmToken(z.strictObject({request_id:id,carousel_id:id,source_revision:revision,destination_revision:revision,allow_recreate_removed:z.boolean().default(false)})),outputSchema:confirmableOutputSchema(output),
    annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false,idempotentHint:true},scopeChallenge:requireScopes("assets:write"),_meta:oauthMetadata("assets:write")},
    (args,ctx)=>executeTool(async()=>{
      const owner=principal(ctx,"assets:write");
      const {request_id,carousel_id,...input}=omitConfirmToken(args);
      return requireConfirmation({tool:"save_carousel_to_library",accountId:owner,args,effect:"mutate",summary:"Save the selected Carousel into the Library at the inspected revisions.",creditCost:0,creditCostIsEstimate:false,affected:[{type:"carousel",id:carousel_id,label:"Carousel library save"}],run:()=>mutateLibrary(owner,request_id.toLowerCase(),"save_carousel",{carousel_id:carousel_id.toLowerCase(),...input})});
    }));
  server.registerTool("save_slideshow_to_library",{description:confirmedToolDescription("Save 2-10 selected owned READY raster outputs in exact order through the application's slideshow validator/transaction. This saves already rendered images; it does not render text overlays. Catalogue references are optional guidance and never silently enter the output. Preserve request UUID/inputs for recovery."),
    inputSchema:withConfirmToken(z.strictObject({request_id:id,reference_id:z.string().min(1).max(160).nullable().default(null),slides:z.array(z.strictObject({position_id:z.string().min(1).max(160),asset_id:id})).min(2).max(10)})),outputSchema:confirmableOutputSchema(output),
    annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false,idempotentHint:true},scopeChallenge:requireScopes("assets:write"),_meta:oauthMetadata("assets:write")},
    (args,ctx)=>executeTool(async()=>{
      const owner=principal(ctx,"assets:write");
      const {request_id,reference_id,slides}=omitConfirmToken(args);
      return requireConfirmation({tool:"save_slideshow_to_library",accountId:owner,args,effect:"mutate",summary:"Save the selected rendered slides into the Library in this order.",creditCost:0,creditCostIsEstimate:false,affected:slides.slice(0,5).map(slide=>({type:"asset",id:slide.asset_id,label:"Slideshow slide"})),run:()=>mutateLibrary(owner,request_id.toLowerCase(),"save_slideshow",{version:2,requestKey:request_id.toLowerCase(),referenceId:reference_id,slides:slides.map(slide=>({referenceSlideId:slide.position_id,mediaAssetId:slide.asset_id.toLowerCase()}))})});
    }));
  server.registerTool("remove_library_item",{description:confirmedToolDescription("Archive the explicitly selected Library entry at its exact revision, matching the application's metadata-only removal. Preserves source media and saved slide files. Existing scheduling rules remain authoritative; this does not cancel or schedule posts. Preserve request UUID/inputs for recovery."),
    inputSchema:withConfirmToken(z.strictObject({request_id:id,item_id:id,expected_revision:revision})),outputSchema:confirmableOutputSchema(output),annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false,idempotentHint:true},scopeChallenge:requireScopes("assets:write"),_meta:oauthMetadata("assets:write")},
    (args,ctx)=>executeTool(async()=>{
      const owner=principal(ctx,"assets:write");
      const {request_id,item_id,expected_revision}=omitConfirmToken(args);
      return requireConfirmation({tool:"remove_library_item",accountId:owner,args,effect:"delete",summary:"Archive the selected Library entry. Source media and slide files stay stored.",creditCost:0,creditCostIsEstimate:false,affected:[{type:"library_item",id:item_id,label:"Library entry"}],run:()=>mutateLibrary(owner,request_id.toLowerCase(),"remove",{item_id:item_id.toLowerCase(),expected_revision})});
    }));
  server.registerTool("get_library_request",{description:"Recover the immutable accepted Library result without repeating its save or removal. Receipt state is historical; get_library_item gives current state. Works after write gates or plan/media readiness change.",inputSchema:z.strictObject({request_id:id}),outputSchema:z.strictObject({receipt:libraryReceiptSchema}),annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},
    ({request_id},ctx)=>executeTool(()=>getLibraryRequest(principal(ctx,"assets:read"),request_id.toLowerCase())));
  server.registerTool("list_library_requests",{description:"Discover this account's accepted Library request UUIDs and timestamps after an interruption. Does not repeat any write.",inputSchema:z.strictObject(paging),outputSchema:z.strictObject({items:z.array(z.strictObject({request_id:id,operation:z.enum(["save_carousel","save_slideshow","remove"]),created_at:z.string()})).max(20),next_cursor:z.string().nullable()}),annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},
    (args,ctx)=>executeTool(()=>listLibraryRequests(principal(ctx,"assets:read"),args)));
}
