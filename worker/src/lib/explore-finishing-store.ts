import { createClient } from "@supabase/supabase-js";
import { ExploreFinishError, parseExploreFinishReceipt, type ExploreFinishDraft, type ExploreFinishReceipt } from "./explore-finishing-contract.js";
import { validateTranscript } from "../subtitles/contracts.js";
import { SCRIBE_MODEL, SCRIBE_PROVIDER_KEY } from "../subtitles/elevenlabs-contract.js";

export { parseExploreFinishReceipt, type ExploreFinishReceipt } from "./explore-finishing-contract.js";
function database() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new ExploreFinishError("Video finishing storage is not configured.", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export class ExploreFinishingStore {
  constructor(private readonly db = database()) {}
  private async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await this.db.rpc(name, args);
    if (error) {
      const messages: Record<string,string> = {
        explore_finish_conflict: "This request was already used for different edits.",
        explore_finish_busy: "Wait for your current finishing job to end before applying another edit.",
        explore_finish_asset_unavailable: "A selected media file is no longer available.",
        explore_finish_lease_lost: "This worker no longer owns the finishing request.",
        explore_finish_source_changed: "The original speech changed; this request cannot be reused.",
        explore_finish_not_ready: "The finished video is not ready to save.",
      };
      const code = Object.keys(messages).find(code => error.message.includes(code));
      throw new ExploreFinishError(code ? messages[code] : "Could not save video finishing progress.", code ? 409 : 503, code ?? "explore_finish_storage_error");
    }
    return data as unknown;
  }
  async read(owner: string, key: string) {
    const { data, error } = await this.db.from("explore_video_finishes").select("*").eq("user_id",owner).eq("request_key",key).maybeSingle();
    if (error) throw new ExploreFinishError("Could not read the saved finishing request.",503);
    return data ? parseExploreFinishReceipt(data,owner,key) : null;
  }
  async create(owner: string, key: string, fingerprint: string, draft: ExploreFinishDraft) {
    const receipt = parseExploreFinishReceipt(await this.rpc("explore_create_video_finish", { p_user_id:owner,p_request_key:key,p_fingerprint:fingerprint,p_draft:draft }),owner,key);
    if (receipt.fingerprint !== fingerprint || JSON.stringify(receipt.draft) !== JSON.stringify(draft)) throw new ExploreFinishError("The saved finishing draft is different.",409);
    return receipt;
  }
  async asset(owner: string, id: string, collection: "video" | "audio") {
    let query = this.db.from("media_assets").select("id,user_id,collection,mime_type,status,deleted_at,storage_key,ratio,file_size_bytes,source_type,metadata")
      .eq("id",id).eq("user_id",owner).eq("status","ready").is("deleted_at",null);
    query = collection === "video" ? query.in("collection", ["video", "influencer"]).like("mime_type", "video/%") : query.eq("collection", collection);
    const { data, error } = await query.maybeSingle();
    if (error) throw new ExploreFinishError("Could not check the selected media.",503);
    if (!data || typeof data.storage_key !== "string" || !data.storage_key || data.storage_key.includes("..") || data.storage_key.startsWith("/") || data.storage_key.includes("\\") || data.storage_key.includes(":")) throw new ExploreFinishError("The selected media is unavailable.",404);
    return data;
  }
  async claimSpeech(receipt: ExploreFinishReceipt, claimToken: string, sourceHash: string, durationMs: number, providerKey: string) {
    if (providerKey !== SCRIBE_PROVIDER_KEY) throw new ExploreFinishError("The transcription provider is not approved.",409);
    const raw = await this.rpc("explore_claim_transcription",{ p_user_id:receipt.user_id,p_request_key:receipt.request_key,p_job_id:receipt.job_id,
      p_claim_token:claimToken,p_speech_hash:sourceHash,p_duration_ms:durationMs,p_provider_key:providerKey });
    const claim = raw as { state?: unknown; transcript?: unknown } | null;
    if (claim?.state === "ready") {
      const transcript = validateTranscript(claim.transcript,durationMs);
      if (transcript.provider !== "elevenlabs" || transcript.model !== SCRIBE_MODEL || transcript.language !== "en") throw new ExploreFinishError("The cached speech result uses a different provider or language.",409);
      return { state:"ready" as const, transcript };
    }
    if (claim?.state === "submit" || claim?.state === "uncertain") return { state:claim.state };
    throw new ExploreFinishError("Could not verify the transcription claim.",503);
  }
  async saveSpeech(receipt: ExploreFinishReceipt, sourceHash: string, durationMs: number, transcript: unknown, providerKey: string) {
    const parsed = validateTranscript(transcript,durationMs);
    if (providerKey !== SCRIBE_PROVIDER_KEY || parsed.provider !== "elevenlabs" || parsed.model !== SCRIBE_MODEL || parsed.language !== "en") throw new ExploreFinishError("The speech result uses a different provider or language.",409);
    const saved = await this.rpc("explore_save_transcription",{ p_user_id:receipt.user_id,p_request_key:receipt.request_key,p_job_id:receipt.job_id,
      p_speech_hash:sourceHash,p_duration_ms:durationMs,p_transcript:parsed,p_provider_key:providerKey });
    if (saved !== true) throw new ExploreFinishError("The speech result could not be saved; it will not be submitted again automatically.",503);
    return parsed;
  }
  async finalize(receipt: ExploreFinishReceipt, claimToken: string, output: Record<string,unknown>) {
    const id = await this.rpc("explore_finalize_video_finish",{ p_user_id:receipt.user_id,p_request_key:receipt.request_key,p_job_id:receipt.job_id,p_claim_token:claimToken,p_output:output });
    if (id !== receipt.output_asset_id) throw new ExploreFinishError("Could not verify the saved finished video.",503);
    return id as string;
  }
}
