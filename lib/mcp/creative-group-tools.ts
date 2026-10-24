import "server-only";
import {McpServer,requireScopes} from "@modelcontextprotocol/server";
import {z} from "zod";
import {confirmableOutputSchema,confirmTokenInput,confirmedToolDescription,omitConfirmToken,requireConfirmation} from "./confirm-token";
import {executeTool,oauthMetadata,principal,ToolFailure} from "./read-tools";
import {groupSchema,groupStateSchema,groupReceiptSchema,getCreativeGroupState,listCreativeGroups,listCreativeGroupItems,mutateCreativeGroup,getCreativeGroupRequest,listCreativeGroupRequests} from "./creative-group-service";
const id=z.uuid(),revision=z.string().regex(/^[a-f0-9]{64}$/),type=z.enum(["video","image"]);
const paging={limit:z.number().int().min(1).max(50).default(20),cursor:z.string().min(1).max(1024).optional()};
const assets=z.array(id).min(1).max(100).refine(a=>new Set(a.map(v=>v.toLowerCase())).size===a.length,"Choose distinct media IDs.");
const name=z.string().trim().min(1).max(80);
const readOnly={readOnlyHint:true,destructiveHint:false,openWorldHint:false} as const;
export const registeredCreativeGroupMcpTools=["get_asset_group_capabilities","list_asset_groups","get_asset_group","list_asset_group_items","create_asset_group","rename_asset_group","delete_asset_group","add_assets_to_group","remove_assets_from_group","get_asset_group_request","list_asset_group_requests"] as const;
export function registerCreativeGroupMcpTools(server:McpServer){
 server.registerTool("get_asset_group_capabilities",{description:"Read Creative Asset group support and write gate. No media writes, billing, schema changes or rendering.",inputSchema:z.strictObject({}),
  outputSchema:z.strictObject({media_types:z.array(type),write_enabled:z.boolean(),storage_configured:z.boolean(),schema_verification_required:z.literal(true),max_name_characters:z.literal(80),max_membership_batch:z.literal(100),required_write_scope:z.literal("assets:write"),deleting_group_preserves_media:z.literal(true),requires_saved_revision:z.literal(true)}),annotations:readOnly,scopeChallenge:requireScopes("account:read"),_meta:oauthMetadata("account:read")},
  async(_args,ctx)=>executeTool(async()=>{principal(ctx,"account:read");return{media_types:["video","image"],write_enabled:process.env.MCP_CREATIVE_GROUPS_ENABLED==="true",storage_configured:Boolean((process.env.SUPABASE_URL?.trim()||process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())&&process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),schema_verification_required:true,max_name_characters:80,max_membership_batch:100,required_write_scope:"assets:write",deleting_group_preserves_media:true,requires_saved_revision:true};}));
 server.registerTool("list_asset_groups",{description:"Browse this account's application Creative Asset video/image groups. Generic assets and Carousel Library are separate surfaces.",inputSchema:z.strictObject({media_type:type,...paging}),
  outputSchema:z.strictObject({items:z.array(groupSchema).max(50),next_cursor:z.string().nullable()}),annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},
  (args,ctx)=>executeTool(()=>listCreativeGroups(principal(ctx,"assets:read"),args)));
 server.registerTool("get_asset_group",{description:"Read an owned group and revision covering its metadata and full membership. Save this revision before a requested change; reading does not mutate it.",inputSchema:z.strictObject({group_id:id}),outputSchema:groupStateSchema,annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},
  ({group_id},ctx)=>executeTool(()=>getCreativeGroupState(principal(ctx,"assets:read"),group_id)));
 server.registerTool("list_asset_group_items",{description:"Browse an owned group's exact membership at its saved revision. Unavailable members are marked without leaking removed media metadata; get_asset delivers ready media. A changing group requires a fresh read.",inputSchema:z.strictObject({group_id:id,expected_revision:revision,...paging}),
  outputSchema:z.strictObject({state:groupStateSchema,items:z.array(z.strictObject({asset_id:id,added_at:z.string(),available:z.boolean(),title:z.string().nullable()})).max(50),next_cursor:z.string().nullable()}),annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},
  (args,ctx)=>executeTool(()=>listCreativeGroupItems(principal(ctx,"assets:read"),args)));
 const output=z.strictObject({replayed:z.boolean(),receipt:groupReceiptSchema});
 const operations=[
  {tool:"create_asset_group",op:"create",description:"Create a requested application Creative Asset group. Caller request_id is also its stable group ID; preserve identical inputs for recovery. No media is created.",schema:z.strictObject({request_id:id,name,media_type:type,confirm_token:confirmTokenInput})},
  {tool:"rename_asset_group",op:"rename",description:"Rename the selected owned group at its exact revision. Stale metadata/membership returns a conflict without overwriting newer website changes.",schema:z.strictObject({request_id:id,group_id:id,expected_revision:revision,name,confirm_token:confirmTokenInput})},
  {tool:"delete_asset_group",op:"delete",description:"Delete the selected group and its membership at an exact revision. Preserves all media files/library assets. This group removal has no application undo; only perform when explicitly requested.",schema:z.strictObject({request_id:id,group_id:id,expected_revision:revision,confirm_token:confirmTokenInput})},
  {tool:"add_assets_to_group",op:"add",description:"Add 1-100 selected owned ready Creative Assets matching the group type, atomically at its exact revision. Full batch rejects invalid/foreign/hidden inputs; preserves a receipt before responding.",schema:z.strictObject({request_id:id,group_id:id,expected_revision:revision,asset_ids:assets,confirm_token:confirmTokenInput})},
  {tool:"remove_assets_from_group",op:"remove",description:"Remove selected membership links at the group's exact revision. Preserves all media and other groups. Unavailable members may be removed using their verified membership IDs.",schema:z.strictObject({request_id:id,group_id:id,expected_revision:revision,asset_ids:assets,confirm_token:confirmTokenInput})},
 ] as const;
 const groupConfirm={
  create:{effect:"mutate" as const,summary:"Create the requested Creative Asset group. No media files are created."},
  rename:{effect:"mutate" as const,summary:"Rename the selected Creative Asset group at its saved revision."},
  delete:{effect:"delete" as const,summary:"Delete the selected Creative Asset group and its membership. Media files stay in the library."},
  add:{effect:"mutate" as const,summary:"Add the selected media to the Creative Asset group."},
  remove:{effect:"mutate" as const,summary:"Remove the selected membership links. Media files stay in the library."},
 };
 for(const operation of operations){
  const preview=groupConfirm[operation.op];
  server.registerTool(operation.tool,{description:confirmedToolDescription(operation.description+" Save the request UUID/inputs before submission; recover interruption using get_asset_group_request."),inputSchema:operation.schema,outputSchema:confirmableOutputSchema(output),
  annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false,idempotentHint:true},scopeChallenge:requireScopes("assets:write"),_meta:oauthMetadata("assets:write")},
  (args:z.infer<typeof operation.schema> & {confirm_token?:string},ctx:Parameters<typeof principal>[0])=>executeTool(async()=>{
    const owner=principal(ctx,"assets:write");
    const {request_id,...input}=omitConfirmToken(args);
    const groupId="group_id" in args && typeof args.group_id==="string"?args.group_id:request_id;
    return requireConfirmation({tool:operation.tool,accountId:owner,args,effect:preview.effect,summary:preview.summary,creditCost:0,creditCostIsEstimate:false,affected:[{type:"asset_group",id:groupId,label:"Creative Asset group"}],run:()=>{
      if(process.env.MCP_CREATIVE_GROUPS_ENABLED!=="true")throw new ToolFailure("LIBRARY_WRITES_DISABLED","IDE group writes are not enabled. Saved receipts remain readable.");
      return mutateCreativeGroup(owner,request_id.toLowerCase(),operation.op,input);
    }});
  }));
 }
 server.registerTool("get_asset_group_request",{description:"Recover the immutable owned result of an accepted group change without reapplying it. Later website edits/deletions are preserved; receipt state is historical, use get_asset_group for current state.",inputSchema:z.strictObject({request_id:id}),outputSchema:z.strictObject({receipt:groupReceiptSchema}),annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},
  ({request_id},ctx)=>executeTool(()=>getCreativeGroupRequest(principal(ctx,"assets:read"),request_id.toLowerCase())));
 server.registerTool("list_asset_group_requests",{description:"Discover lost owned group-change request UUIDs and operation timestamps. Does not expose another account or repeat changes.",inputSchema:z.strictObject(paging),outputSchema:z.strictObject({items:z.array(z.strictObject({request_id:id,operation:z.enum(["create","rename","delete","add","remove"]),created_at:z.string()})).max(50),next_cursor:z.string().nullable()}),annotations:readOnly,scopeChallenge:requireScopes("assets:read"),_meta:oauthMetadata("assets:read")},
  (args,ctx)=>executeTool(()=>listCreativeGroupRequests(principal(ctx,"assets:read"),args)));
}
