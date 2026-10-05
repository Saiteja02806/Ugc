import { isAudioUuid, parseAudioSpeech } from "../../worker/src/lib/audio-contract.ts";

export type SavedAudioSubmission = { version: 1; owner: string; key: string; payload: ReturnType<typeof parseAudioSpeech> };
export const audioSubmissionStorageKey = (owner: string) => `ugc-audio:speech:v1:${encodeURIComponent(owner)}`;
export function readAudioSubmission(raw: string | null, owner: string): SavedAudioSubmission | null {
  if (!raw) return null;
  if (raw.length > 16384) throw new Error("The saved audio request could not be verified.");
  const v = JSON.parse(raw) as SavedAudioSubmission;
  if (v?.version !== 1 || v.owner !== owner || !isAudioUuid(v.key)) throw new Error("The saved audio request belongs to another account.");
  return { version: 1, owner, key: v.key, payload: parseAudioSpeech(v.payload) };
}
export function audioSubmissionResolved(status: string) { return ["completed", "failed", "cancelled"].includes(status); }
