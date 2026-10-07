import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { composeExploreVideo } from "./explore-video-composition.js";
import { assertExploreSubtitleScope } from "../subtitles/explore-policy.js";
import { parsePlacement, parseStyle, SubtitleError, validateTranscript, type SubtitlePlacement, type SubtitleStyle } from "../subtitles/contracts.js";
import { getSubtitleLayout, groupSubtitleWords, serializeAss, serializeSrt, serializeVtt } from "../subtitles/captions.js";
import { groupNaturalSubtitleWords } from "../subtitles/phrases.js";
import { createTextMeasurer, prepareSubtitleFonts, probeVideo, renderSubtitleVideo, type SubtitleTools } from "../subtitles/media.js";
import { planEditorialPages, serializeEditorialAss } from "../subtitles/editorial.js";
import { createEditorialMeasurer, prepareEditorialFonts } from "../subtitles/editorial-media.js";
import { createDynamicMeasurer, serializeDynamicAss } from "../subtitles/dynamic.js";
import { isDynamicSubtitleStyle, subtitleStyleDefinition } from "../subtitles/styles.js";

export type ExploreSpeechIdentity = { audioPath: string; sourceHash: string; durationMs: number; language: "en" };
export type ExploreFinishingOptions = Omit<Parameters<typeof composeExploreVideo>[0], "subtitleScope"> & {
  tools: SubtitleTools;
  subtitles?: {
    language: "en";
    style: SubtitleStyle;
    placement?: SubtitlePlacement;
    /** The production handler must supply owner-scoped durable transcription.
     * Never attach the lab's ephemeral cache or an automatically retried paid call. */
    loadTranscript: (speech: ExploreSpeechIdentity) => Promise<unknown>;
  };
};

async function digestFile(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

/** Worker finishing pipeline for downloaded local snapshots. Authenticated input
 * ownership, durable transcription/receipts, GCP publication and saved-asset
 * finalization remain responsibilities of the production job/API boundary. */
export async function finishExploreVideo(options: ExploreFinishingOptions) {
  const subtitles = options.subtitles;
  // Validate style before any composition or later paid transcription.
  const style = subtitles ? parseStyle(subtitles.style) : null;
  const placement = subtitles ? parsePlacement(subtitles.placement ?? "bottom") : null;
  if (subtitles && subtitles.language !== "en") assertExploreSubtitleScope(subtitles.language, 1);
  const composition = await composeExploreVideo({ ...options, subtitleScope: subtitles ? { language: subtitles.language } : undefined });
  if (!subtitles) return { ...composition, subtitleStyle: null, subtitlePlacement: null, subtitleWordCount: 0, subtitleRenderVersion: null };
  if (!composition.subtitleAudioPath || !style || !placement) throw new SubtitleError("SUBTITLE_INPUT_INVALID", "The final audio track could not be prepared.");
  assertExploreSubtitleScope(subtitles.language, composition.durationMs);
  const captionDir = join(dirname(composition.outputPath), "subtitles");
  await mkdir(captionDir);
  await copyFile(composition.outputPath, join(captionDir, "source-video"), constants.COPYFILE_EXCL);
  const video = await probeVideo(join(captionDir, "source-video"), options.tools, options.signal);
  assertExploreSubtitleScope(subtitles.language, video.durationMs);
  // Confirm fonts/runtime inputs BEFORE requesting transcription.
  if (style === "editorial") await prepareEditorialFonts(options.tools, captionDir);
  else await prepareSubtitleFonts(options.tools, captionDir);
  const layout = getSubtitleLayout(video.width, video.height, style);
  const editorialMeasure = style === "editorial" ? createEditorialMeasurer(layout, options.tools, captionDir, options.signal) : null;
  const measure = editorialMeasure ? (text: string) => editorialMeasure(text, layout.fontSize, "lead").then(ink => ink.width) : createTextMeasurer(layout, options.tools);
  await measure("Subtitle font check");
  const sourceHash = await digestFile(composition.subtitleAudioPath);
  options.signal?.throwIfAborted();
  const transcript = validateTranscript(await subtitles.loadTranscript({ audioPath: composition.subtitleAudioPath,
    sourceHash, durationMs: composition.durationMs, language: subtitles.language }), composition.durationMs);
  options.signal?.throwIfAborted();
  // Do not present a forced-language result as proof of English speech.
  if (!transcript.language || !["en", "eng", "english"].includes(transcript.language.trim().toLowerCase())) {
    throw new SubtitleError("SUBTITLE_LANGUAGE_UNSUPPORTED", "Auto subtitles support English speech only. No captioned output was published.");
  }
  const cues = await (isDynamicSubtitleStyle(style) ? groupSubtitleWords : groupNaturalSubtitleWords)(transcript.words, layout, measure);
  const ass = editorialMeasure ? serializeEditorialAss(await planEditorialPages(cues, layout, placement, editorialMeasure), layout)
    : isDynamicSubtitleStyle(style) ? await serializeDynamicAss(cues, layout, style as "word-pop" | "karaoke" | "marker-highlight", placement,
      createDynamicMeasurer(layout, options.tools, captionDir, options.signal)) : serializeAss(cues, layout, style, placement);
  await writeFile(join(captionDir, "captions.ass"), ass, { flag: "wx" });
  await writeFile(join(captionDir, "captions.srt"), serializeSrt(cues), { flag: "wx" });
  await writeFile(join(captionDir, "captions.vtt"), serializeVtt(cues), { flag: "wx" });
  await renderSubtitleVideo(captionDir, video, options.tools, options.signal);
  const outputPath = join(captionDir, "captioned.mp4");
  const result = await probeVideo(outputPath, options.tools, options.signal);
  assertExploreSubtitleScope(subtitles.language, result.durationMs);
  options.signal?.throwIfAborted();
  return { ...composition, outputPath, subtitleStyle: style, subtitlePlacement: placement, subtitleWordCount: transcript.words.length,
    subtitleRenderVersion: subtitleStyleDefinition(style).renderVersion };
}
