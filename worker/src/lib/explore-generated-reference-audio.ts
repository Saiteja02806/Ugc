import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ExploreFinishingStorage } from "./explore-finishing-storage.js";
import { renderExploreReferenceAudio, verifyReferenceAudioFile } from "./explore-reference-audio-render.js";
import type { getExplorePairedReference } from "./explore-reference-soundtrack.js";

/** A local post-process of the completed provider output; never asks an AI to reproduce the song. */
export async function applyGeneratedReferenceAudio(buffer: Buffer, reference: NonNullable<ReturnType<typeof getExplorePairedReference>>) {
  const directory = await mkdtemp(join(tmpdir(), "ugc-explore-reference-"));
  try {
    const sourcePath = join(directory, "generated.mp4"), audioPath = join(directory, "reference.mp3");
    await writeFile(sourcePath, buffer, { flag: "wx" });
    await new ExploreFinishingStorage().download(reference.audioStorageKey, audioPath, 50 * 1024 ** 2);
    await verifyReferenceAudioFile(audioPath, reference.audioSha256);
    const result = await renderExploreReferenceAudio({ sourcePath, audioPath, workDir: directory, volume: .2, replaceOriginal: true,
      tools: { ffmpeg: process.env.FFMPEG_PATH || "ffmpeg", ffprobe: process.env.FFPROBE_PATH || "ffprobe" } });
    return await readFile(result.outputPath);
  } finally {
    if (resolve(directory).startsWith(resolve(tmpdir()) + "/") || resolve(directory).startsWith(resolve(tmpdir()) + "\\")) await rm(directory, { recursive: true, force: true });
  }
}
