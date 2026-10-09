import "server-only";
import { z } from "zod";
import { audioDb } from "@/worker/src/lib/audio-store";
import { AudioError } from "@/worker/src/lib/audio-contract";

export const AudioBookmarkSchema = z.strictObject({
  voiceId: z.string().regex(/^[\w-]{1,100}$/),
  bookmarked: z.boolean(),
});

export async function getAudioBookmarks(userId: string): Promise<string[]> {
  const { data, error } = await audioDb().from("audio_voice_bookmarks")
    .select("voice_id").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw new AudioError("Your bookmarks could not be loaded. Try again.", 503);
  return (data ?? []).map(row => row.voice_id as string);
}

export async function setAudioBookmark(userId: string, voiceId: string, bookmarked: boolean) {
  // A bookmark is an account preference, never permission to use a provider voice.
  // Resolve its ID against the owner's current catalogue before displaying it.
  const query = audioDb().from("audio_voice_bookmarks");
  const { error } = bookmarked
    ? await query.upsert({ user_id: userId, voice_id: voiceId }, { onConflict: "user_id,voice_id", ignoreDuplicates: true })
    : await query.delete().eq("user_id", userId).eq("voice_id", voiceId);
  if (error) throw new AudioError("Your bookmark could not be saved. Try again.", 503);
}
