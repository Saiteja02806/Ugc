import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { applyPrimaryGoals, PrimaryGoalsSchema } from "../business-profiles/schema";
import { hashBusinessProfileAnalysis } from "../business-profiles/db";
import { assertBusinessContextCandidateReady, prepareBusinessContextCandidate } from "../business-profiles/business-context-candidate";
import { ToolFailure } from "./read-tools";
import { businessContextOperationSchema,businessContextStateSchema,businessContextReceiptSchema,businessContextResultSchema,businessContextSaveSchema,businessContextWriteSchema } from "./business-context-contract";

export function businessContextStorageConfigured() {
  return Boolean((process.env.SUPABASE_URL?.trim()||process.env.NEXT_PUBLIC_SUPABASE_URL?.trim())&&process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
function client() {
  const url=process.env.SUPABASE_URL?.trim()||process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key)throw new ToolFailure("BUSINESS_CONTEXT_UNAVAILABLE","Business Context storage is not configured.",true);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function fail(error:{message?:string}|null):never {
  const text=error?.message??"";
  if(text.includes("mcp_business_context_request_conflict"))throw new ToolFailure("BUSINESS_CONTEXT_CONFLICT","This UUID belongs to different Business Context inputs. Recover its receipt before reconciling another change.");
  if(/business_context_(revision|draft|profile)_conflict|business_context_draft_stale/.test(text))throw new ToolFailure("BUSINESS_CONTEXT_CONFLICT","Business Context changed. Recover the request, read current state and reconcile the intended change.");
  if(text.includes("mcp_business_context_not_found"))throw new ToolFailure("NOT_FOUND","Complete Business Context before editing it.");
  if(text.includes("mcp_business_context_invalid"))throw new ToolFailure("INVALID_INPUT","Choose valid Business Context and saved revisions.");
  throw new ToolFailure("BUSINESS_CONTEXT_UNAVAILABLE","The Business Context result could not be confirmed. Preserve its UUID and recover it before retrying.",true);
}
export async function readMcpBusinessContext(owner:string) {
  const {data,error}=await client().rpc("mcp_read_business_context",{p_user_id:owner});
  if(error)fail(error);return businessContextStateSchema.parse(data);
}
export function withBusinessContextReadiness(state:z.infer<typeof businessContextStateSchema>) {
  return {...state, draft_readiness:state.profile?.draft?(()=>{const result=prepareBusinessContextCandidate(state.profile.draft.context);return {fact_count:result.factCount,status:result.status};})():null};
}
function stable(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable((value as Record<string,unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function saved(owner:string,key:string) {
  const {data,error}=await client().from("mcp_business_context_requests").select("operation,input_json,result_json").eq("user_id",owner).eq("request_id",key.toLowerCase()).maybeSingle();
  if(error)fail(error);return data;
}
function receipt(value:unknown,key:string) {
  const accepted=businessContextReceiptSchema.parse(value);
  if(accepted.request_id!==key.toLowerCase())throw new ToolFailure("BUSINESS_CONTEXT_UNAVAILABLE","The saved request identity could not be verified.",true);
  return accepted;
}
export async function getMcpBusinessContextRequest(owner:string,key:string) {
  const data=await saved(owner,key);if(!data)throw new ToolFailure("NOT_FOUND","This Business Context receipt is unavailable to your account.");
  return {receipt:receipt(data.result_json,key)};
}
export async function mutateMcpBusinessContext(owner:string,key:string,operation:z.infer<typeof businessContextOperationSchema>,raw:unknown) {
  if(process.env.MCP_BUSINESS_CONTEXT_WRITES_ENABLED!=="true")throw new ToolFailure("BUSINESS_CONTEXT_WRITES_DISABLED","IDE Business Context writes are not enabled. Accepted receipts remain readable.");
  let input;
  try{input=(operation==="save_draft"?businessContextSaveSchema:businessContextWriteSchema).omit({request_id:true}).parse(raw);}
  catch{throw new ToolFailure("INVALID_INPUT","Choose valid Business Context and saved revisions.");}
  // Recover accepted raw intent before reading newer goals or re-normalizing it.
  const prior=await saved(owner,key);
  if(prior){if(prior.operation!==operation||stable(prior.input_json)!==stable(input))fail({message:"mcp_business_context_request_conflict"});
    const accepted=receipt(prior.result_json,key);if(accepted.operation!==operation)fail(null);return {replayed:true,receipt:accepted};}
  const state=await readMcpBusinessContext(owner),profile=state.profile;
  if(!profile)throw new ToolFailure("NOT_FOUND","Complete Business Context before editing it.");
  if(profile.context_revision!==input.expected_revision||profile.active_profile_version!==input.expected_profile_version||profile.draft?.updated_at!== (input.expected_draft_updated_at??undefined))
    throw new ToolFailure("BUSINESS_CONTEXT_CONFLICT","Business Context changed. Read current state and reconcile the intended change.");
  const goals=PrimaryGoalsSchema.safeParse(profile.primary_goals);
  if(!goals.success)throw new ToolFailure("ONBOARDING_REQUIRED","Complete your business goals before applying Business Context.");
  const context=applyPrimaryGoals(input.context,goals.data);
  if(operation==="apply")try{assertBusinessContextCandidateReady(context);}catch{throw new ToolFailure("BUSINESS_CONTEXT_NEEDS_FACTS","Add at least one factual capability, audience, pain, outcome or differentiator before applying.");}
  const {data,error}=await client().rpc("mcp_mutate_business_context",{p_user_id:owner,p_request_id:key.toLowerCase(),p_operation:operation,p_input:input,
    p_context:context,p_content_hash:hashBusinessProfileAnalysis(context,profile.intake_type)});
  if(error)fail(error);const result=businessContextResultSchema.parse(data);
  if(result.receipt.request_id!==key.toLowerCase()||result.receipt.operation!==operation)fail(null);
  return result;
}
const cursorSchema=z.strictObject({v:z.literal(1),binding:z.string().regex(/^[a-f0-9]{64}$/),time:z.string().datetime({offset:true}),id:z.uuid()});
export async function listMcpBusinessContextRequests(owner:string,input:{limit:number;cursor?:string}) {
  const binding=createHash("sha256").update(JSON.stringify({owner,kind:"business_context_requests"})).digest("hex");
  let cursor:z.infer<typeof cursorSchema>|null=null;
  if(input.cursor)try{if(!/^[A-Za-z0-9_-]+$/.test(input.cursor))throw Error();cursor=cursorSchema.parse(JSON.parse(Buffer.from(input.cursor,"base64url").toString("utf8")));if(cursor.binding!==binding)throw Error();}
  catch{throw new ToolFailure("INVALID_CURSOR","Restart Business Context history for the connected account.");}
  let query=client().from("mcp_business_context_requests").select("request_id,operation,created_at").eq("user_id",owner).order("created_at",{ascending:false}).order("request_id",{ascending:false}).limit(input.limit+1);
  if(cursor)query=query.or(`created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},request_id.lt.${cursor.id})`);
  const {data,error}=await query;if(error)fail(error);
  const entries=z.array(z.strictObject({request_id:z.uuid(),operation:businessContextOperationSchema,created_at:z.string().datetime({offset:true})})).parse(data??[]);
  const items=entries.slice(0,input.limit),last=items.at(-1);
  return {items,next_cursor:entries.length>input.limit&&last?Buffer.from(JSON.stringify({v:1,binding,time:last.created_at,id:last.request_id})).toString("base64url"):null};
}
