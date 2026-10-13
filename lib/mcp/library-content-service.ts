import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildGeneratedCarouselLibraryPayload } from "@/lib/library/db";
import { LibraryContentError, prepareGeneratedCarouselLibrarySaveForOwner } from "@/lib/library/save-source";
import { prepareSlideshowSaveForOwner } from "@/lib/explore/slideshow-api";
import { getUserSubscription } from "@/lib/billing/subscription-db";
import { ToolFailure } from "./read-tools";

const id = z.uuid(), revision = z.string().regex(/^[a-f0-9]{64}$/);
export const libraryItemSchema = z.strictObject({
  id, title:z.string(), project_id:z.string(), source_id:z.string(), kind:z.enum(["carousel","slideshow"]),
  cover_url:z.string().nullable(), thumbnail_url:z.string().nullable(), created_at:z.string(), updated_at:z.string(),
  slides:z.array(z.strictObject({id,slide_number:z.number().int().positive(),carousel_generation_id:id.nullable(),
    carousel_slide_id:id.nullable(),headline:z.string().nullable(),subtext:z.string().nullable(),slide_type:z.string().nullable(),
    rendered_url:z.string(),rendered_storage_key:z.string().nullable(),metadata:z.record(z.string(),z.unknown())})),
});
export const libraryStateSchema = z.strictObject({revision,deleted_at:z.string().nullable(),status:z.enum(["ready","archived"]),item:libraryItemSchema});
export const libraryReceiptSchema = z.strictObject({request_id:id,operation:z.enum(["save_carousel","save_slideshow","remove"]),
  item_id:id,created:z.boolean(),state:libraryStateSchema});
const cursorSchema = z.strictObject({v:z.literal(1),binding:revision,time:z.string().datetime({offset:true}),id});
function client() {
  const url=process.env.SUPABASE_URL?.trim()||process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key) throw new ToolFailure("LIBRARY_UNAVAILABLE","Library storage is not configured.",true);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function failure(error: {message?:string}|null):never {
  const message=error?.message??"";
  if(message.includes("library_not_found")) throw new ToolFailure("NOT_FOUND","This Library source or entry is unavailable to your account.");
  if(message.includes("library_removed")||message.includes("explore_slideshow_conflict")) throw new ToolFailure("LIBRARY_CONFLICT","The saved entry was removed or this request belongs to different images. Recover the existing request before submitting new work.");
  if(message.includes("library_request_conflict")) throw new ToolFailure("LIBRARY_CONFLICT","This request UUID belongs to different Library inputs. Recover its accepted result first.");
  if(message.includes("library_source_conflict")||message.includes("library_revision_conflict")||message.includes("duplicate key"))
    throw new ToolFailure("LIBRARY_CONFLICT","The source or Library destination changed. Read current revisions before requesting a new save or removal.");
  if(message.includes("invalid_library_request")||message.includes("explore_slideshow_invalid")||message.includes("explore_slideshow_asset_unavailable"))
    throw new ToolFailure("INVALID_INPUT","Choose ready owned Library sources and valid request inputs.");
  throw new ToolFailure("LIBRARY_UNAVAILABLE","The Library change could not be confirmed. Keep the request UUID and recover its receipt before retrying.",true);
}
async function rpc(name:string,parameters:Record<string,unknown>) {
  const {data,error}=await client().rpc(name,parameters); if(error) failure(error); return data;
}
function stable(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;
  if(value!==null&&typeof value==="object")return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
function binding(owner:string,filters:unknown) {return createHash("sha256").update(stable({owner,filters})).digest("hex");}
function decodeCursor(value:string|undefined,bind:string) {
  if(!value)return null;
  try {if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error();const parsed=cursorSchema.parse(JSON.parse(Buffer.from(value,"base64url").toString("utf8")));if(parsed.binding!==bind)throw Error();return parsed;}
  catch {throw new ToolFailure("INVALID_CURSOR","Restart browsing with this account and the same Library filters.");}
}
function nextCursor(bind:string,time:string,key:string) {return Buffer.from(JSON.stringify({v:1,binding:bind,time,id:key})).toString("base64url");}
export async function readLibraryItem(owner:string,itemId:string) {
  const data=await rpc("mcp_read_library_item",{p_user_id:owner,p_item_id:itemId});
  if(!data)throw new ToolFailure("NOT_FOUND","This Library entry is unavailable to your account.");
  return libraryStateSchema.parse(data);
}
export async function listLibraryItems(owner:string,input:{limit:number;cursor?:string;project_id?:string;include_removed:boolean}) {
  const bind=binding(owner,{kind:"library_items",project_id:input.project_id??null,include_removed:input.include_removed}),cursor=decodeCursor(input.cursor,bind);
  let query=client().from("library_items").select("id,updated_at").eq("user_id",owner).eq("source_type","generated_carousel").eq("media_type","carousel")
    .order("updated_at",{ascending:false}).order("id",{ascending:false}).limit(input.limit+1);
  if(!input.include_removed)query=query.is("deleted_at",null);
  if(input.project_id)query=query.eq("project_id",input.project_id);
  if(cursor)query=query.or(`updated_at.lt.${cursor.time},and(updated_at.eq.${cursor.time},id.lt.${cursor.id})`);
  const {data,error}=await query;if(error)failure(error);
  const rows=(data??[]).slice(0,input.limit),items=await Promise.all(rows.map(row=>readLibraryItem(owner,row.id))),last=rows.at(-1);
  // A website removal between page lookup and snapshot must not appear in the active page.
  return {items:input.include_removed?items:items.filter(item=>item.deleted_at===null),next_cursor:data&&data.length>input.limit&&last?nextCursor(bind,last.updated_at,last.id):null};
}
async function sourceRevision(owner:string,carouselId:string) {
  const value=await rpc("mcp_library_source_revision",{p_user_id:owner,p_source_id:carouselId});
  if(!value)throw new ToolFailure("NOT_FOUND","This Carousel is unavailable to your account.");return revision.parse(value);
}
async function prepareCarousel(owner:string,carouselId:string) {
  const before=await sourceRevision(owner,carouselId);
  let input;
  try {input=await prepareGeneratedCarouselLibrarySaveForOwner(owner,carouselId);}
  catch(error) {if(error instanceof LibraryContentError)throw new ToolFailure(error.status===404?"NOT_FOUND":"SOURCE_NOT_READY",error.message);throw error;}
  if(await sourceRevision(owner,carouselId)!==before)throw new ToolFailure("LIBRARY_CONFLICT","The Carousel changed while resolving its rendered slides. Inspect it again.");
  return {source_revision:before,payload:buildGeneratedCarouselLibraryPayload(input)};
}
export async function inspectCarouselLibrarySave(owner:string,carouselId:string) {
  const prepared=await prepareCarousel(owner,carouselId);
  const destination=z.strictObject({revision,items:z.array(libraryStateSchema)}).parse(await rpc("mcp_library_destination",{p_user_id:owner,p_source_id:carouselId}));
  return {carousel_id:carouselId,source_revision:prepared.source_revision,destination_revision:destination.revision,
    destination:destination.items,title:prepared.payload.p_title,slide_count:prepared.payload.p_slides.length,
    rendered_urls:prepared.payload.p_slides.map(slide=>slide.renderedUrl!),uses_saved_edit:Boolean(prepared.payload.p_metadata.trendingCreativeEdit)};
}
async function accepted(owner:string,key:string) {
  const {data,error}=await client().from("mcp_library_requests").select("operation,input_json,result_json").eq("user_id",owner).eq("request_id",key).maybeSingle();
  if(error)failure(error);return data;
}
export async function getLibraryRequest(owner:string,key:string) {
  const data=await accepted(owner,key);if(!data)throw new ToolFailure("NOT_FOUND","This accepted Library request was not found.");return {receipt:libraryReceiptSchema.parse(data.result_json)};
}
export async function listLibraryRequests(owner:string,input:{limit:number;cursor?:string}) {
  const bind=binding(owner,{kind:"library_requests"}),cursor=decodeCursor(input.cursor,bind);
  let query=client().from("mcp_library_requests").select("request_id,operation,created_at").eq("user_id",owner).order("created_at",{ascending:false}).order("request_id",{ascending:false}).limit(input.limit+1);
  if(cursor)query=query.or(`created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},request_id.lt.${cursor.id})`);
  const {data,error}=await query;if(error)failure(error);const items=(data??[]).slice(0,input.limit),last=items.at(-1);
  return {items,next_cursor:data&&data.length>input.limit&&last?nextCursor(bind,last.created_at,last.request_id):null};
}
export async function mutateLibrary(owner:string,key:string,operation:"save_carousel"|"save_slideshow"|"remove",input:Record<string,unknown>) {
  // Recover accepted intent before current gates, plan/media readiness or source resolution.
  const previous=await accepted(owner,key);
  if(previous) {
    if(previous.operation!==operation||stable(previous.input_json)!==stable(input))throw new ToolFailure("LIBRARY_CONFLICT","This request UUID belongs to different Library inputs. Recover its saved result first.");
    return {replayed:true,receipt:libraryReceiptSchema.parse(previous.result_json)};
  }
  if(process.env.MCP_LIBRARY_WRITES_ENABLED!=="true")throw new ToolFailure("LIBRARY_WRITES_DISABLED","IDE Library writes are not enabled. Accepted receipts remain readable.");
  let payload:Record<string,unknown>={};
  if(operation==="save_carousel") {
    const prepared=await prepareCarousel(owner,String(input.carousel_id));
    if(prepared.source_revision!==input.source_revision)throw new ToolFailure("LIBRARY_CONFLICT","The Carousel source changed. Inspect its current rendered revision before saving.");
    payload=prepared.payload;
  } else if(operation==="save_slideshow") {
    let plan;
    try {plan=await getUserSubscription(owner,{strict:true,refreshCredits:false,initializeFreeCredits:true});}
    catch {throw new ToolFailure("ENTITLEMENTS_UNAVAILABLE","Current slideshow access is unavailable.",true);}
    if(!plan.isActive&&plan.freeGenerationCredits.granted===0)throw new ToolFailure("ACCESS_REQUIRED","Your account does not currently have application slideshow access.");
    const prepared=await prepareSlideshowSaveForOwner(owner,input);
    if(prepared instanceof Response) {const body=await prepared.json();throw new ToolFailure(prepared.status>=500?"LIBRARY_UNAVAILABLE":"INVALID_INPUT",body.error??"Choose ready owned slideshow images.",prepared.status>=500);}
    payload=prepared;
  }
  const data=await rpc("mcp_mutate_library",{p_user_id:owner,p_request_id:key,p_operation:operation,p_input:input,p_payload:payload});
  return z.strictObject({replayed:z.boolean(),receipt:libraryReceiptSchema}).parse(data);
}

/** Discover unsaved owned generations; inspection remains the authority on edit/render readiness. */
export async function listCarouselLibrarySources(owner:string,input:{limit:number;cursor?:string;project_id?:string;include_pending:boolean}) {
  const bind=binding(owner,{kind:"carousel_sources",project_id:input.project_id??null,include_pending:input.include_pending}),cursor=decodeCursor(input.cursor,bind);
  let query=client().from("carousel_generations").select("id,project_id,status,slide_count,updated_at").eq("user_id",owner)
    .order("updated_at",{ascending:false}).order("id",{ascending:false}).limit(input.limit+1);
  if(input.project_id)query=query.eq("project_id",input.project_id);
  if(!input.include_pending)query=query.eq("status","completed");
  if(cursor)query=query.or(`updated_at.lt.${cursor.time},and(updated_at.eq.${cursor.time},id.lt.${cursor.id})`);
  const {data,error}=await query;if(error)failure(error);const items=(data??[]).slice(0,input.limit),last=items.at(-1);
  return {items,next_cursor:data&&data.length>input.limit&&last?nextCursor(bind,last.updated_at,last.id):null};
}
