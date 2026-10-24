import "server-only";
import { createClient } from "@supabase/supabase-js";
import { EMPTY_CAPTION_LIBRARY, parseSavedCaptionLibrary, type SavedCaptionLibrary } from "./saved-captions";

export class SavedCaptionConflictError extends Error {}
function client() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Caption storage unavailable.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
const columns = "captions,default_caption_id,revision";
const read = (row: { captions: unknown; default_caption_id: unknown; revision: unknown }) => parseSavedCaptionLibrary({ captions: row.captions, defaultId: row.default_caption_id, revision: row.revision });
export async function getSavedCaptions(owner: string): Promise<SavedCaptionLibrary> {
  const { data, error } = await client().from("user_saved_captions").select(columns).eq("user_id", owner).maybeSingle();
  if (error) throw new Error("Could not load saved captions.");
  return data ? read(data) : { ...EMPTY_CAPTION_LIBRARY };
}
export async function saveCaptionLibrary(owner: string, input: SavedCaptionLibrary): Promise<SavedCaptionLibrary> {
  const values = { captions: input.captions, default_caption_id: input.defaultId, revision: input.revision + 1, updated_at: new Date().toISOString() };
  const table = client().from("user_saved_captions");
  const { data, error } = input.revision === 0
    ? await table.insert({ ...values, user_id: owner }).select(columns).single()
    : await table.update(values).eq("user_id", owner).eq("revision", input.revision).select(columns).maybeSingle();
  if (error?.code === "23505" || !error && !data) throw new SavedCaptionConflictError("Saved captions changed in another tab. Review the latest list and try again.");
  if (error || !data) throw new Error("Could not save captions.");
  return read(data);
}
