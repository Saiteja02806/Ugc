import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { composeExploreVideo } from "./explore-video-composition.js";
import { renderExploreFormatEdit } from "./explore-format-render.js";
import type { ExploreFormatEdit } from "./explore-format-edit.js";
import type { ExploreClipComposition } from "./explore-finishing-contract.js";
import { renderExploreReferenceAudio } from "./explore-reference-audio-render.js";
import { assertExploreSubtitleScope } from "../subtitles/explore-policy.js";
import { parsePlacement, parseStyle, SubtitleError, validateTranscript, type SubtitlePlacement, type SubtitleStyle } from "../subtitles/contracts.js";
import { getSubtitleLayout, groupSubtitleWords, serializeAss, serializeSrt, serializeVtt } from "../subtitles/captions.js";
import { groupNaturalSubtitleWords } from "../subtitles/phrases.js";
import { createTextMeasurer, prepareSubtitleFonts, probeVideo, renderSubtitleVideo, runMediaCommand, type SubtitleTools } from "../subtitles/media.js";
import { planEditorialPages, serializeEditorialAss } from "../subtitles/editorial.js";
import { createEditorialMeasurer, prepareEditorialFonts } from "../subtitles/editorial-media.js";
import { createDynamicMeasurer, serializeDynamicAss } from "../subtitles/dynamic.js";
import { isDynamicSubtitleStyle, subtitleStyleDefinition } from "../subtitles/styles.js";
import { correctSubtitleTranscript, type SubtitleCorrection } from "../subtitles/corrections.js";
import { createSerifBoxMeasurer, groupSerifBoxWords, prepareSerifBoxFonts, serializeSerifBoxAss } from "../subtitles/serif-box.js";

export type ExploreSpeechIdentity = { audioPath: string; sourceHash: string; durationMs: number; language: "en" };
export type ExploreFinishingOutput = Awaited<ReturnType<typeof composeExploreVideo>> & {
  referenceAudioBasePath: string | null;
  subtitleStyle: SubtitleStyle | null;
  subtitlePlacement: SubtitlePlacement | null;
  subtitleWordCount: number;
  subtitleRenderVersion: string | null;
};
export type ExploreFinishingOptions = Omit<Parameters<typeof composeExploreVideo>[0], "subtitleScope"> & {
  tools: SubtitleTools;
  editing?: ExploreFormatEdit;
  clipComposition?: Omit<ExploreClipComposition, "sourceAudioAssetId"> & { sourceAudioPath?: string };
  referenceAudioPath?: string;
  referenceAudioVolume?: number;
  captionPreview?: boolean;
  subtitles?: {
    language: "en";
    style: SubtitleStyle;
    placement?: SubtitlePlacement;
    version?: 2;
    corrections?: SubtitleCorrection[];
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
export async function finishExploreVideo(options: ExploreFinishingOptions): Promise<ExploreFinishingOutput> {
  // Save/edit and Schedule carry exact raw-source snapshots. Keeping their
  // bounded clip preparation in this job avoids repeated remote starts and
  // transfers, while reusing the established trim/text/audio renderer.
  if (options.clipComposition) {
    const snapshot = options.clipComposition;
    if (options.editing || snapshot.demoEditing && !options.demoPath) throw new SubtitleError("COMPOSITION_INPUT_INVALID", "Choose a complete clip composition before exporting.");
    const parent = dirname(options.workDir);
    const source = snapshot.sourceEditing ? await finishExploreVideo({
      sourcePath: options.sourcePath, editing: snapshot.sourceEditing,
      sourceOriginalVolume: options.sourceOriginalVolume,
      ...(snapshot.sourceAudioPath ? { backgroundMusicPath: snapshot.sourceAudioPath, backgroundMusicPlayback: snapshot.sourceAudioPlayback } : {}),
      tools: options.tools, workDir: join(parent, "opening-edit"), signal: options.signal,
    }) : null;
    const demo = snapshot.demoEditing && options.demoPath ? await finishExploreVideo({
      sourcePath: options.demoPath, editing: snapshot.demoEditing,
      sourceOriginalVolume: options.demoOriginalVolume,
      tools: options.tools, workDir: join(parent, "demo-edit"), signal: options.signal,
    }) : null;
    // Demo music starts after its trim, rather than at the raw source offset.
    // Original clip gain was applied above; it must not be applied twice.
    return finishExploreVideo({ ...options, clipComposition: undefined,
      sourcePath: source?.outputPath ?? options.sourcePath,
      demoPath: demo?.outputPath ?? options.demoPath,
      sourceOriginalVolume: source ? 1 : options.sourceOriginalVolume,
      demoOriginalVolume: demo ? 1 : options.demoOriginalVolume,
      demoAudioVolume: snapshot.demoEditing?.musicVolume,
    });
  }
  const subtitles = options.subtitles;
  // Validate style before any composition or later paid transcription.
  const style = subtitles ? parseStyle(subtitles.style) : null;
  const placement = subtitles ? parsePlacement(subtitles.placement ?? "bottom") : null;
  if (subtitles && subtitles.language !== "en") assertExploreSubtitleScope(subtitles.language, 1);
  let preparedTranscript: ReturnType<typeof validateTranscript> | null = null;
  // New drafts prepare the exact mixed audio before any video encode. Legacy
  // receipts retain their original speech identity and recovery behavior.
  if (subtitles?.version === 2 && !options.referenceAudioPath && style) {
    const speech = await composeExploreVideo({ ...options, originalVolume: options.editing?.originalVolume, musicVolume: options.editing?.musicVolume,
      workDir: join(dirname(options.workDir), "speech-preview"), subtitleScope: { language: subtitles.language }, audioOnly: true });
    const fontCheck = join(dirname(options.workDir), "caption-font-check");
    await mkdir(fontCheck);
    if (style === "editorial") await prepareEditorialFonts(options.tools, fontCheck);
    else if (style === "serif-box") await prepareSerifBoxFonts(options.tools, fontCheck);
    else await prepareSubtitleFonts(options.tools, fontCheck);
    const previewLayout = getSubtitleLayout(speech.width, speech.height, style);
    if (style === "editorial") await createEditorialMeasurer(previewLayout, options.tools, fontCheck, options.signal)("Subtitle font check", previewLayout.fontSize, "lead");
    else if (style === "serif-box") await createSerifBoxMeasurer(previewLayout, options.tools, fontCheck, options.signal)("Subtitle font check");
    else await createTextMeasurer(previewLayout, options.tools)("Subtitle font check");
    preparedTranscript = validateTranscript(await subtitles.loadTranscript({ audioPath: speech.subtitleAudioPath!, sourceHash: await digestFile(speech.subtitleAudioPath!),
      durationMs: Math.ceil(speech.measuredDurationMs), language: subtitles.language }), Math.ceil(speech.measuredDurationMs));
    if (preparedTranscript.language !== "en") throw new SubtitleError("SUBTITLE_LANGUAGE_UNSUPPORTED", "Auto subtitles support English speech only.");
    // Validate corrections before a preview is declared ready, without changing
    // the owner-scoped provider cache or any original media.
    correctSubtitleTranscript(preparedTranscript, subtitles.corrections);
    if (options.captionPreview) return { ...speech, referenceAudioBasePath: null, subtitleStyle: style, subtitlePlacement: placement,
      subtitleWordCount: preparedTranscript.words.length, subtitleRenderVersion: subtitleStyleDefinition(style).renderVersion };
  }
  const singlePassEditing = options.editing && !options.demoPath && !subtitles ? options.editing : undefined;
  const composed = await composeExploreVideo({ ...options, originalVolume: options.editing?.originalVolume, musicVolume: options.editing?.musicVolume, subtitleScope: subtitles ? { language: subtitles.language } : undefined },
    singlePassEditing ? { editing: singlePassEditing, fontsDir: options.tools.fontsDir } : undefined);
  const edited = options.editing && !singlePassEditing ? { ...composed, ...await renderExploreFormatEdit({ sourcePath: composed.outputPath, width: composed.width, height: composed.height, durationMs: composed.durationMs, editing: options.editing, workDir: options.workDir, tools: options.tools, signal: options.signal }) } : composed;
  // Start the paired track AFTER trim/text, on the complete final timeline.
  // Save the unmixed edit too so future edits never stack music over demo speech.
  let referenceAudioBasePath = options.referenceAudioPath ? edited.outputPath : null;
  const referenceAudio = options.referenceAudioPath ? await renderExploreReferenceAudio({ sourcePath: edited.outputPath, audioPath: options.referenceAudioPath,
    workDir: options.workDir, volume: options.referenceAudioVolume ?? .2, replaceOriginal: false, tools: options.tools, signal: options.signal }) : null;
  const composition = referenceAudio ? { ...edited, outputPath: referenceAudio.outputPath, backgroundMusicTiming: referenceAudio.timing, hasBackgroundMusic: true } : edited;
  if (!subtitles) return { ...composition, referenceAudioBasePath, subtitleStyle: null, subtitlePlacement: null, subtitleWordCount: 0, subtitleRenderVersion: null };
  if (!composition.subtitleAudioPath || !style || !placement) throw new SubtitleError("SUBTITLE_INPUT_INVALID", "The final audio track could not be prepared.");
  assertExploreSubtitleScope(subtitles.language, composition.durationMs);
  const captionDir = join(dirname(composition.outputPath), "subtitles");
  await mkdir(captionDir);
  await copyFile(composition.outputPath, join(captionDir, "source-video"), constants.COPYFILE_EXCL);
  const video = await probeVideo(join(captionDir, "source-video"), options.tools, options.signal);
  assertExploreSubtitleScope(subtitles.language, video.durationMs);
  // Confirm fonts/runtime inputs BEFORE requesting transcription.
  if (style === "editorial") await prepareEditorialFonts(options.tools, captionDir);
  else if (style === "serif-box") await prepareSerifBoxFonts(options.tools, captionDir);
  else await prepareSubtitleFonts(options.tools, captionDir);
  const layout = getSubtitleLayout(video.width, video.height, style);
  const editorialMeasure = style === "editorial" ? createEditorialMeasurer(layout, options.tools, captionDir, options.signal) : null;
  const serifMeasure = style === "serif-box" ? createSerifBoxMeasurer(layout, options.tools, captionDir, options.signal) : null;
  const measure = editorialMeasure ? Object.assign((text: string) => editorialMeasure(text, layout.fontSize, "lead").then(ink => ink.width),
    { preload: editorialMeasure.preload ? (texts: string[]) => editorialMeasure.preload!(texts, layout.fontSize, "lead") : undefined })
    : serifMeasure ? (text: string) => serifMeasure(text).then(ink => ink.width) : createTextMeasurer(layout, options.tools);
  await measure("Subtitle font check");
  if (referenceAudio) await runMediaCommand(options.tools.ffmpeg, ["-nostdin", "-v", "error", "-y", "-protocol_whitelist", "file,pipe", "-i", composition.outputPath,
    "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", composition.subtitleAudioPath], { signal: options.signal });
  const sourceHash = await digestFile(composition.subtitleAudioPath);
  options.signal?.throwIfAborted();
  const speechDurationMs = subtitles.version === 2 ? Math.ceil(composition.measuredDurationMs) : composition.durationMs;
  const originalTranscript = preparedTranscript ?? validateTranscript(await subtitles.loadTranscript({ audioPath: composition.subtitleAudioPath,
    sourceHash, durationMs: speechDurationMs, language: subtitles.language }), speechDurationMs);
  // Caption preview and export must use the same audio timeline, including any
  // paired reference track. Allow only the existing <150ms frame rounding.
  const transcript = correctSubtitleTranscript(validateTranscript(originalTranscript, composition.durationMs), subtitles.corrections);
  options.signal?.throwIfAborted();
  // Do not present a forced-language result as proof of English speech.
  if (!transcript.language || !["en", "eng", "english"].includes(transcript.language.trim().toLowerCase())) {
    throw new SubtitleError("SUBTITLE_LANGUAGE_UNSUPPORTED", "Auto subtitles support English speech only. No captioned output was published.");
  }
  if (options.captionPreview) return { ...composition, referenceAudioBasePath, subtitleStyle: style, subtitlePlacement: placement,
    subtitleWordCount: transcript.words.length, subtitleRenderVersion: subtitleStyleDefinition(style).renderVersion };
  const cues = serifMeasure ? await groupSerifBoxWords(transcript.words, layout, serifMeasure)
    : await (isDynamicSubtitleStyle(style) ? groupSubtitleWords : groupNaturalSubtitleWords)(transcript.words, layout, measure);
  const ass = serifMeasure ? await serializeSerifBoxAss(cues, layout, placement, serifMeasure)
    : editorialMeasure ? serializeEditorialAss(await planEditorialPages(cues, layout, placement, editorialMeasure), layout)
    : isDynamicSubtitleStyle(style) ? await serializeDynamicAss(cues, layout, style as "word-pop" | "karaoke" | "marker-highlight", placement,
      createDynamicMeasurer(layout, options.tools, captionDir, options.signal)) : serializeAss(cues, layout, style, placement);
  await writeFile(join(captionDir, "captions.ass"), ass, { flag: "wx" });
  await writeFile(join(captionDir, "captions.srt"), serializeSrt(cues), { flag: "wx" });
  await writeFile(join(captionDir, "captions.vtt"), serializeVtt(cues), { flag: "wx" });
  await renderSubtitleVideo(captionDir, video, options.tools, options.signal, "veryfast");
  const outputPath = join(captionDir, "captioned.mp4");
  const result = await probeVideo(outputPath, options.tools, options.signal);
  if (referenceAudioBasePath) {
    const cleanCaptionDir = join(captionDir, "audio-base");
    await mkdir(cleanCaptionDir);
    await copyFile(referenceAudioBasePath, join(cleanCaptionDir, "source-video"), constants.COPYFILE_EXCL);
    await copyFile(join(captionDir, "captions.ass"), join(cleanCaptionDir, "captions.ass"), constants.COPYFILE_EXCL);
    await cp(join(captionDir, "fonts"), join(cleanCaptionDir, "fonts"), { recursive: true, errorOnExist: true, force: false });
    await renderSubtitleVideo(cleanCaptionDir, await probeVideo(join(cleanCaptionDir, "source-video"), options.tools, options.signal), options.tools, options.signal, "veryfast");
    referenceAudioBasePath = join(cleanCaptionDir, "captioned.mp4");
  }
  assertExploreSubtitleScope(subtitles.language, result.durationMs);
  options.signal?.throwIfAborted();
  return { ...composition, referenceAudioBasePath, outputPath, subtitleStyle: style, subtitlePlacement: placement, subtitleWordCount: transcript.words.length,
    subtitleRenderVersion: subtitleStyleDefinition(style).renderVersion };
}
