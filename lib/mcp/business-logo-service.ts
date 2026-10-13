import "server-only";
import {createHash} from "node:crypto";
import {z} from "zod";
import {createBusinessLogoStorageKey,isOwnedBusinessLogoStorageKey,inspectBusinessLogoWithChecksum,BusinessLogoValidationError} from "../business-profiles/logo";
import {createSignedPutUrl,headStorageObject} from "../storage/storage";
import {createClient} from "@supabase/supabase-js";
import {ToolFailure} from "./read-tools";
import {businessLogoUploadInput,businessLogoUploadSchema,businessLogoAssetSchema} from "./business-logo-contract";
const rowSchema=z.object({id:z.uuid(),user_id:z.string().min(1),request_id:z.uuid(),input_json:businessLogoUploadInput.omit({request_id:true}),storage_key:z.string().min(1),status:z.enum(["uploading","ready"]),
 verified_logo:businessLogoAssetSchema.nullable(),created_at:z.string().datetime({offset:true}),updated_at:z.string().datetime({offset:true}),expires_at:z.string().datetime({offset:true})});
type Row=z.infer<typeof rowSchema>;
function logoStore(){const url=process.env.SUPABASE_URL?.trim()||process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!url||!key)throw new ToolFailure("LOGO_UPLOAD_UNAVAILABLE","Logo reservation storage is not configured.",true);return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
function fail(error?:{message?:string}|null):never {
 const message=error?.message??"";
 if(message.includes("mcp_logo_request_conflict"))throw new ToolFailure("REQUEST_CONFLICT","This UUID belongs to a different logo file. Recover that reservation before reserving another file.");
 if(message.includes("mcp_logo_not_found"))throw new ToolFailure("NOT_FOUND","This logo reservation is unavailable to your account.");
 if(message.includes("mcp_logo_quota"))throw new ToolFailure("UPLOAD_QUOTA_EXCEEDED","Confirm an existing pending logo before reserving another. Twenty pending logos are allowed per 24 hours.");
 if(message.includes("mcp_logo_ready"))throw new ToolFailure("UPLOAD_ALREADY_CONFIRMED","This logo is already verified. Recover its saved logo metadata.");
 if(message.includes("mcp_logo_expired"))throw new ToolFailure("UPLOAD_LINK_EXPIRED","This reservation is older than 24 hours and cannot issue another transfer link. Existing bytes can still be confirmed.");
 if(/mcp_logo_(invalid|mismatch)/.test(message))throw new ToolFailure("UPLOAD_MISMATCH","The logo file differs from its reservation or application limits.");
 throw new ToolFailure("LOGO_UPLOAD_UNAVAILABLE","The logo reservation could not be confirmed. Preserve its UUID and recover it before creating another.",true);
}
function owned(raw:unknown,owner:string):Row {
 const row=rowSchema.parse(raw);if(row.user_id!==owner||!isOwnedBusinessLogoStorageKey({key:row.storage_key,userId:owner})||row.status==="ready"&&!row.verified_logo)fail();
 if(row.verified_logo?.storageKey&&row.verified_logo.storageKey!==row.storage_key)fail();return row;
}
function summary(row:Row) {return businessLogoUploadSchema.parse({upload_id:row.id,request_id:row.request_id,...row.input_json,status:row.status,created_at:row.created_at,updated_at:row.updated_at,expires_at:row.expires_at,logo:row.verified_logo});}
function assertWrites() {if(process.env.MCP_BUSINESS_MEDIA_WRITES_ENABLED!=="true")throw new ToolFailure("BUSINESS_MEDIA_WRITES_DISABLED","IDE business media writes are not enabled. Existing logo reservations remain readable.");}
async function rowFor(owner:string,input:{upload_id?:string;request_id?:string}) {
 let query=logoStore().from("mcp_business_logo_uploads").select("*").eq("user_id",owner);
 query=input.upload_id?query.eq("id",input.upload_id.toLowerCase()):query.eq("request_id",input.request_id!.toLowerCase());
 const {data,error}=await query.maybeSingle();if(error)fail(error);if(!data)fail({message:"mcp_logo_not_found"});return owned(data,owner);
}
export async function getMcpBusinessLogoUpload(owner:string,input:{upload_id?:string;request_id?:string}) {return {upload:summary(await rowFor(owner,input))};}
export async function createMcpBusinessLogoUpload(owner:string,raw:unknown) {
 assertWrites();let input:z.infer<typeof businessLogoUploadInput>;
 try{input=businessLogoUploadInput.parse(raw);}catch{throw new ToolFailure("INVALID_INPUT","Choose a PNG, JPEG or WebP logo of at most 2 MB and preserve its local SHA-256.");}
 const {request_id,...intent}=input;
 const {data,error}=await logoStore().rpc("mcp_reserve_business_logo",{p_user_id:owner,p_request_id:request_id.toLowerCase(),p_input:intent,p_key:createBusinessLogoStorageKey({contentType:intent.mime_type,userId:owner})});
 if(error)fail(error);const result=z.object({replayed:z.boolean(),upload:z.unknown()}).parse(data),row=owned(result.upload,owner);
 // Reservation precedes signing. A lost URL response never loses the stable ID.
 return {replayed:result.replayed,upload:summary(row)};
}
export async function renewMcpBusinessLogoUpload(owner:string,id:string) {
 assertWrites();const existing=await rowFor(owner,{upload_id:id});if(existing.status!=="uploading")fail({message:"mcp_logo_ready"});
 try{await headStorageObject({key:existing.storage_key});throw new ToolFailure("UPLOAD_ALREADY_TRANSFERRED","Bytes already exist. Confirm this same logo reservation before transferring again.");}
 catch(error){if(error instanceof ToolFailure)throw error;if(!(error instanceof Error&&error.name==="NoSuchKey"))throw new ToolFailure("STORAGE_UNAVAILABLE","The upload's storage state could not be confirmed. Preserve this reservation.",true);}
 const {data,error}=await logoStore().rpc("mcp_lease_business_logo",{p_user_id:owner,p_upload_id:id});if(error)fail(error);const row=owned(data,owner);
 const seconds=Math.floor((Date.parse(row.expires_at)-Date.now())/1000);if(!Number.isFinite(seconds)||seconds<1||seconds>600)throw new ToolFailure("UPLOAD_LINK_EXPIRED","Renew this same reservation's transfer link.",true);
 try{
  const url=await createSignedPutUrl({key:row.storage_key,contentType:row.input_json.mime_type,maxBytes:row.input_json.file_size_bytes,createOnly:true,expiresInSeconds:seconds});
  if(!url.startsWith("https://"))throw Error();
  return {upload_id:row.id,upload_url:url,expires_at:row.expires_at,required_headers:{"Content-Type":row.input_json.mime_type,"x-goog-content-length-range":`1,${row.input_json.file_size_bytes}`,"x-goog-if-generation-match":"0" as const}};
 }catch{throw new ToolFailure("STORAGE_UNAVAILABLE","Could not sign this logo upload. Recover and renew the same reservation.",true);}
}
export async function confirmMcpBusinessLogoUpload(owner:string,id:string) {
 assertWrites();const row=await rowFor(owner,{upload_id:id});if(row.status==="ready")return {upload:summary(row)};
 let verified;
 try{verified=await inspectBusinessLogoWithChecksum({key:row.storage_key,userId:owner,expected:{mimeType:row.input_json.mime_type,fileSizeBytes:row.input_json.file_size_bytes,sha256:row.input_json.sha256}});}
 catch(error){if(error instanceof BusinessLogoValidationError)throw new ToolFailure("UPLOAD_MISMATCH","The uploaded logo differs from its reserved file or fails the application image limits. Preserve this reservation before choosing another file.");if(error instanceof Error&&error.name==="NoSuchKey")throw new ToolFailure("UPLOAD_NOT_TRANSFERRED","The logo bytes are not present. Recover the reservation and renew its transfer link.",true);throw new ToolFailure("LOGO_PROBE_UNAVAILABLE","Logo verification did not complete. Preserve this reservation; check the file and confirm this same ID again.",true);}
 const {data,error}=await logoStore().rpc("mcp_confirm_business_logo",{p_user_id:owner,p_upload_id:id,p_logo:verified.logo,p_sha256:verified.sha256});if(error)fail(error);
 return {upload:summary(owned(data,owner))};
}
const cursorSchema=z.strictObject({v:z.literal(1),binding:z.string().regex(/^[a-f0-9]{64}$/),time:z.string().datetime({offset:true}),id:z.uuid()});
export async function listMcpBusinessLogoUploads(owner:string,input:{limit:number;cursor?:string}) {
 const binding=createHash("sha256").update(`business-logos:${owner}`).digest("hex");let cursor:z.infer<typeof cursorSchema>|null=null;
 if(input.cursor)try{if(!/^[A-Za-z0-9_-]+$/.test(input.cursor))throw Error();cursor=cursorSchema.parse(JSON.parse(Buffer.from(input.cursor,"base64url").toString("utf8")));if(cursor.binding!==binding)throw Error();}catch{throw new ToolFailure("INVALID_CURSOR","Restart logo upload history for the connected account.");}
 let query=logoStore().from("mcp_business_logo_uploads").select("*").eq("user_id",owner).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(input.limit+1);
 if(cursor)query=query.or(`created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},id.lt.${cursor.id})`);
 const {data,error}=await query;if(error)fail(error);const rows=(data??[]).map(value=>owned(value,owner)),page=rows.slice(0,input.limit),last=page.at(-1);
 return {items:page.map(summary),next_cursor:rows.length>input.limit&&last?Buffer.from(JSON.stringify({v:1,binding,time:last.created_at,id:last.id})).toString("base64url"):null};
}
