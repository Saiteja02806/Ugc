import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { mapProfile, hashBusinessProfileAnalysis, type BusinessProfileRow } from "../business-profiles/db";
import { toClientDraft, type DraftRow } from "../business-profiles/onboarding-drafts";
import { isBackgroundOnboardingEnabled } from "../business-profiles/onboarding-rollout";
import { toClientOnboardingProfile } from "../business-profiles/onboarding-view";
import { applyBusinessProfileOnboardingContext, applyPrimaryGoals } from "../business-profiles/schema";
import { inspectBusinessLogo } from "../business-profiles/logo";
import { getBackgroundJobForUser } from "../jobs/background-jobs";
import { dispatchQueuedBackgroundJobForRecovery } from "../jobs/background-job-service";
import { getMissingBackgroundJobCloudTasksEnvVars } from "../jobs/gcp-cloud-tasks";
import type { PublicBackgroundJob } from "../jobs/background-job-contract";
import { onboardingFenceSchema, onboardingMutationSchema, onboardingReceiptSchema, onboardingStateSchema } from "./business-onboarding-contract";
import { ToolFailure } from "./read-tools";

function client() {
  const url=process.env.SUPABASE_URL?.trim()||process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key)throw new ToolFailure("BUSINESS_ONBOARDING_UNAVAILABLE","Business onboarding storage is not configured.",true);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function fail(error?:{message?:string;code?:string}|null):never {
  const message=error?.message??"";
  if(/mcp_onboarding_request_conflict/.test(message))throw new ToolFailure("REQUEST_CONFLICT","This UUID belongs to different onboarding inputs. Recover its accepted receipt before another action.");
  if(/mcp_onboarding_revision_conflict|onboarding_revision_conflict|onboarding_legacy_profile/.test(message))throw new ToolFailure("ONBOARDING_CONFLICT","Saved setup changed. Recover this request, read current progress and reconcile your intended change.");
  if(error?.code==="55P03"||error?.code==="40P01"||error?.code==="40001")throw new ToolFailure("ONBOARDING_BUSY","Another setup change is in progress. Preserve this UUID and recover it before retrying.",true);
  if(/onboarding_(draft_)?not_found/.test(message))throw new ToolFailure("NOT_FOUND","This saved onboarding session is unavailable to your account.");
  if(/mcp_onboarding_source_active/.test(message))throw new ToolFailure("ONBOARDING_SOURCE_ACTIVE","A setup analysis is still active. Read its operation and finish or cancel it before selecting another legacy source.");
  if(/mcp_onboarding_already_completed/.test(message))throw new ToolFailure("ONBOARDING_COMPLETED","This business already completed setup. Use Business Context editing for the existing profile.");
  if(/mcp_onboarding_submitted/.test(message))throw new ToolFailure("ONBOARDING_SUBMITTED","This setup is already submitted. Read current progress; reopen the background submission before changing its answers.");
  if(/mcp_onboarding_unsupported/.test(message))throw new ToolFailure("UNSUPPORTED_ACTION","The legacy setup does not support reopening a background submission.");
  if(/onboarding_(invalid|input_invalid|name_required|goals_invalid|answers_required|timezone_invalid)/.test(message))throw new ToolFailure("INVALID_INPUT","Choose valid saved onboarding answers and revisions.");
  throw new ToolFailure("BUSINESS_ONBOARDING_UNAVAILABLE","The onboarding result could not be confirmed. Preserve its UUID and recover it before another mutation.",true);
}
type Snapshot={mode:"legacy"|"background";profile:BusinessProfileRow|null;draft:DraftRow|null;profile_revision:string|null};
function snapshot(value:unknown,owner:string):Snapshot {
  if(!value||typeof value!=="object")fail();
  const state=value as Snapshot;
  if((state.mode!=="legacy"&&state.mode!=="background")||state.profile&&state.profile.user_id!==owner||state.draft&&state.draft.user_id!==owner)fail();
  fence(state);return state;
}
function fence(state:Snapshot) {
  return onboardingFenceSchema.parse({mode:state.mode,profile_revision:state.profile_revision,draft_id:state.draft?.id??null,draft_revision:state.draft?.revision??null});
}
async function rawSnapshot(owner:string) {
  const {data,error}=await client().rpc("mcp_read_business_onboarding",{p_user_id:owner,p_background_enrolled:isBackgroundOnboardingEnabled(owner)});
  if(error)fail(error);return snapshot(data,owner);
}
function jobView(job:PublicBackgroundJob|null) {return job?{id:job.id,status:job.status,progress:job.progress,stage:job.stage,updated_at:job.updatedAt}:null;}
export async function readMcpBusinessOnboarding(owner:string) {
  try {
    const state=await rawSnapshot(owner),profile=state.profile?toClientOnboardingProfile(mapProfile(state.profile)):null;
    const draft=state.draft?await toClientDraft(state.draft):null;
    let jobs:unknown[]=[];
    if(state.mode==="legacy") {
      const {data,error}=await client().from("background_jobs").select("id,status,progress,stage,updated_at").eq("user_id",owner)
        .eq("job_type","media_analysis").contains("input_json",{operation:"business_profile_setup"})
        .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(20);
      if(error)fail(error);jobs=data??[];
    }
    return onboardingStateSchema.parse({mode:state.mode,expected_state:fence(state),profile,
      draft:draft?{id:draft.id,revision:draft.revision,source_revision:draft.sourceRevision,source:draft.sourceInput,
        business_name:draft.businessName,suggested_name:draft.suggestedName,logo_storage_key:draft.logoStorageKey,logo_url:draft.logoUrl,
        primary_goals:draft.primaryGoals,step:draft.step,submitted:draft.submitted,completed:draft.completed,analysis_ready:draft.analysisReady,
        analysis_job:jobView(draft.analysisJob),finalization_job:jobView(draft.finalizationJob)}:null,legacy_setup_jobs:jobs});
  }catch(error){if(error instanceof ToolFailure)throw error;fail();}
}
function receipt(raw:unknown,key:string,owner:string) {
  const parsed=z.object({request_id:z.uuid(),mode:z.enum(["legacy","background"]),action:z.enum(["start","identity","goals","submit","edit"]),snapshot:z.unknown(),job_ids:z.array(z.uuid()).max(2)}).parse(raw);
  if(parsed.request_id!==key.toLowerCase())fail();
  const state=snapshot(parsed.snapshot,owner),d=state.draft;
  return onboardingReceiptSchema.parse({request_id:parsed.request_id,mode:parsed.mode,action:parsed.action,job_ids:parsed.job_ids,
    accepted_state:{expected_state:fence(state),profile:state.profile?toClientOnboardingProfile(mapProfile(state.profile)):null,
      draft:d?{id:d.id,revision:d.revision,source_revision:d.source_revision,source:d.source_input,business_name:d.business_name,
        logo_storage_key:d.logo?.storageKey??null,logo_url:d.logo?.url??null,primary_goals:d.primary_goals,step:d.step,
        submitted:!!d.submitted_at,completed:!!d.completed_at,analysis_ready:!!d.analysis_id}:null}});
}
async function saved(owner:string,key:string) {
  const {data,error}=await client().from("mcp_business_onboarding_requests").select("input_json,result_json").eq("user_id",owner).eq("request_id",key.toLowerCase()).maybeSingle();
  if(error)fail(error);return data;
}
export async function getMcpBusinessOnboardingRequest(owner:string,key:string) {
  const prior=await saved(owner,key);if(!prior)throw new ToolFailure("NOT_FOUND","This onboarding receipt is unavailable to your account.");
  return {receipt:receipt(prior.result_json,key,owner)};
}
function stable(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable((value as Record<string,unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function dispatch(owner:string,ids:string[]) {
  // Acceptance is already committed. Failed dispatch remains queued for recovery.
  for(const id of ids)try{const job=await getBackgroundJobForUser({jobId:id,userId:owner});if(job)await dispatchQueuedBackgroundJobForRecovery(job);}
  catch{console.error(JSON.stringify({event:"mcp.onboarding.dispatch_needs_recovery"}));}
}
export async function mutateMcpBusinessOnboarding(owner:string,args:unknown) {
  if(process.env.MCP_BUSINESS_ONBOARDING_WRITES_ENABLED!=="true")throw new ToolFailure("ONBOARDING_WRITES_DISABLED","IDE onboarding writes are not enabled. Accepted receipts remain readable.");
  let parsed:z.infer<typeof onboardingMutationSchema>;
  try{parsed=onboardingMutationSchema.parse(args);}catch{throw new ToolFailure("INVALID_INPUT","Choose valid saved onboarding answers and revisions.");}
  const {request_id,...input}=parsed,key=request_id.toLowerCase();
  const prior=await saved(owner,key);
  if(prior){if(stable(prior.input_json)!==stable(input))fail({message:"mcp_onboarding_request_conflict"});return {replayed:true,receipt:receipt(prior.result_json,key,owner)};}
  const state=await rawSnapshot(owner);
  if(stable(fence(state))!==stable(input.expected_state))fail({message:"mcp_onboarding_revision_conflict"});
  const change=input.change,prepared:Record<string,unknown>={};
  if((change.action==="start"||change.action==="submit")&&getMissingBackgroundJobCloudTasksEnvVars(["media_analysis"]).length)
    throw new ToolFailure("ONBOARDING_DISPATCH_UNAVAILABLE","Setup analysis or completion dispatch is not configured. No onboarding change was accepted.",true);
  if(change.action==="identity"&&change.logo_storage_key!==undefined) {
    try{prepared.logo=change.logo_storage_key===null?null:await inspectBusinessLogo({key:change.logo_storage_key,userId:owner});}
    catch{throw new ToolFailure("INVALID_LOGO","Choose a verified owned PNG, JPEG or WebP business logo with the application's size and dimension limits.");}
  }
  if(state.mode==="legacy"&&state.profile&&(change.action==="identity"||change.action==="submit")) {
    const profile=mapProfile(state.profile),context=change.action==="identity"?
      applyBusinessProfileOnboardingContext(profile.context,{businessName:change.business_name}):applyPrimaryGoals(profile.context,change.primary_goals);
    prepared.context=context;prepared.content_hash=hashBusinessProfileAnalysis(context,profile.intakeType);
  }
  const {data,error}=await client().rpc("mcp_mutate_business_onboarding",{p_user_id:owner,p_request_id:key,p_input:input,p_prepared:prepared,p_background_enrolled:isBackgroundOnboardingEnabled(owner)});
  if(error)fail(error);
  const result=z.object({replayed:z.boolean(),receipt:z.unknown()}).parse(data),accepted=receipt(result.receipt,key,owner);
  await dispatch(owner,accepted.job_ids);
  return {replayed:result.replayed,receipt:accepted};
}
const cursorSchema=z.strictObject({v:z.literal(1),binding:z.string().regex(/^[a-f0-9]{64}$/),time:z.string().datetime({offset:true}),id:z.uuid()});
export async function listMcpBusinessOnboardingRequests(owner:string,input:{limit:number;cursor?:string}) {
  const binding=createHash("sha256").update(`onboarding:${owner}`).digest("hex");
  let cursor:z.infer<typeof cursorSchema>|null=null;
  if(input.cursor)try{if(!/^[A-Za-z0-9_-]+$/.test(input.cursor))throw Error();cursor=cursorSchema.parse(JSON.parse(Buffer.from(input.cursor,"base64url").toString("utf8")));if(cursor.binding!==binding)throw Error();}
  catch{throw new ToolFailure("INVALID_CURSOR","Restart onboarding history for the connected account.");}
  let query=client().from("mcp_business_onboarding_requests").select("request_id,mode,action,created_at").eq("user_id",owner).order("created_at",{ascending:false}).order("request_id",{ascending:false}).limit(input.limit+1);
  if(cursor)query=query.or(`created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},request_id.lt.${cursor.id})`);
  const {data,error}=await query;if(error)fail(error);
  const entries=z.array(z.strictObject({request_id:z.uuid(),mode:z.enum(["legacy","background"]),action:z.enum(["start","identity","goals","submit","edit"]),created_at:z.string().datetime({offset:true})})).parse(data??[]);
  const items=entries.slice(0,input.limit),last=items.at(-1);
  return {items,next_cursor:entries.length>input.limit&&last?Buffer.from(JSON.stringify({v:1,binding,time:last.created_at,id:last.request_id})).toString("base64url"):null};
}
