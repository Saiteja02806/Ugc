import "server-only";
import {createHash} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {z} from "zod";
import {ToolFailure} from "./read-tools";
import {accountSettingsOperationSchema,accountSettingsReceiptSchema,accountSettingsResultSchema,accountSettingsStateSchema,normalizeSettingsInput} from "./account-settings-contract";

function client() {
  const url=process.env.SUPABASE_URL?.trim()||process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key)throw new ToolFailure("SETTINGS_UNAVAILABLE","Account settings storage is not configured.",true);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function failure(error:{message?:string}|null):never {
  if(error?.message?.includes("settings_request_conflict"))throw new ToolFailure("SETTINGS_CONFLICT","This request UUID belongs to different settings. Recover its accepted receipt first.");
  if(error?.message?.includes("settings_revision_conflict"))throw new ToolFailure("SETTINGS_CONFLICT","These settings changed. Read the current revision and reconcile your intended change.");
  if(error?.message?.includes("invalid_settings_request"))throw new ToolFailure("INVALID_INPUT","Choose valid publishing defaults, timezone and saved revision.");
  throw new ToolFailure("SETTINGS_UNAVAILABLE","The settings result could not be confirmed. Preserve its request UUID and recover it before retrying.",true);
}
export async function readAccountSettings(owner:string) {
  const {data,error}=await client().rpc("mcp_read_account_settings",{p_user_id:owner});
  if(error)failure(error);return accountSettingsStateSchema.parse(data);
}
export async function mutateAccountSettings(owner:string,requestId:string,operation:z.infer<typeof accountSettingsOperationSchema>,input:unknown) {
  if(process.env.MCP_ACCOUNT_SETTINGS_WRITES_ENABLED!=="true")throw new ToolFailure("SETTINGS_WRITES_DISABLED","IDE account settings writes are not enabled. Accepted receipts remain readable.");
  let normalized;
  try{normalized=normalizeSettingsInput(operation,input);}catch{throw new ToolFailure("INVALID_INPUT","Choose valid account settings and saved revision.");}
  const {data,error}=await client().rpc("mcp_mutate_account_settings",{p_user_id:owner,p_request_id:requestId.toLowerCase(),p_operation:operation,p_input:normalized});
  if(error)failure(error);const result=accountSettingsResultSchema.parse(data);
  if(result.receipt.request_id!==requestId.toLowerCase()||result.receipt.operation!==operation)throw new ToolFailure("SETTINGS_UNAVAILABLE","The accepted settings identity could not be verified.",true);
  return result;
}
export async function getAccountSettingsRequest(owner:string,requestId:string) {
  const {data,error}=await client().from("mcp_account_settings_requests").select("result_json").eq("user_id",owner).eq("request_id",requestId.toLowerCase()).maybeSingle();
  if(error)failure(error);if(!data)throw new ToolFailure("NOT_FOUND","This accepted settings request is unavailable to your account.");
  const receipt=accountSettingsReceiptSchema.parse(data.result_json);
  if(receipt.request_id!==requestId.toLowerCase())throw new ToolFailure("SETTINGS_UNAVAILABLE","The saved settings identity could not be verified.",true);
  return {receipt};
}
const cursorSchema=z.strictObject({v:z.literal(1),binding:z.string().regex(/^[a-f0-9]{64}$/),time:z.string().datetime({offset:true}),id:z.uuid()});
export async function listAccountSettingsRequests(owner:string,input:{limit:number;cursor?:string}) {
  const binding=createHash("sha256").update(JSON.stringify({owner,kind:"account_settings_requests"})).digest("hex");
  let cursor:z.infer<typeof cursorSchema>|null=null;
  if(input.cursor)try{if(!/^[A-Za-z0-9_-]+$/.test(input.cursor))throw Error();cursor=cursorSchema.parse(JSON.parse(Buffer.from(input.cursor,"base64url").toString("utf8")));if(cursor.binding!==binding)throw Error();}
  catch{throw new ToolFailure("INVALID_CURSOR","Restart settings history with the connected account.");}
  let query=client().from("mcp_account_settings_requests").select("request_id,operation,created_at").eq("user_id",owner).order("created_at",{ascending:false}).order("request_id",{ascending:false}).limit(input.limit+1);
  if(cursor)query=query.or(`created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},request_id.lt.${cursor.id})`);
  const {data,error}=await query;if(error)failure(error);
  const entries=z.array(z.strictObject({request_id:z.uuid(),operation:accountSettingsOperationSchema,created_at:z.string().datetime({offset:true})})).parse(data??[]);
  const items=entries.slice(0,input.limit),last=items.at(-1);
  return {items,next_cursor:entries.length>input.limit&&last?Buffer.from(JSON.stringify({v:1,binding,time:last.created_at,id:last.request_id})).toString("base64url"):null};
}
