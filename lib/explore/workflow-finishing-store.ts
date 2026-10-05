import "server-only";

import { createClient } from "@supabase/supabase-js";
import { ExploreFinishError, parseExploreFinishReceipt, type ExploreFinishDraft } from "@/worker/src/lib/explore-finishing-contract";

function database() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new ExploreFinishError("Video finishing storage is not configured.",503);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

/** App-only reservation/recovery. Transcription claims, files and paid API
 * clients stay in the worker; both runtimes use the same pure receipt parser. */
export class ExploreFinishingRequestStore {
  constructor(private readonly db = database()) {}
  async read(owner: string, key: string) {
    const { data,error } = await this.db.from("explore_video_finishes").select("user_id,request_key,fingerprint,draft,job_id,output_asset_id,status")
      .eq("user_id",owner).eq("request_key",key).maybeSingle();
    if (error) throw new ExploreFinishError("Could not read the saved finishing request.",503);
    return data ? parseExploreFinishReceipt(data,owner,key) : null;
  }
  async create(owner: string, key: string, fingerprint: string, draft: ExploreFinishDraft) {
    const { data,error } = await this.db.rpc("explore_create_video_finish",{p_user_id:owner,p_request_key:key,p_fingerprint:fingerprint,p_draft:draft});
    if (error) {
      const messages: Record<string,string> = {
        explore_finish_conflict: "This request was already used for different edits.",
        explore_finish_busy: "Wait for your current finishing job to end before applying another edit.",
        explore_finish_asset_unavailable: "A selected media file is no longer available.",
      };
      const code = Object.keys(messages).find(code => error.message.includes(code));
      throw new ExploreFinishError(code ? messages[code] : "Could not save the finishing request.",code ? 409 : 503,code ?? "explore_finish_storage_error");
    }
    const receipt = parseExploreFinishReceipt(data,owner,key);
    if (receipt.fingerprint !== fingerprint || JSON.stringify(receipt.draft) !== JSON.stringify(draft)) throw new ExploreFinishError("The saved finishing draft is different.",409);
    return receipt;
  }
  async asset(owner: string, id: string, collection: "video") {
    const { data,error } = await this.db.from("media_assets").select("id,user_id,collection,status,deleted_at")
      .eq("id",id).eq("user_id",owner).eq("collection",collection).eq("status","ready").is("deleted_at",null).maybeSingle();
    if (error) throw new ExploreFinishError("Could not check the finished video.",503);
    if (!data || data.id !== id || data.user_id !== owner || data.collection !== collection || data.status !== "ready" || data.deleted_at !== null) throw new ExploreFinishError("The finished video is unavailable.",404);
    return data;
  }
}
