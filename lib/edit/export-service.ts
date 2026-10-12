import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { EditDraftError, editDraftRevision, parseEditDraft } from "./draft-contract";
import { getSavedEditDraftForOwner } from "./saved-drafts";
import { normalizeEditableVideoDraftInput } from "./video-library";
import { buildEditOverlayTextLayout } from "./overlay-render-spec";
import { getMediaAssetForOwner, serializeMediaAsset } from "@/lib/media/media-storage";
import { isEditableMediaAsset } from "@/lib/media/editable-video";
import { isTrustedMediaReferenceUrl } from "@/lib/media/media-reference";
import { getBackgroundJobForUser, getMissingBackgroundJobStorageEnvVars, type BackgroundJobRecord } from "@/lib/jobs/background-jobs";
import { dispatchQueuedBackgroundJobForRecovery } from "@/lib/jobs/background-job-service";
import { getMissingBackgroundJobCloudTasksEnvVars } from "@/lib/jobs/gcp-cloud-tasks";

const payloadSchema = z.object({ renderId:z.uuid(), userId:z.string(), projectId:z.string(), sourceVideoId:z.uuid(),
  sourceVideoUrl:z.string(), ratio:z.enum(["9:16","1:1","4:5","16:9"]), draft:z.unknown() });
const receiptSchema = z.object({ user_id:z.string(), request_id:z.uuid(), draft_id:z.uuid(), expected_revision:editDraftRevision,
  render_id:z.uuid(), job_id:z.uuid(), output_asset_id:z.uuid(), render_payload:payloadSchema });
type Receipt = z.infer<typeof receiptSchema>;
export function editExportRuntime() {
  return { enabled:process.env.MCP_VIDEO_FINISHING_ENABLED === "true", configured:
    !getMissingBackgroundJobStorageEnvVars().length && !getMissingBackgroundJobCloudTasksEnvVars(["render_edit_video"]).length };
}
function unavailable(): never { throw new EditDraftError("EXPORT_UNAVAILABLE","Could not confirm the export. Keep the same request ID and check its status before submitting again.",503); }
function db() {
  const url=process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key)unavailable();
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function verifyReceipt(value:unknown,owner:string,key:string):Receipt {
  const parsed=receiptSchema.safeParse(value); if(!parsed.success)unavailable();
  const r=parsed.data,p=r.render_payload;
  if(r.user_id!==owner||r.request_id!==key||p.userId!==owner||p.renderId!==r.render_id)unavailable();
  return r;
}
async function readReceipt(owner:string,key:string) {
  const {data,error}=await db().from("edit_export_requests").select("*").eq("user_id",owner).eq("request_id",key).maybeSingle();
  if(error)unavailable();return data?verifyReceipt(data,owner,key):null;
}
function identity(owner:string,key:string) {
  if(!owner.trim()||!z.uuid().safeParse(key).success)throw new EditDraftError("INVALID_INPUT","Use a saved export request UUID.");
  return key.toLowerCase();
}
async function jobFor(r:Receipt) {
  const job=await getBackgroundJobForUser({userId:r.user_id,jobId:r.job_id});
  const p=payloadSchema.safeParse(job?.input);
  if(!job||job.userId!==r.user_id||job.jobType!=="render_edit_video"||job.projectId!==r.render_payload.projectId||
    job.idempotencyKey!==`edit-export:${r.request_id}`||!p.success||
    JSON.stringify(p.data)!==JSON.stringify(r.render_payload))unavailable();
  return job;
}
async function resultFor(r:Receipt) {
  const job=await jobFor(r);
  const {data:render,error}=await db().from("video_render_jobs").select("status,ratio,draft_json,source_video_id,project_id")
    .eq("user_id",r.user_id).eq("render_id",r.render_id).maybeSingle();
  if(error||!render||render.source_video_id!==r.render_payload.sourceVideoId||render.project_id!==r.render_payload.projectId||
    render.ratio!==r.render_payload.ratio)unavailable();
  const output_asset_ids:string[]=[];
  if(render.status==="completed") {
    const asset=await getMediaAssetForOwner({userId:r.user_id,assetId:r.output_asset_id});
    if(asset?.status==="ready"&&asset.deleted_at===null&&asset.user_id===r.user_id&&asset.collection==="video"&&
      asset.source_type==="edit_export"&&asset.source_record_id===r.render_id&&asset.parent_asset_id===r.render_payload.sourceVideoId)output_asset_ids.push(asset.id);
  }
  const outcome=render.status==="completed"?output_asset_ids.length?"completed":"output_unavailable":
    job.status==="cancelled"?"cancelled":render.status==="failed"||job.status==="failed"?"failed":"pending";
  return {request_id:r.request_id,draft_id:r.draft_id,revision:r.expected_revision,job_id:r.job_id,outcome,status:job.status,
    progress:typeof job.progress==="number"&&Number.isFinite(job.progress)?Math.min(100,Math.max(0,job.progress)):null,output_asset_ids,
    message:outcome==="completed"?"Your Edit export is ready. Retrieve its output asset to download it.":
      outcome==="output_unavailable"?"The render completed, but its output or source was removed or is unavailable.":
      outcome==="failed"?"The Edit export failed. Your saved draft is preserved.":
      outcome==="cancelled"?"The Edit export was cancelled. Your saved draft is preserved.":"Your saved Edit revision is queued or processing."};
}
export async function getEditExportForOwner(owner:string,requestId:string) {
  const key=identity(owner,requestId),r=await readReceipt(owner,key);
  if(!r)return {request_id:key,draft_id:null,revision:null,job_id:null,outcome:"unconfirmed",status:null,progress:null,output_asset_ids:[],
    message:"This export request is not confirmed. Keep the same request ID when checking or submitting again."};
  return resultFor(r);
}
// History can recover a lost request UUID without trusting the worker output or
// submitting/requeuing anything. Legacy website renders have no export receipt.
export async function getEditExportForOperation(owner:string,job:BackgroundJobRecord) {
  if(job.userId!==owner)throw new EditDraftError("NOT_FOUND","Operation not found.",404);
  if(job.jobType!=="render_edit_video"||!job.idempotencyKey?.startsWith("edit-export:"))return null;
  const key=job.idempotencyKey.slice("edit-export:".length);
  if(!z.uuid().safeParse(key).success)return null;
  const receipt=await readReceipt(owner,identity(owner,key));
  if(!receipt||receipt.job_id!==job.id)unavailable();
  return resultFor(receipt);
}
export async function startEditExportForOwner(params:{userId:string;requestId:string;draftId:string;expectedRevision:number}) {
  const key=identity(params.userId,params.requestId),draftId=params.draftId.toLowerCase();
  if(!z.uuid().safeParse(draftId).success||!editDraftRevision.safeParse(params.expectedRevision).success)
    throw new EditDraftError("INVALID_INPUT","Read the saved draft and its revision before exporting.");
  let receipt=await readReceipt(params.userId,key),replayed=!!receipt;
  if(receipt&&(receipt.draft_id!==draftId||receipt.expected_revision!==params.expectedRevision))
    throw new EditDraftError("EXPORT_REQUEST_CONFLICT","This export request was already used for a different draft or revision.",409);
  if(!receipt) {
    const runtime=editExportRuntime();
    if(!runtime.enabled||!runtime.configured)throw new EditDraftError("EXPORT_UNAVAILABLE","IDE Edit export is not enabled or configured.",503);
    const row=await getSavedEditDraftForOwner(params.userId,draftId);
    if(row.draft_revision!==params.expectedRevision)throw new EditDraftError("DRAFT_CHANGED","The saved draft changed. Reread it before choosing a revision to export.",409);
    const asset=z.uuid().safeParse(row.source_video_id).success?await getMediaAssetForOwner({userId:params.userId,assetId:row.source_video_id}):null;
    if(!asset||asset.status!=="ready"||asset.deleted_at!==null||!isEditableMediaAsset(serializeMediaAsset(asset)))
      throw new EditDraftError("NOT_FOUND","The source video is no longer available for export.",404);
    if(asset.url!==row.source_video_url||!isTrustedMediaReferenceUrl(asset.url))
      throw new EditDraftError("SOURCE_CHANGED","The saved source changed or cannot be exported safely. Reopen the source before exporting.",409);
    const draft=parseEditDraft(normalizeEditableVideoDraftInput(row.draft_json)??{trimStartSeconds:0,trimEndSeconds:null,textOverlays:[]},asset.duration_seconds);
    if(draft.textOverlays.some(o=>buildEditOverlayTextLayout(o.text,o.style,row.ratio).isTruncated))
      throw new EditDraftError("TEXT_DOES_NOT_FIT","A text layer has too many line breaks. Shorten it before exporting.");
    const {data,error}=await db().rpc("edit_start_export",{p_user_id:params.userId,p_request_id:key,p_draft_id:draftId,
      p_expected_revision:params.expectedRevision,p_stored_draft:row.draft_json,p_render_draft:draft,p_source_url:asset.url});
    if(error) {
      const known:Record<string,[string,string,number]>={edit_export_not_found:["NOT_FOUND","The draft or source was removed.",404],
        edit_export_changed:["DRAFT_CHANGED","The draft changed before export. Reread it before exporting.",409],
        edit_export_source_changed:["SOURCE_CHANGED","The saved source changed. Reopen it before exporting.",409],
        edit_export_request_conflict:["EXPORT_REQUEST_CONFLICT","This request ID was already used for another draft or revision.",409],
        edit_export_invalid:["INVALID_DRAFT","Review the saved trim range before exporting.",400]};
      const match=Object.entries(known).find(([code])=>error.message.includes(code));
      if(match)throw new EditDraftError(...match[1]);unavailable();
    }
    if(!data||typeof data.replayed!=="boolean")unavailable();
    receipt=verifyReceipt(data.receipt,params.userId,key);replayed=data.replayed;
    if(receipt.draft_id!==draftId||receipt.expected_revision!==params.expectedRevision)unavailable();
  }
  await dispatchQueuedBackgroundJobForRecovery(await jobFor(receipt));
  return {...await resultFor(receipt),replayed};
}
