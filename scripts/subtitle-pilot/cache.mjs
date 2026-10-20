/** Local checkpoint store. No production ownership or storage is implied. */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SubtitleError } from "../../worker/dist/subtitles/contracts.js";

export const TEXT_POLICY = "gpt-transcribe:en:text-v1";
export const digest = value => createHash("sha256").update(value).digest("hex");
export const textCacheKey = audioHash => digest(JSON.stringify([TEXT_POLICY, audioHash]));

export async function atomicJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2), { flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

export function validateText(text) {
  if (typeof text !== "string" || text.length > 12000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) {
    throw new SubtitleError("PROVIDER_RESPONSE_INVALID", "The transcription response is unusable.");
  }
  if (!text.trim()) throw new SubtitleError("NO_SPEECH", "No spoken words were detected. Choose a video with clear speech.");
  return text.trim();
}

export async function getTextCheckpoint({ cacheDir, audioHash, submit, signal }) {
  await mkdir(cacheDir, { recursive: true });
  const path = join(cacheDir, `${textCacheKey(audioHash)}.json`), lock = `${path}.lock`;
  try { await mkdir(lock); } catch (error) {
    if (error.code === "EEXIST") throw new SubtitleError("ALREADY_RUNNING", "This recording is already being transcribed.");
    throw error;
  }
  try {
    let saved;
    try { saved = JSON.parse(await readFile(path, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw new SubtitleError("CACHE_INVALID", "The local transcript cache needs inspection before retrying."); }
    if (saved) {
      if (saved.policy !== TEXT_POLICY || saved.audioHash !== audioHash) throw new SubtitleError("CACHE_INVALID", "The saved transcript does not match this recording.");
      if (saved.status === "completed") return { text: validateText(saved.text), cacheHit: true };
      if (saved.status === "no_speech") throw new SubtitleError("NO_SPEECH", "No spoken words were detected in this recording.");
      if (saved.status === "rejected") throw new SubtitleError("TRANSCRIPT_REJECTED", "The previous transcript needs inspection. It will not be submitted again automatically.");
      throw new SubtitleError("TRANSCRIPTION_UNCERTAIN", "The previous transcription request has an uncertain outcome. Check provider usage and the local checkpoint before retrying.");
    }
    signal?.throwIfAborted();
    const identity = { policy: TEXT_POLICY, audioHash };
    await atomicJson(path, { ...identity, status: "submitting", startedAt: new Date().toISOString() });
    let text;
    try { text = validateText(await submit()); }
    catch (error) {
      if (error instanceof SubtitleError && error.code === "NO_SPEECH") await atomicJson(path, { ...identity, status: "no_speech" });
      else if (error instanceof SubtitleError && error.code === "PROVIDER_RESPONSE_INVALID") await atomicJson(path, { ...identity, status: "rejected" });
      throw error;
    }
    // Save a successful paid response even if cancellation arrived just afterward.
    await atomicJson(path, { ...identity, status: "completed", text });
    return { text, cacheHit: false };
  } finally { await rmdir(lock); }
}
