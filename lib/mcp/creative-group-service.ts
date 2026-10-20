import "server-only";
import {createHash} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {z} from "zod";
import {getMediaAssetForOwner} from "@/lib/media/media-storage";
import {isMediaAssetVisibleInCreativeLibrary} from "@/lib/media/media-library-visibility";
import {ToolFailure} from "./read-tools";

const id=z.uuid(),revision=z.string().regex(/^[a-f0-9]{64}$/),mediaType=z.enum(["video","image"]);
export const groupSchema=z.strictObject({id,name:z.string().min(1).max(80),media_type:mediaType,created_at:z.string(),updated_at:z.string()});
export const groupStateSchema=z.strictObject({group:groupSchema,member_count:z.number().int().nonnegative(),revision});
export const groupReceiptSchema=z.strictObject({request_id:id,operation:z.enum(["create","rename","delete","add","remove"]),group_id:id,
  changed_count:z.number().int().min(0).max(100),group_exists:z.boolean(),state:groupStateSchema.nullable()});
const cursorSchema=z.strictObject({v:z.literal(1),binding:revision,time:z.string().datetime({offset:true}),id});
function client(){const url=process.env.SUPABASE_URL?.trim()||process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key)throw new ToolFailure("LIBRARY_UNAVAILABLE","Creative Asset group storage is not configured.",true);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
function binding(owner:string,filters:unknown){return createHash("sha256").update(JSON.stringify({owner,filters})).digest("hex");}
function decodeCursor(cursor:string|undefined,bind:string){if(!cursor)return null;try{if(!/^[A-Za-z0-9_-]+$/.test(cursor))throw Error();
  const value=cursorSchema.parse(JSON.parse(Buffer.from(cursor,"base64url").toString("utf8")));if(value.binding!==bind)throw Error();return value;
}catch{throw new ToolFailure("INVALID_CURSOR","Start from the first page with this account's current filters and group revision.");}}
function nextCursor(bind:string,time:string,id:string){return Buffer.from(JSON.stringify({v:1,binding:bind,time,id})).toString("base64url");}
function failure(error:{message?:string}|null):never {const m=error?.message??"";
  for(const code of ["group_request_conflict","group_revision_conflict","group_not_found","group_id_conflict","group_asset_unavailable","invalid_group_request"]){
    if(m.includes(code))throw new ToolFailure(code==="group_not_found"?"NOT_FOUND":code==="group_asset_unavailable"?"ASSET_UNAVAILABLE":code.startsWith("invalid")?"INVALID_INPUT":"GROUP_CONFLICT",
      code==="group_revision_conflict"?"The group changed. Read its current revision before requesting a new change.":code==="group_request_conflict"?"This request UUID belongs to different group changes. Recover the accepted request first.":code==="group_not_found"?"This group is unavailable to your account.":code==="group_asset_unavailable"?"Every selected asset must be ready, owned, visible in Creative Assets and match the group's media type.":"Choose valid group inputs and an unused create identity.");
  }throw new ToolFailure("LIBRARY_UNAVAILABLE","The group change could not be confirmed. Keep its request UUID and check the saved receipt before retrying.",true);
}
export async function getCreativeGroupState(owner:string,groupId:string){const{data,error}=await client().rpc("mcp_read_creative_asset_group",{p_user_id:owner,p_group_id:groupId});if(error)failure(error);
  if(!data)throw new ToolFailure("NOT_FOUND","This group is unavailable to your account.");return groupStateSchema.parse(data);}
export async function listCreativeGroups(owner:string,input:{media_type:"image"|"video";limit:number;cursor?:string}){
  const bind=binding(owner,{media_type:input.media_type}),cursor=decodeCursor(input.cursor,bind);
  let query=client().from("creative_asset_groups").select("id,name,media_type,created_at,updated_at").eq("user_id",owner).eq("media_type",input.media_type)
    .order("updated_at",{ascending:false}).order("id",{ascending:false}).limit(input.limit+1);
  if(cursor)query=query.or(`updated_at.lt.${cursor.time},and(updated_at.eq.${cursor.time},id.lt.${cursor.id})`);
  const{data,error}=await query;if(error)failure(error);const rows=(data??[]).slice(0,input.limit).map(row=>groupSchema.parse(row)),last=rows.at(-1);
  return{items:rows,next_cursor:data&&data.length>input.limit&&last?nextCursor(bind,last.updated_at,last.id):null};
}
export async function mutateCreativeGroup(owner:string,requestId:string,operation:string,input:Record<string,unknown>){
  const{data,error}=await client().rpc("mcp_mutate_creative_asset_group",{p_user_id:owner,p_request_id:requestId,p_operation:operation,p_input:input});if(error)failure(error);
  return z.strictObject({replayed:z.boolean(),receipt:groupReceiptSchema}).parse(data);
}
export async function getCreativeGroupRequest(owner:string,requestId:string){const{data,error}=await client().from("mcp_creative_group_requests")
  .select("result_json").eq("user_id",owner).eq("request_id",requestId).maybeSingle();if(error)failure(error);
  if(!data)throw new ToolFailure("NOT_FOUND","This saved group request was not found.");return{receipt:groupReceiptSchema.parse(data.result_json)};}
export async function listCreativeGroupRequests(owner:string,input:{limit:number;cursor?:string}){const bind=binding(owner,{kind:"group_requests"}),cursor=decodeCursor(input.cursor,bind);
  let query=client().from("mcp_creative_group_requests").select("request_id,operation,created_at").eq("user_id",owner).order("created_at",{ascending:false}).order("request_id",{ascending:false}).limit(input.limit+1);
  if(cursor)query=query.or(`created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},request_id.lt.${cursor.id})`);
  const{data,error}=await query;if(error)failure(error);const items=(data??[]).slice(0,input.limit),last=items.at(-1);
  return{items,next_cursor:data&&data.length>input.limit&&last?nextCursor(bind,last.created_at,last.request_id):null};
}
export async function listCreativeGroupItems(owner:string,input:{group_id:string;expected_revision:string;limit:number;cursor?:string}){
  const state=await getCreativeGroupState(owner,input.group_id);if(state.revision!==input.expected_revision)throw new ToolFailure("GROUP_CONFLICT","The group changed. Read its current revision and restart membership browsing.");
  const bind=binding(owner,{group:input.group_id,revision:state.revision}),cursor=decodeCursor(input.cursor,bind);
  let query=client().from("creative_asset_group_items").select("media_asset_id,created_at").eq("user_id",owner).eq("group_id",input.group_id)
    .order("created_at",{ascending:false}).order("media_asset_id",{ascending:false}).limit(input.limit+1);
  if(cursor)query=query.or(`created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},media_asset_id.lt.${cursor.id})`);
  const{data,error}=await query;if(error)failure(error);const members=(data??[]).slice(0,input.limit);
  const items=await Promise.all(members.map(async member=>{const asset=await getMediaAssetForOwner({userId:owner,assetId:member.media_asset_id});
    const visible=Boolean(asset&&asset.status==="ready"&&isMediaAssetVisibleInCreativeLibrary({sourceType:asset.source_type,metadata:asset.metadata})
      &&(state.group.media_type==="image"?asset.collection==="image":["video","influencer"].includes(asset.collection)));
    return {asset_id:member.media_asset_id,added_at:member.created_at,available:visible,title:visible?asset!.title:null};}));
  const latest=await getCreativeGroupState(owner,input.group_id);if(latest.revision!==state.revision)throw new ToolFailure("GROUP_CONFLICT","The group changed while browsing. Read its current revision and restart.");
  const last=members.at(-1);return{state,items,next_cursor:data&&data.length>input.limit&&last?nextCursor(bind,last.created_at,last.media_asset_id):null};
}
