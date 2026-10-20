import "server-only";
import { z } from "zod";
import { audioDb } from "@/worker/src/lib/audio-store";
import { AudioError } from "@/worker/src/lib/audio-contract";

export const AudioSelectionSchema = z.strictObject({ voiceId: z.string().regex(/^[\w-]{1,100}$/) });
export async function getAudioVoiceSelection(userId: string): Promise<string | null> {
  const { data, error } = await audioDb().from("audio_voice_preferences").select("voice_id").eq("user_id", userId).maybeSingle();
  if (error) throw new AudioError("Your selected voice could not be loaded. Try again.", 503);
  return data?.voice_id ?? null;
}
export async function setAudioVoiceSelection(userId: string, voiceId: string) {
  const { error } = await audioDb().from("audio_voice_preferences").upsert({ user_id: userId, voice_id: voiceId }, { onConflict: "user_id" });
  if (error) throw new AudioError("Your selected voice could not be saved. Try Use It again.", 503);
}
