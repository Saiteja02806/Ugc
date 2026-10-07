import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ExploreFinishError, isExploreUuid } from "../lib/explore-finishing-contract.js";
import { ExploreFinishingStore } from "../lib/explore-finishing-store.js";
import type { ExploreFinishReceipt } from "../lib/explore-finishing-store.js";
import { ExploreFinishingStorage } from "../lib/explore-finishing-storage.js";
import { isPrivateMedia } from "../lib/private-media.js";
import { finishExploreVideo } from "../lib/explore-video-finishing.js";
import { RetryableJobError } from "../retryable-job-error.js";
import type { BackgroundJobRow } from "../types.js";
import type { WorkerJobContext } from "./index.js";
import { configuredScribeProvider, type ScribeTranscriptionProvider } from "../subtitles/elevenlabs-provider.js";
import { parsePlacement, parseStyle } from "../subtitles/contracts.js";

export type ExploreFinishingDependencies = {
  store: Pick<ExploreFinishingStore,"read"|"asset"|"claimSpeech"|"saveSpeech"|"finalize">;
  storage: Pick<ExploreFinishingStorage,"existing"|"download"|"upload">;
  finish: typeof finishExploreVideo;
  /** Explicitly chosen/configured provider; never fall back to another paid API. */
  transcription?: ScribeTranscriptionProvider;
};

async function finalizeStoredOutput(deps: ExploreFinishingDependencies, receipt: ExploreFinishReceipt, claimToken: string, output: Record<string,unknown>) {
  try { await deps.store.finalize(receipt,claimToken,output); }
  catch (error) {
    if (error instanceof ExploreFinishError && error.status !== 503) throw error;
    throw new RetryableJobError("The finished video is stored; its saved-media record will be recovered without generating it again.",{ code:"explore_finish_finalization_pending",retryAfterSeconds:30 });
  }
}

export async function runFinishExploreVideoJob(job: BackgroundJobRow, context: Pick<WorkerJobContext,"checkpoint">, dependencies?: ExploreFinishingDependencies) {
  const input = job.input_json && typeof job.input_json === "object" && !Array.isArray(job.input_json) ? job.input_json : {};
  if (job.job_type !== "render_demo_video" || !job.user_id || !isExploreUuid(input.requestKey) || input.version !== 1 ||
      input.userId !== job.user_id || typeof input.fingerprint !== "string" || !isExploreUuid(input.outputAssetId) || !job.claim_token ||
      job.project_id !== "explore" || job.idempotency_key !== `explore-finish:${input.requestKey}`) throw new ExploreFinishError("Invalid owned finishing job.",409);
  const deps: ExploreFinishingDependencies = dependencies ?? { store:new ExploreFinishingStore(),storage:new ExploreFinishingStorage(),finish:finishExploreVideo };
  const receipt = await deps.store.read(job.user_id,input.requestKey);
  if (!receipt || receipt.job_id !== job.id || receipt.fingerprint !== input.fingerprint || receipt.output_asset_id !== input.outputAssetId) throw new ExploreFinishError("The finishing request does not belong to this job.",409);
  // Completed asset recovery is owner checked too; return a durable media ID,
  // not an unverified URL from a previous worker delivery.
  if (receipt.status === "completed") {
    await deps.store.asset(job.user_id,receipt.output_asset_id,"video");
    return { mediaAssetId:receipt.output_asset_id,requestKey:receipt.request_key };
  }
  const recovered = await deps.storage.existing(receipt);
  if (recovered) {
    await context.checkpoint({ status:"uploading_output",stage:"saving_finished_video",progress:95 });
    await finalizeStoredOutput(deps,receipt,job.claim_token,recovered);
    return { mediaAssetId:receipt.output_asset_id,requestKey:receipt.request_key };
  }
  // Already stored output and subtitles-off jobs do not depend on ASR secrets.
  if (receipt.draft.subtitles && !deps.transcription && !dependencies) deps.transcription = configuredScribeProvider();
  if (receipt.draft.subtitles && !deps.transcription) throw new ExploreFinishError("Subtitle transcription needs an explicitly configured provider before processing.",503);
  const { draft } = receipt;
  // Reject unknown styles before a paid claim; each approved style uses its
  // matching renderer and font checks without silently substituting a preview.
  const subtitleStyle = draft.subtitles ? parseStyle(draft.subtitles.style) : null;
  const subtitlePlacement = draft.subtitles ? parsePlacement(draft.subtitles.placement) : null;
  // Verify ALL selected sources before downloading or making provider claims.
  const selections = [
    { id:draft.sourceAssetId,collection:"video" as const,max:250*1024*1024 },
    ...(draft.demoAssetId ? [{ id:draft.demoAssetId,collection:"video" as const,max:250*1024*1024 }] : []),
    ...(draft.demoAudioAssetId ? [{ id:draft.demoAudioAssetId,collection:"audio" as const,max:50*1024*1024 }] : []),
    ...(draft.backgroundAssetId ? [{ id:draft.backgroundAssetId,collection:"audio" as const,max:50*1024*1024 }] : []),
  ];
  const assets = await Promise.all(selections.map(selection => deps.store.asset(job.user_id!,selection.id,selection.collection)));
  const directory = await mkdtemp(join(tmpdir(),"ugc-explore-finish-"));
  const controller = new AbortController();
  let checkpointFailure: unknown;
  let checking = false;
  let watch: ReturnType<typeof setInterval> | undefined;
  try {
    await context.checkpoint({ status:"processing",stage:"downloading_owned_media",progress:10 });
    for (let i=0;i<assets.length;i++) await deps.storage.download(assets[i].storage_key,join(directory,`source-${i}`),selections[i].max,
      isPrivateMedia(assets[i].metadata) ? "private_user_media" : "primary");
    await context.checkpoint({ status:"rendering",stage:"composing_explore_video",progress:30 });
    let i=1;
    const demoPath = draft.demoAssetId ? join(directory,`source-${i++}`) : undefined;
    const demoAudioPath = draft.demoAudioAssetId ? join(directory,`source-${i++}`) : undefined;
    const backgroundMusicPath = draft.backgroundAssetId ? join(directory,`source-${i++}`) : undefined;
    const tools = { ffmpeg:process.env.FFMPEG_PATH || "ffmpeg",ffprobe:process.env.FFPROBE_PATH || "ffprobe",
      fontsDir:process.env.SUBTITLE_FONTS_DIR || fileURLToPath(new URL("../../assets/fonts/",import.meta.url)) };
    // Cancellation/lost leases stop long media and provider operations too,
    // rather than waiting until an already finished render is uploaded.
    watch = setInterval(() => {
      if (checking || controller.signal.aborted) return;
      checking = true;
      void context.checkpoint({ status:"rendering",stage:"finishing_owned_video",progress:40 }).catch(error => {
        checkpointFailure = error; controller.abort(error);
      }).finally(() => { checking = false; });
    }, 5000);
    const result = await deps.finish({ sourcePath:join(directory,"source-0"),demoPath,demoAudioPath,backgroundMusicPath,signal:controller.signal,
      ...(draft.demoFraming ? { demoFraming: draft.demoFraming } : {}),
      ...(demoAudioPath ? { demoAudioPlayback:draft.demoAudioPlayback } : {}),
      ...(backgroundMusicPath ? { backgroundMusicPlayback:draft.backgroundPlayback } : {}),workDir:join(directory,"render"),tools,
      ...(draft.subtitles && subtitleStyle && subtitlePlacement ? { subtitles:{ ...draft.subtitles,style:subtitleStyle,placement:subtitlePlacement,loadTranscript:async (speech) => {
        await context.checkpoint({ status:"waiting_external_service",stage:"transcribing_composed_audio",progress:55 });
        const duration = Math.ceil(speech.durationMs);
        const provider = deps.transcription!;
        const prepared = await provider.prepare(speech.audioPath,duration,controller.signal);
        if (prepared.sourceHash !== speech.sourceHash) throw new ExploreFinishError("The speech file changed before transcription.",409);
        const claim = await deps.store.claimSpeech(receipt,job.claim_token!,speech.sourceHash,duration,provider.id);
        if (claim.state === "ready") return claim.transcript;
        if (claim.state === "uncertain") throw new ExploreFinishError("The transcription may already have been submitted. It will not be submitted again automatically.",409,"provider_submission_uncertain");
        await context.checkpoint({ status:"waiting_external_service",stage:"transcribing_composed_audio",progress:55 });
        const transcript = await prepared.submit();
        // Durable transcript is saved BEFORE caption rendering or output upload.
        return deps.store.saveSpeech(receipt,speech.sourceHash,duration,transcript,provider.id);
      } } } : {}),
    });
    if (watch) { clearInterval(watch); watch = undefined; }
    if (checkpointFailure) throw checkpointFailure;
    await context.checkpoint({ status:"uploading_output",stage:"uploading_finished_video",progress:85 });
    let output: Record<string,unknown>;
    try {
      output = await deps.storage.upload(receipt,result.outputPath,{ durationSeconds:result.durationMs/1000,width:result.width,height:result.height,
        ratio:assets[0].ratio || "other",metadata:{ sourceHashes:result.sourceHashes,segments:result.segments,
          demoAudioTiming:result.demoAudioTiming,backgroundMusicTiming:result.backgroundMusicTiming,subtitleStyle:result.subtitleStyle,subtitlePlacement:result.subtitlePlacement,subtitleWordCount:result.subtitleWordCount,
          subtitleRenderVersion:result.subtitleRenderVersion,subtitleAudioTimeline:"final-composition-v1",
          ...(draft.demoFraming ? { demoFraming: draft.demoFraming } : {}) } });
    }
    catch (error) {
      if (error instanceof ExploreFinishError) throw error;
      // The write may have succeeded before its response was lost. A retry
      // first checks the deterministic object and its owned provenance. If it
      // must recompose, the transcript is already durable, never resubmitted.
      throw new RetryableJobError("The output upload is unconfirmed; the same owned output will be checked before retrying.",{ code:"explore_finish_upload_uncertain",retryAfterSeconds:30 });
    }
    await context.checkpoint({ status:"uploading_output",stage:"saving_finished_video",progress:95 });
    await finalizeStoredOutput(deps,receipt,job.claim_token,output);
    return { mediaAssetId:receipt.output_asset_id,requestKey:receipt.request_key };
  } catch (error) {
    throw checkpointFailure ?? error;
  } finally {
    if (watch) clearInterval(watch);
    // Only this newly-created worker directory. Never touch uploaded sources.
    if (resolve(directory).startsWith(resolve(tmpdir()) + "/") || resolve(directory).startsWith(resolve(tmpdir()) + "\\")) await rm(directory,{ recursive:true,force:true });
  }
}
