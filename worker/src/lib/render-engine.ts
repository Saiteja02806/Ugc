
import { type RenderWallTextVideoPayload, prepareWallTextOverlayAsset, ensureWallTextFontsRegistered, validateWallTextRenderedLineWidths, reflowWallTextContentForRenderer, assertWallTextTextBoxMatchesPayload, rasterizeWallTextOverlay, escapePangoMarkup } from './wall-text-overlay-renderer.ts';
export { type RenderWallTextVideoPayload, type WallTextOverlayInput, getWallTextOverlayIdentity, prepareWallTextOverlayAsset, ensureWallTextFontsRegistered, reflowWallTextContentForRenderer, assertWallTextTextBoxMatchesPayload, assertWallTextOverlayPixelsInsideTextBox } from './wall-text-overlay-renderer.ts';
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { wallTextOverlayContentHash, validateWallTextOverlayAsset, parseWallTextOverlayReference } from "./wall-text-overlay-asset.ts";
import { downloadStoredObjectBuffer, getStorageProviderName, uploadBufferToStorage } from "./storage.ts";
import { downloadAudioToBuffer, downloadVideoToBuffer } from "./download-video.ts";
import { EDIT_OVERLAY_FONT_FAMILY, EDIT_OVERLAY_OUTPUT_DIMENSIONS, EDIT_OVERLAY_SHADOW_COLOR, EDIT_OVERLAY_SHADOW_OFFSET_PX, EDIT_OVERLAY_VERTICAL_INSET_PERCENT, HOOK_TEXT_LAYOUT_VERSION, LEGACY_HOOK_TEXT_LAYOUT_VERSION, buildEditOverlayTextLayout, buildLegacyEditOverlayTextLayout, buildResolvedEditOverlayTextLayout, estimateEditOverlayLineWidth, type EditOverlayTextLayout, type HookTextLayoutVersion } from "./edit-overlay-render-spec.ts";
import { buildHookInlineSymbolSvg, hasHookInlineSymbols, tokenizeHookInlineSymbols } from "./hook-inline-symbols.ts";
import { buildWallTextOverlaySvg, type WallTextNormalizedBox, type WallTextRenderContent, type WallTextSafeArea } from "./wall-text-render-spec.ts";
import { logger } from "../logger.ts";

export type RenderRatio = "9:16" | "1:1" | "4:5" | "16:9";
export type TextOverlayPosition = "top" | "middle" | "bottom";
export type TextOverlayStyle = "clean" | "minimal" | "bubble" | "hook";
export type PreparedTextOverlay = {
  imagePath: string;
  layout: EditOverlayTextLayout;
  normalizedPosition?: NormalizedTextPosition | null;
  position: TextOverlayPosition;
  style: TextOverlayStyle;
};

type RenderTextOverlay = {
  fontSize?: number | null;
  id: string;
  layoutVersion?: HookTextLayoutVersion | null;
  lines?: string[] | null;
  normalizedPosition?: NormalizedTextPosition | null;
  position: TextOverlayPosition;
  style: TextOverlayStyle;
  text: string;
  textColor?: string;
};

const EDIT_OVERLAY_FONT_REGISTRATION_TEXT = "MW@gi 0123";
const EDIT_OVERLAY_FONT_REGISTRATION_SIZE = 64;
let editOverlayFontRegistrationPromise: Promise<EditOverlayFontRegistration> | null =
  null;

export type EditOverlayFontRegistration = {
  directBounds: { height: number; width: number };
  fontPath: string;
  registeredBounds: { height: number; width: number };
};

export type NormalizedTextPosition = {
  x: number;
  y: number;
};

export type RenderEditVideoPayload = {
  draft: {
    textOverlays: RenderTextOverlay[];
    trimEndSeconds: number | null;
    trimStartSeconds: number;
  };
  projectId: string;
  ratio: RenderRatio;
  renderId: string;
  sourceVideoId: string;
  sourceVideoUrl: string;
  userId: string;
};

export type RenderEditedVideoOutput = {
  key: string;
  ok: true;
  renderId: string;
  sourceVideoId: string;
  url: string;
};

export type RenderScheduleCombinationPayload = {
  autoFinalize: boolean;
  compositionFingerprint: string;
  demoVideoId: string;
  demoVideoUrl: string;
  hookText: string;
  hookTextFontSize?: number | null;
  hookTextLayoutVersion?: HookTextLayoutVersion | null;
  hookTextLines?: string[] | null;
  hookTextPosition?: NormalizedTextPosition | null;
  hookTextColor: string;
  hookAudio?: {
    audioAssetId: string;
    audioUrl: string;
    durationSeconds: number;
    selectionSource: "dynamic" | "format_preferred" | "video_locked";
  } | null;
  hookTrimEnd: number | null;
  hookTrimStart: number;
  hookVideoId: string;
  hookVideoUrl: string;
  projectId: string;
  ratio: RenderRatio;
  renderId: string;
  scheduleId: string;
  title: string;
  userId: string;
};

export type RenderScheduleCombinationOutput = {
  demoVideoId: string;
  hookVideoId: string;
  key: string;
  ok: true;
  renderId: string;
  scheduleId: string;
  url: string;
};

export type RenderWallTextVideoOutput = {
  assignmentId: string;
  creativeId: string;
  key: string;
  ok: true;
  renderId: string;
  url: string;
};

/**
 * Create Content renders a single user-owned clip. Unlike Trending Wall text,
 * it never supplies a replacement music track: `0:a?` is retained from the
 * selected source video all the way through the final MP4.
 */
export type RenderCreateContentVideoPayload = {
  overlay:
    | {
        format: "hook_text";
        hook: {
          fontSize: number;
          layoutVersion: HookTextLayoutVersion;
          lines: string[];
        };
        position: NormalizedTextPosition;
        text: string;
      }
    | {
        format: "wall_text";
        position: NormalizedTextPosition;
        text: string;
        wall: {
          content: WallTextRenderContent;
          layout: {
            safeArea: WallTextSafeArea;
            textBox: WallTextNormalizedBox;
          };
        };
  };
  projectId: string;
  /** Monotonic retry generation for this durable render snapshot. */
  renderAttempt: number;
  renderId: string;
  sourceVideoId: string;
  sourceVideoUrl: string;
  title: string;
  userId: string;
};

export type RenderCreateContentVideoOutput = {
  key: string;
  ok: true;
  renderId: string;
  sourceVideoId: string;
  url: string;
};

export type RenderReactionVideoPayload = {
  backgroundStorageKey: string;
  captionLines: readonly string[];
  creativeId: string;
  durationSeconds: number;
  foreground: {
    anchor: "bottom_center" | "bottom_left" | "bottom_right" | "center";
    heightPercent: number;
  };
  foregroundStorageKey: string;
  renderId: string;
  treatment: "caption_with_labels" | "outlined_text" | "white_card";
};

export type RenderReactionVideoOutput = {
  byteLength: number;
  key: string;
  ok: true;
  renderId: string;
  url: string;
};

const OUTPUT_CONTENT_TYPE = "video/mp4";
const MAX_FFMPEG_LOG_LENGTH = 8_000;
const TRENDING_LIBRARY_AUDIO_RENDER_GAIN = 0.45;
const renderDimensions = EDIT_OVERLAY_OUTPUT_DIMENSIONS;

export async function renderEditedVideoToStorage(
  payload: RenderEditVideoPayload,
): Promise<RenderEditedVideoOutput> {
  const renderStartedAt = Date.now();
  const workDir = await mkdtemp(join(tmpdir(), "ugc-render-"));
  const inputPath = join(workDir, "source-video");
  const outputPath = join(workDir, "rendered.mp4");

  try {
    const sourceBuffer = await downloadVideoToBuffer(payload.sourceVideoUrl);
    const preparedTextOverlays = payload.draft.textOverlays
      .map((overlay, index) =>
        buildPreparedTextOverlay({
          imagePath: join(workDir, `overlay-${index}.png`),
          overlay,
          ratio: payload.ratio,
        }),
      )
      .filter(
        (overlay): overlay is PreparedTextOverlay => Boolean(overlay),
      );

    await Promise.all([
      writeFile(inputPath, sourceBuffer),
      ...preparedTextOverlays.map(renderPreparedTextOverlayImage),
    ]);
    const sourceReadyAt = Date.now();

    logger.info("Source video downloaded for render", {
      overlayCount: preparedTextOverlays.length,
      renderId: payload.renderId,
      sourceSize: sourceBuffer.length,
    });

    await runFfmpeg({
      inputPath,
      outputPath,
      payload,
      preparedTextOverlays,
    });
    await validateRenderedVideoFile(outputPath, payload.renderId);
    const encodedAt = Date.now();

    const renderedBuffer = await readFile(outputPath);

    if (renderedBuffer.length === 0) {
      throw new Error("Edited video render produced an empty MP4.");
    }

    const key = buildRenderedVideoKey(payload);
    const result = await uploadBufferToStorage({
      key,
      buffer: renderedBuffer,
      contentType: OUTPUT_CONTENT_TYPE,
      cacheControl: "public, max-age=31536000, immutable",
    });
    const uploadedAt = Date.now();

    logger.info("Edited video render uploaded to object storage", {
      key: result.key,
      renderId: payload.renderId,
      renderedSize: renderedBuffer.length,
      sourceVideoId: payload.sourceVideoId,
      storageProvider: getStorageProviderName(),
      timingsMs: {
        downloadAndPrepare: sourceReadyAt - renderStartedAt,
        encode: encodedAt - sourceReadyAt,
        total: uploadedAt - renderStartedAt,
        upload: uploadedAt - encodedAt,
      },
      url: result.url,
    });

    return {
      ok: true,
      renderId: payload.renderId,
      sourceVideoId: payload.sourceVideoId,
      key: result.key,
      url: result.url,
    };
  } finally {
    await rm(workDir, {
      force: true,
      recursive: true,
    });
  }
}

export async function renderScheduleCombinationToStorage(
  payload: RenderScheduleCombinationPayload,
): Promise<RenderScheduleCombinationOutput> {
  const renderedBuffer = await renderScheduleCombinationToBuffer(payload);
  const key = buildScheduleCombinationVideoKey(payload);
  const result = await uploadBufferToStorage({
    key,
    buffer: renderedBuffer,
    contentType: OUTPUT_CONTENT_TYPE,
    cacheControl: "public, max-age=31536000, immutable",
  });

  logger.info("Schedule combination render uploaded to object storage", {
    key: result.key,
    renderId: payload.renderId,
    renderedSize: renderedBuffer.length,
    scheduleId: payload.scheduleId,
    storageProvider: getStorageProviderName(),
    url: result.url,
  });

  return {
    ok: true,
    demoVideoId: payload.demoVideoId,
    hookVideoId: payload.hookVideoId,
    renderId: payload.renderId,
    scheduleId: payload.scheduleId,
    key: result.key,
    url: result.url,
  };
}

export async function renderScheduleCombinationToBuffer(
  payload: RenderScheduleCombinationPayload,
) {
  const workDir = await mkdtemp(join(tmpdir(), "ugc-combine-render-"));
  const hookInputPath = join(workDir, "hook-source-video");
  const hookAudioPath = payload.hookAudio
    ? join(workDir, "hook-audio")
    : null;
  const demoInputPath = join(workDir, "demo-source-video");
  const hookSegmentPath = join(workDir, "hook-normalized.mp4");
  const demoSegmentPath = join(workDir, "demo-normalized.mp4");
  const concatListPath = join(workDir, "concat-list.txt");
  const outputPath = join(workDir, "combined.mp4");
  const hookOverlay = buildPreparedTextOverlay({
    imagePath: join(workDir, "hook-overlay.png"),
    overlay: {
      id: "hook-text",
      fontSize: payload.hookTextFontSize,
      layoutVersion: payload.hookTextLayoutVersion,
      lines: payload.hookTextLines,
      normalizedPosition: payload.hookTextPosition,
      position: "top",
      style: "hook",
      text: payload.hookText,
      textColor: payload.hookTextColor,
    },
    ratio: payload.ratio,
  });

  try {
    const [hookBuffer, demoBuffer, hookAudioBuffer] = await Promise.all([
      downloadVideoToBuffer(payload.hookVideoUrl),
      downloadVideoToBuffer(payload.demoVideoUrl),
      payload.hookAudio
        ? downloadAudioToBuffer(payload.hookAudio.audioUrl, {
            maxBytes: 50 * 1024 * 1024,
          })
        : Promise.resolve(null),
    ]);

    await Promise.all([
      writeFile(hookInputPath, hookBuffer),
      writeFile(demoInputPath, demoBuffer),
      ...(hookAudioPath && hookAudioBuffer
        ? [writeFile(hookAudioPath, hookAudioBuffer)]
        : []),
      ...(hookOverlay ? [renderPreparedTextOverlayImage(hookOverlay)] : []),
    ]);

    logger.info("Schedule combination sources downloaded", {
      demoSize: demoBuffer.length,
      demoVideoId: payload.demoVideoId,
      hookSize: hookBuffer.length,
      hookAudioAssetId: payload.hookAudio?.audioAssetId ?? null,
      hookAudioSize: hookAudioBuffer?.length ?? 0,
      hookVideoId: payload.hookVideoId,
      renderId: payload.renderId,
      scheduleId: payload.scheduleId,
    });

    await normalizeCombinationSegment({
      inputPath: hookInputPath,
      hookAudioPath,
      outputPath: hookSegmentPath,
      payload,
      preparedTextOverlay: hookOverlay,
      segmentLabel: "hook",
    });
    await normalizeCombinationSegment({
      inputPath: demoInputPath,
      hookAudioPath: null,
      outputPath: demoSegmentPath,
      payload,
      preparedTextOverlay: null,
      segmentLabel: "demo",
    });

    await writeFile(
      concatListPath,
      [
        `file '${escapeConcatPath(hookSegmentPath)}'`,
        `file '${escapeConcatPath(demoSegmentPath)}'`,
      ].join("\n"),
      "utf8",
    );
    await runFfmpegCommand({
      args: [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c",
        "copy",
        "-avoid_negative_ts",
        "make_zero",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      label: "schedule combination concat",
      renderId: payload.renderId,
    });

    await validateRenderedVideoFile(outputPath, payload.renderId, {
      expectedAudioCodecName: "aac",
      logLabel: "schedule combination",
      requireAudio: true,
    });

    return await readFile(outputPath);
  } finally {
    await rm(workDir, {
      force: true,
      recursive: true,
    });
  }
}

export async function renderWallTextVideoToStorage(
  payload: RenderWallTextVideoPayload,
): Promise<RenderWallTextVideoOutput> {
  const workDir = await mkdtemp(join(tmpdir(), "ugc-wall-text-render-"));
  const audioPath = join(workDir, "wall-audio");
  const inputPath = join(workDir, "source-video");
  const overlayPath = join(workDir, "wall-text-overlay.png");
  const outputPath = join(workDir, "wall-text-video.mp4");

  try {
    const savedOverlay = parseWallTextOverlayReference(payload.overlayAsset, payload.userId);
    if (savedOverlay && savedOverlay.contentHash !== wallTextOverlayContentHash({
      text: payload.text, textBox: payload.textBox, placement: payload.placement,
      safeArea: payload.safeArea, textColor: payload.textColor,
    })) {
      throw new Error("Saved Wall text image does not match this export's content.");
    }
    const overlayPng = savedOverlay
      ? await validateWallTextOverlayAsset({ ...savedOverlay,
          png: await downloadStoredObjectBuffer(savedOverlay.key) }, savedOverlay.inputHash)
      : (await prepareWallTextOverlayAsset({
      text: payload.text, textBox: payload.textBox, placement: payload.placement,
      safeArea: payload.safeArea, textColor: payload.textColor,
    })).png;
    const [sourceBuffer, audioBuffer] = await Promise.all([
      downloadVideoToBuffer(payload.sourceVideoUrl),
      downloadAudioToBuffer(payload.audio.audioUrl, {
        maxBytes: 50 * 1024 * 1024,
      }),
    ]);

    await Promise.all([
      writeFile(audioPath, audioBuffer),
      writeFile(inputPath, sourceBuffer),
      writeFile(overlayPath, overlayPng),
    ]);

    await runFfmpegCommand({
      args: buildWallTextVideoArgs({
        audioPath,
        inputPath,
        outputPath,
        overlayPath,
        payload,
      }),
      label: "wall-text video render",
      renderId: payload.renderId,
    });

    await validateRenderedVideoFile(outputPath, payload.renderId, {
      expectedAudioCodecName: "aac",
      expectedDurationSeconds: payload.durationSeconds,
      logLabel: "Wall-text",
      requireAudio: true,
    });

    const renderedBuffer = await readFile(outputPath);
    const key = buildWallTextVideoKey(payload);
    const result = await uploadBufferToStorage({
      key,
      buffer: renderedBuffer,
      contentType: OUTPUT_CONTENT_TYPE,
      cacheControl: "public, max-age=31536000, immutable",
    });

    logger.info("Wall-text video render uploaded to object storage", {
      assignmentId: payload.assignmentId,
      creativeId: payload.creativeId,
      key: result.key,
      renderId: payload.renderId,
      renderedSize: renderedBuffer.length,
      storageProvider: getStorageProviderName(),
      url: result.url,
    });

    return {
      assignmentId: payload.assignmentId,
      creativeId: payload.creativeId,
      key: result.key,
      ok: true,
      renderId: payload.renderId,
      url: result.url,
    };
  } finally {
    await rm(workDir, {
      force: true,
      recursive: true,
    });
  }
}

export async function renderCreateContentVideoToStorage(
  payload: RenderCreateContentVideoPayload,
): Promise<RenderCreateContentVideoOutput> {
  const artifactRenderId = getCreateContentRenderArtifactId(payload);

  if (payload.overlay.format === "hook_text") {
    const rendered = await renderEditedVideoToStorage({
      draft: {
        textOverlays: [
          {
            fontSize: payload.overlay.hook.fontSize,
            id: "create-content-hook",
            layoutVersion: payload.overlay.hook.layoutVersion,
            lines: payload.overlay.hook.lines,
            normalizedPosition: payload.overlay.position,
            position: "middle",
            style: "hook",
            text: payload.overlay.text,
          },
        ],
        trimEndSeconds: null,
        trimStartSeconds: 0,
      },
      projectId: payload.projectId,
      ratio: "9:16",
      // `renderId` controls the immutable storage artifact for this generic
      // renderer. Keep the durable Create Content id separate so a manual
      // retry cannot overwrite an older attempt that finishes late.
      renderId: artifactRenderId,
      sourceVideoId: payload.sourceVideoId,
      sourceVideoUrl: payload.sourceVideoUrl,
      userId: payload.userId,
    });

    return { ...rendered, renderId: payload.renderId };
  }

  const workDir = await mkdtemp(join(tmpdir(), "ugc-create-content-wall-"));
  const inputPath = join(workDir, "source-video");
  const overlayPath = join(workDir, "wall-text-overlay.png");
  const outputPath = join(workDir, "create-content-wall.mp4");

  try {
    await ensureWallTextFontsRegistered();
    assertWallTextTextBoxMatchesPayload(
      payload.overlay.wall.content,
      payload.overlay.wall.layout.textBox,
    );
    const renderContent = await reflowWallTextContentForRenderer({
      content: payload.overlay.wall.content,
      textBox: payload.overlay.wall.layout.textBox,
    });
    await validateWallTextRenderedLineWidths(
      renderContent,
      payload.overlay.wall.layout.textBox,
    );
    const overlayPng = await rasterizeWallTextOverlay({
      overlaySvg: buildWallTextOverlaySvg({
        content: renderContent,
        placement: "middle",
        safeArea: payload.overlay.wall.layout.safeArea,
        textBox: payload.overlay.wall.layout.textBox,
        textColor: "#ffffff",
      }),
      textBox: payload.overlay.wall.layout.textBox,
    });
    const sourceBuffer = await downloadVideoToBuffer(payload.sourceVideoUrl);
    await Promise.all([
      writeFile(inputPath, sourceBuffer),
      writeFile(overlayPath, overlayPng),
    ]);

    await runFfmpegCommand({
      args: buildCreateContentWallTextVideoArgs({ inputPath, outputPath, overlayPath }),
      label: "Create Content Wall-of-Text render",
      renderId: artifactRenderId,
    });
    await validateRenderedVideoFile(outputPath, artifactRenderId, {
      logLabel: "Create Content Wall-of-Text",
      requireAudio: false,
    });

    const renderedBuffer = await readFile(outputPath);
    const result = await uploadBufferToStorage({
      key: buildCreateContentVideoKey(payload),
      buffer: renderedBuffer,
      contentType: OUTPUT_CONTENT_TYPE,
      cacheControl: "public, max-age=31536000, immutable",
    });

    return {
      key: result.key,
      ok: true,
      renderId: payload.renderId,
      sourceVideoId: payload.sourceVideoId,
      url: result.url,
    };
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
}

/**
 * A Reaction card is always a final, owner-scoped MP4. Catalog backgrounds and
 * alpha MOVs remain private worker inputs; no browser is asked to composite
 * raw catalog media. Its soundtrack is the selected foreground clip's original
 * audio, so the visual reaction and its sound remain in sync in Trending.
 */
export async function renderReactionVideoToStorage(
  payload: RenderReactionVideoPayload,
): Promise<RenderReactionVideoOutput> {
  const workDir = await mkdtemp(join(tmpdir(), "ugc-reaction-render-"));
  const backgroundPath = join(workDir, "background");
  const foregroundPath = join(workDir, "foreground.mov");
  const overlayPath = join(workDir, "caption.png");
  const outputPath = join(workDir, "reaction.mp4");

  try {
    const [backgroundBuffer, foregroundBuffer, captionOverlay] = await Promise.all([
      downloadStoredObjectBuffer(payload.backgroundStorageKey),
      downloadStoredObjectBuffer(payload.foregroundStorageKey),
      renderReactionCaptionOverlay(payload),
    ]);
    await Promise.all([
      writeFile(backgroundPath, backgroundBuffer),
      writeFile(foregroundPath, foregroundBuffer),
      writeFile(overlayPath, captionOverlay),
    ]);

    await runFfmpegCommand({
      args: buildReactionVideoArgs({
        backgroundPath,
        foregroundPath,
        outputPath,
        overlayPath,
        payload,
      }),
      label: "reaction video render",
      renderId: payload.renderId,
    });
    await validateRenderedVideoFile(outputPath, payload.renderId, {
      expectedAudioCodecName: "aac",
      expectedDurationSeconds: payload.durationSeconds,
      logLabel: "Reaction",
      requireAudio: true,
    });

    const renderedBuffer = await readFile(outputPath);
    if (renderedBuffer.length === 0) {
      throw new Error("Reaction render produced an empty MP4.");
    }
    const key = buildReactionVideoKey(payload);
    const result = await uploadBufferToStorage({
      key,
      buffer: renderedBuffer,
      contentType: OUTPUT_CONTENT_TYPE,
      cacheControl: "public, max-age=31536000, immutable",
    });

    logger.info("Reaction video render uploaded to object storage", {
      creativeId: payload.creativeId,
      key: result.key,
      renderId: payload.renderId,
      renderedSize: renderedBuffer.length,
      storageProvider: getStorageProviderName(),
      url: result.url,
    });

    return {
      byteLength: renderedBuffer.length,
      key: result.key,
      ok: true,
      renderId: payload.renderId,
      url: result.url,
    };
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
}

export function buildReactionVideoArgs(params: {
  backgroundPath: string;
  foregroundPath: string;
  outputPath: string;
  overlayPath: string;
  payload: RenderReactionVideoPayload;
}) {
  const foregroundHeight = Math.round(
    // Some imported alpha MOVs have generous transparent bounds, so a literal
    // catalog height can make the visible performer feel tiny. Keep every
    // Reaction Reel foreground large enough to read at feed-preview size.
    Math.max(0.65, Math.min(0.9, params.payload.foreground.heightPercent)) * 1920,
  );
  const foregroundX =
    params.payload.foreground.anchor === "bottom_left"
      ? "48"
      : params.payload.foreground.anchor === "bottom_right"
        ? "W-w-48"
        : "(W-w)/2";
  const foregroundY =
    params.payload.foreground.anchor === "center" ? "(H-h)/2" : "H-h";
  const filter = [
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[background]",
    `[1:v]scale=-2:${foregroundHeight},setsar=1[foreground]`,
    `[background][foreground]overlay=${foregroundX}:${foregroundY}:format=auto[composed]`,
    "[composed][2:v]overlay=0:0:format=auto[video]",
  ].join(";");

  return [
    "-y",
    "-loop", "1",
    "-framerate", "30",
    "-i", params.backgroundPath,
    "-stream_loop", "-1",
    "-i", params.foregroundPath,
    "-loop", "1",
    "-framerate", "30",
    "-i", params.overlayPath,
    "-filter_complex", filter,
    "-map", "[video]",
    // The reaction source is the selected foreground input. Preserve its audio
    // rather than muting the final Reel or substituting library music.
    "-map", "1:a:0",
    "-t", String(params.payload.durationSeconds),
    "-r", "30",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "160k",
    "-movflags", "+faststart",
    params.outputPath,
  ];
}

async function renderReactionCaptionOverlay(
  payload: Pick<RenderReactionVideoPayload, "captionLines" | "treatment">,
) {
  return sharp(Buffer.from(await buildReactionCaptionOverlaySvg(payload)))
    .png()
    .toBuffer();
}

const REACTION_CANVAS_WIDTH = 1080;
const REACTION_CANVAS_HEIGHT = 1920;
const REACTION_CAPTION_MAX_LINES = 3;
// Keep the caption safely below the top UI area so the copy feels anchored to
// the composition instead of pressed against the top edge.
const REACTION_CAPTION_TOP = 260;
const REACTION_CAPTION_HORIZONTAL_PADDING = 28;
const REACTION_CAPTION_VERTICAL_PADDING = 18;
const REACTION_WHITE_CARD_MIN_WIDTH = 320;
// Leave a clear margin to the 9:16 frame even for long copy. A Reaction
// caption should read as a compact label, never a full-width banner.
const REACTION_WHITE_CARD_MAX_WIDTH = 900;
const REACTION_OUTLINED_TEXT_MAX_WIDTH = 888;
const REACTION_CAPTION_FONT_SIZES = [58, 56, 54, 52, 50, 48, 46, 44, 42, 40, 38, 36] as const;
const REACTION_CAPTION_FONT_FAMILY = "Geist, Arial, sans-serif";
const REACTION_CAPTION_FONT_WEIGHT = 600;

export type ReactionCaptionLayout = {
  card: { height: number; width: number; x: number; y: number } | null;
  fontSize: number;
  lineHeight: number;
  lineWidths: readonly number[];
  lines: readonly string[];
  maxTextWidth: number;
  textY: number;
};

/**
 * Text from the brief is semantic input, not final pixel geometry. We use the
 * same rendered-glyph measurement approach as Carousel headlines, then prefer
 * a readable two-line layout before falling back to a third line.
 */
export async function buildReactionCaptionLayout(
  payload: Pick<RenderReactionVideoPayload, "captionLines" | "treatment">,
): Promise<ReactionCaptionLayout> {
  const normalizedLines = payload.captionLines.map((line) =>
    normalizeReactionCaptionLine(line),
  );
  if (
    normalizedLines.length < 1 ||
    normalizedLines.length > REACTION_CAPTION_MAX_LINES ||
    normalizedLines.some((line) => !line)
  ) {
    throw new Error("Reaction render needs one to three non-empty caption lines.");
  }

  // Use the same verified Geist face as the Carousel renderer. Rendering an
  // SVG before this registration can make a long-lived worker cache a host
  // fallback instead of the approved font.
  await ensureEditOverlayFontRegistered();

  const maxTextWidth = payload.treatment === "white_card"
    ? REACTION_WHITE_CARD_MAX_WIDTH - REACTION_CAPTION_HORIZONTAL_PADDING * 2
    : REACTION_OUTLINED_TEXT_MAX_WIDTH;
  const allWords = normalizedLines.join(" ").split(" ").filter(Boolean);
  const minimumFontSize = REACTION_CAPTION_FONT_SIZES.at(-1)!;
  if (allWords.some((word) => estimateReactionCaptionWidth(word, minimumFontSize) > maxTextWidth)) {
    throw new Error("Reaction caption contains a word too long for the 9:16 safe caption area.");
  }

  for (const linePreference of [
    { lineCount: 1, minimumFontSize: 46 },
    { lineCount: 2, minimumFontSize: 36 },
    { lineCount: 3, minimumFontSize: 36 },
  ] as const) {
    if (allWords.length < linePreference.lineCount) continue;

    for (const fontSize of REACTION_CAPTION_FONT_SIZES) {
      if (fontSize < linePreference.minimumFontSize) continue;
      const lines = buildBalancedReactionCaptionLines(
        allWords,
        linePreference.lineCount,
        fontSize,
      );
      const lineWidths = await measureReactionCaptionLineWidths({
        fontSize,
        lines,
        treatment: payload.treatment,
      });

      if (lineWidths.every((width) => width <= maxTextWidth)) {
        return buildReactionCaptionLayoutResult({
          fontSize,
          lines,
          lineWidths,
          maxTextWidth,
          treatment: payload.treatment,
        });
      }
    }
  }

  // The generator is limited to twenty words; reaching this branch means a
  // corrupt/legacy payload contains text that cannot be shown safely. Failing
  // the render is preferable to silently clipping or compressing the copy.
  throw new Error("Reaction caption cannot fit inside the 9:16 safe caption area.");
}

export async function buildReactionCaptionOverlaySvg(
  payload: Pick<RenderReactionVideoPayload, "captionLines" | "treatment">,
) {
  const layout = await buildReactionCaptionLayout(payload);
  const isWhiteCard = payload.treatment === "white_card";
  const textNodes = layout.lines
    .map(
      (line, index) =>
        `<text x="540" y="${layout.textY + layout.lineHeight * index}" text-anchor="middle">${escapeReactionSvgText(line)}</text>`,
    )
    .join("");
  const card = layout.card
    ? `<rect x="${layout.card.x}" y="${layout.card.y}" width="${layout.card.width}" height="${layout.card.height}" rx="${Math.min(Math.round(layout.fontSize * 0.48), Math.round(layout.card.height / 2))}" fill="#FFFFFF" fill-opacity="0.94"/>`
    : "";

  return `
    <svg width="${REACTION_CANVAS_WIDTH}" height="${REACTION_CANVAS_HEIGHT}" viewBox="0 0 ${REACTION_CANVAS_WIDTH} ${REACTION_CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <style>text { font-family: ${REACTION_CAPTION_FONT_FAMILY}; font-size: ${layout.fontSize}px; font-weight: ${REACTION_CAPTION_FONT_WEIGHT}; }</style>
      ${card}
      <g fill="${isWhiteCard ? "#111111" : "#FFFFFF"}" ${isWhiteCard ? "" : 'stroke="#111111" stroke-width="7" paint-order="stroke" stroke-linejoin="round"'}>${textNodes}</g>
    </svg>`;
}

function buildReactionCaptionLayoutResult(params: {
  fontSize: number;
  lineWidths: readonly number[];
  lines: readonly string[];
  maxTextWidth: number;
  treatment: RenderReactionVideoPayload["treatment"];
}): ReactionCaptionLayout {
  const lineHeight = Math.round(params.fontSize * 1.18);
  const widestLine = Math.max(...params.lineWidths);
  const isWhiteCard = params.treatment === "white_card";
  const cardWidth = isWhiteCard
    ? Math.min(
        REACTION_WHITE_CARD_MAX_WIDTH,
        Math.max(
          REACTION_WHITE_CARD_MIN_WIDTH,
          Math.ceil(widestLine + REACTION_CAPTION_HORIZONTAL_PADDING * 2),
        ),
      )
    : 0;
  const cardHeight = isWhiteCard
    ? lineHeight * params.lines.length + REACTION_CAPTION_VERTICAL_PADDING * 2
    : 0;
  const card = isWhiteCard
    ? {
        height: cardHeight,
        width: cardWidth,
        x: Math.round((REACTION_CANVAS_WIDTH - cardWidth) / 2),
        y: REACTION_CAPTION_TOP,
      }
    : null;

  return {
    card,
    fontSize: params.fontSize,
    lineHeight,
    lineWidths: params.lineWidths,
    lines: params.lines,
    maxTextWidth: params.maxTextWidth,
    textY: isWhiteCard
      ? REACTION_CAPTION_TOP + REACTION_CAPTION_VERTICAL_PADDING + params.fontSize
      : REACTION_CAPTION_TOP + params.fontSize,
  };
}

function buildBalancedReactionCaptionLines(
  words: readonly string[],
  lineCount: number,
  fontSize: number,
) {
  const candidates: Array<{ lines: string[]; score: number }> = [];

  const visit = (start: number, remainingLines: number, lines: string[]) => {
    if (remainingLines === 1) {
      const completeLines = [...lines, words.slice(start).join(" ")];
      const widths = completeLines.map((line) =>
        estimateReactionCaptionWidth(line, fontSize),
      );
      const widest = Math.max(...widths);
      const narrowest = Math.min(...widths);
      const score = widest * 10_000 + (widest - narrowest);
      candidates.push({ lines: completeLines, score });
      return;
    }

    const lastWordIndex = words.length - (remainingLines - 1);
    for (let end = start + 1; end <= lastWordIndex; end += 1) {
      visit(end, remainingLines - 1, [...lines, words.slice(start, end).join(" ")]);
    }
  };

  visit(0, lineCount, []);
  const best = candidates.sort((left, right) => left.score - right.score)[0];
  if (!best) {
    throw new Error("Reaction caption could not be balanced into visible lines.");
  }
  return best.lines;
}

async function measureReactionCaptionLineWidths(params: {
  fontSize: number;
  lines: readonly string[];
  treatment: RenderReactionVideoPayload["treatment"];
}) {
  const strokeAllowance = params.treatment === "outlined_text" ? 16 : 0;

  return Promise.all(
    params.lines.map(async (line) => {
      const estimatedWidth = estimateReactionCaptionWidth(line, params.fontSize);
      const padding = Math.ceil(params.fontSize * 1.5);
      const width = Math.max(320, estimatedWidth * 2 + padding * 2);
      const height = Math.ceil(params.fontSize * 3 + padding * 2);
      const anchorX = Math.round(width / 2);
      const baselineY = Math.round(padding + params.fontSize * 1.45);
      const svg = Buffer.from(`
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <text x="${anchorX}" y="${baselineY}" fill="#000000" font-family="${REACTION_CAPTION_FONT_FAMILY}" font-size="${params.fontSize}" font-weight="${REACTION_CAPTION_FONT_WEIGHT}" text-anchor="middle">${escapeReactionSvgText(line)}</text>
        </svg>
      `);
      const { data, info } = await sharp(svg)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let minX = info.width;
      let maxX = -1;

      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          const alpha = data[(y * info.width + x) * info.channels + 3] ?? 0;
          if (alpha > 8) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
          }
        }
      }

      const measuredWidth = maxX < minX ? estimatedWidth : maxX - minX + 1;
      return measuredWidth + strokeAllowance;
    }),
  );
}

function estimateReactionCaptionWidth(value: string, fontSize: number) {
  const relativeWidth = [...value].reduce((total, character) => {
    if (/\s/u.test(character)) return total + 0.34;
    if (/[ilI1!|.,:;'`]/u.test(character)) return total + 0.34;
    if (/[MW@#%&]/u.test(character)) return total + 0.98;
    if (/[mw]/u.test(character)) return total + 0.84;
    if (/[A-Z0-9]/u.test(character)) return total + 0.74;
    return total + 0.66;
  }, 0);

  // Retain a margin for the actual Arial Bold advance and, for outlined text,
  // the visible stroke. The layout has no textLength fallback that could make
  // text look squeezed; it wraps into another line instead.
  return Math.ceil(relativeWidth * fontSize * 1.08 + 12);
}

function normalizeReactionCaptionLine(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function escapeReactionSvgText(value: string) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

export function buildWallTextVideoArgs({
  audioPath,
  inputPath,
  outputPath,
  overlayPath,
  payload,
}: {
  audioPath: string;
  inputPath: string;
  outputPath: string;
  overlayPath: string;
  payload: Pick<RenderWallTextVideoPayload, "audio" | "durationSeconds">;
}) {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-loop",
    "1",
    "-framerate",
    "30",
    "-i",
    overlayPath,
    "-i",
    audioPath,
  ];

  args.push(
    "-t",
    formatSeconds(payload.durationSeconds),
    "-filter_complex",
    [
      `[0:v]${buildVideoFilters({ ratio: "9:16" })},setpts=PTS-STARTPTS[video]`,
      "[1:v]format=rgba,setpts=PTS-STARTPTS[overlay]",
      "[video][overlay]overlay=x=0:y=0:shortest=1:format=auto[rendered]",
      buildWallTextAudioFilter(payload),
    ].join(";"),
    "-map",
    "[rendered]",
    "-map",
    "[wall_audio]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath,
  );

  return args;
}

export function buildCreateContentWallTextVideoArgs({
  inputPath,
  outputPath,
  overlayPath,
}: {
  inputPath: string;
  outputPath: string;
  overlayPath: string;
}) {
  return [
    "-y",
    "-i",
    inputPath,
    "-loop",
    "1",
    "-framerate",
    "30",
    "-i",
    overlayPath,
    "-filter_complex",
    [
      `[0:v]${buildVideoFilters({ ratio: "9:16" })},setpts=PTS-STARTPTS[video]`,
      "[1:v]format=rgba,setpts=PTS-STARTPTS[overlay]",
      "[video][overlay]overlay=x=0:y=0:shortest=1:format=auto[rendered]",
    ].join(";"),
    "-map",
    "[rendered]",
    // Preserve the exact source audio when present. No app-selected or fixed
    // soundtrack is added to a Create Content video.
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath,
  ];
}

function buildWallTextAudioFilter(
  payload: Pick<RenderWallTextVideoPayload, "audio" | "durationSeconds">,
) {
  const duration = formatSeconds(payload.durationSeconds);
  const cueStart = formatSeconds(payload.audio.cueStartSeconds);
  const assetEnd = formatSeconds(payload.audio.assetDurationSeconds);
  const fadeDuration = Math.min(
    payload.audio.fadeOutSeconds,
    payload.durationSeconds / 2,
  );
  const fadeFilter =
    fadeDuration > 0
      ? `,afade=t=out:st=${formatSeconds(
          payload.durationSeconds - fadeDuration,
        )}:d=${formatSeconds(fadeDuration)}`
      : "";
  const loopFilter =
    payload.audio.fitMode === "loop"
      ? `,aloop=loop=-1:size=${Math.max(
          1,
          Math.ceil(
            (payload.audio.assetDurationSeconds -
              payload.audio.cueStartSeconds) *
              48_000,
          ),
        )}:start=0`
      : "";
  const padFilter =
    payload.audio.fitMode === "loop" ? "" : `apad=pad_dur=${duration}`;

  return [
    "[2:a:0]aresample=48000",
    "aformat=channel_layouts=stereo",
    `atrim=start=${cueStart}:end=${assetEnd}`,
    "asetpts=PTS-STARTPTS",
    ...(loopFilter ? [loopFilter.slice(1)] : []),
    ...(padFilter ? [padFilter] : []),
    `atrim=duration=${duration}`,
    ...(fadeFilter ? [fadeFilter.slice(1)] : []),
    `volume=${TRENDING_LIBRARY_AUDIO_RENDER_GAIN}`,
    "asetpts=PTS-STARTPTS[wall_audio]",
  ].join(",");
}

async function runFfmpeg({
  inputPath,
  outputPath,
  payload,
  preparedTextOverlays,
}: {
  inputPath: string;
  outputPath: string;
  payload: RenderEditVideoPayload;
  preparedTextOverlays: PreparedTextOverlay[];
}) {
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
  const args = buildFfmpegArgs({
    inputPath,
    outputPath,
    payload,
    preparedTextOverlays,
  });

  logger.info("Running ffmpeg edited video render", {
    ffmpegPath,
    renderId: payload.renderId,
  });

  await runFfmpegCommand({
    args,
    label: "edited video render",
    renderId: payload.renderId,
  });
}

async function runFfmpegCommand({
  args,
  label,
  renderId,
}: {
  args: string[];
  label: string;
  renderId: string;
}) {
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

  logger.info(`Running ffmpeg ${label}`, {
    ffmpegPath,
    renderId,
  });

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, args, {
      windowsHide: true,
    });
    let stderr = "";

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();

      if (stderr.length > MAX_FFMPEG_LOG_LENGTH) {
        stderr = stderr.slice(-MAX_FFMPEG_LOG_LENGTH);
      }
    });

    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `ffmpeg exited with code ${code ?? "unknown"}: ${stderr.trim()}`,
        ),
      );
    });
  });
}

async function normalizeCombinationSegment({
  hookAudioPath,
  inputPath,
  outputPath,
  payload,
  preparedTextOverlay,
  segmentLabel,
}: {
  hookAudioPath: string | null;
  inputPath: string;
  outputPath: string;
  payload: RenderScheduleCombinationPayload;
  preparedTextOverlay: PreparedTextOverlay | null;
  segmentLabel: "demo" | "hook";
}) {
  const hasAudio = await inputHasAudio(inputPath);
  const args = buildScheduleCombinationSegmentArgs({
    hasAudio,
    hookAudioPath,
    inputPath,
    outputPath,
    payload,
    preparedTextOverlay,
    segmentLabel,
  });

  await runFfmpegCommand({
    args,
    label: `schedule ${segmentLabel} segment normalize`,
    renderId: payload.renderId,
  });
}

type RenderedVideoProbe = {
  format?: {
    duration?: number | string;
    format_name?: string;
  };
  streams?: Array<{
    codec_name?: string;
    codec_type?: string;
    height?: number;
    width?: number;
  }>;
};

type RenderedVideoValidationOptions = {
  durationToleranceSeconds?: number;
  expectedAudioCodecName?: string;
  expectedDurationSeconds?: number;
  requireAudio?: boolean;
};

export function validateRenderedVideoProbe(
  value: unknown,
  options: RenderedVideoValidationOptions = {},
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ffprobe did not return video metadata.");
  }

  const probe = value as RenderedVideoProbe;
  const videoStream = probe.streams?.find(
    (stream) => stream.codec_type === "video",
  );
  const audioStream = probe.streams?.find(
    (stream) => stream.codec_type === "audio",
  );
  const duration = Number(probe.format?.duration);

  if (
    !videoStream?.codec_name ||
    !videoStream.width ||
    !videoStream.height ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw new Error(
      "Rendered MP4 is missing a playable video stream, dimensions, or duration.",
    );
  }

  if (options.requireAudio && !audioStream?.codec_name) {
    throw new Error("Rendered MP4 is missing a playable audio stream.");
  }

  if (
    options.expectedAudioCodecName &&
    audioStream?.codec_name !== options.expectedAudioCodecName
  ) {
    throw new Error(
      `Rendered MP4 audio codec must be ${options.expectedAudioCodecName}.`,
    );
  }

  if (options.expectedDurationSeconds !== undefined) {
    const tolerance = options.durationToleranceSeconds ?? 0.15;

    if (Math.abs(duration - options.expectedDurationSeconds) > tolerance) {
      throw new Error(
        `Rendered MP4 duration ${duration.toFixed(3)}s does not match the expected ${options.expectedDurationSeconds.toFixed(3)}s duration.`,
      );
    }
  }

  return {
    codecName: videoStream.codec_name,
    durationSeconds: duration,
    height: videoStream.height,
    width: videoStream.width,
  };
}

async function validateRenderedVideoFile(
  outputPath: string,
  renderId: string,
  options: RenderedVideoValidationOptions & { logLabel?: string } = {},
) {
  const ffprobePath = process.env.FFPROBE_PATH || "ffprobe";
  const args = [
    "-v",
    "error",
    "-show_entries",
    "format=duration,format_name:stream=codec_name,codec_type,width,height",
    "-of",
    "json",
    outputPath,
  ];
  const stdout = await new Promise<string>((resolve, reject) => {
    const ffprobe = spawn(ffprobePath, args, { windowsHide: true });
    let output = "";
    let stderr = "";

    ffprobe.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    ffprobe.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    ffprobe.on("error", reject);
    ffprobe.on("close", (code) => {
      if (code === 0) {
        resolve(output);
        return;
      }

      reject(
        new Error(
          `ffprobe exited with code ${code ?? "unknown"}: ${stderr.trim()}`,
        ),
      );
    });
  });
  let parsed: unknown;

  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("ffprobe returned invalid JSON for the rendered MP4.");
  }

  const metadata = validateRenderedVideoProbe(parsed, options);

  logger.info(`Validated ${options.logLabel ?? "edited video"} MP4 before upload`, {
    ...metadata,
    renderId,
  });
}

export function buildScheduleCombinationSegmentArgs({
  hasAudio,
  hookAudioPath = null,
  inputPath,
  outputPath,
  payload,
  preparedTextOverlay,
  segmentLabel,
}: {
  hasAudio: boolean;
  hookAudioPath?: string | null;
  inputPath: string;
  outputPath: string;
  payload: RenderScheduleCombinationPayload;
  preparedTextOverlay: PreparedTextOverlay | null;
  segmentLabel: "demo" | "hook";
}) {
  const args = ["-y"];
  const isHook = segmentLabel === "hook";
  const trimDuration =
    isHook && payload.hookTrimEnd !== null
      ? payload.hookTrimEnd - payload.hookTrimStart
      : null;

  if (isHook && payload.hookTrimStart > 0) {
    args.push("-ss", formatSeconds(payload.hookTrimStart));
  }

  args.push("-i", inputPath);

  if (preparedTextOverlay) {
    args.push(
      "-loop",
      "1",
      "-framerate",
      "30",
      "-i",
      preparedTextOverlay.imagePath,
    );
  }

  const auxiliaryAudioInputIndex = preparedTextOverlay ? 2 : 1;
  const useHookAudio = isHook && Boolean(hookAudioPath);

  if (isHook && !hasAudio && !useHookAudio) {
    throw new Error(
      "The Hook source is silent and no approved Hook audio was supplied.",
    );
  }

  if (useHookAudio) {
    args.push("-i", hookAudioPath as string);
  } else if (!hasAudio) {
    args.push(
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
    );
  }

  if (trimDuration !== null) {
    args.push("-t", formatSeconds(trimDuration));
  }

  if (preparedTextOverlay) {
    args.push(
      "-filter_complex",
      buildEditedVideoFilterComplex(payload, [preparedTextOverlay]),
      "-map",
      "[rendered]",
    );
  } else {
    args.push("-vf", buildVideoFilters(payload), "-map", "0:v:0");
  }

  args.push(
    "-map",
    useHookAudio
      ? `${auxiliaryAudioInputIndex}:a:0`
      : hasAudio
        ? "0:a:0"
        : `${auxiliaryAudioInputIndex}:a:0`,
    ...(useHookAudio
      ? ["-filter:a", `volume=${TRENDING_LIBRARY_AUDIO_RENDER_GAIN}`]
      : []),
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath,
  );

  return args;
}

async function inputHasAudio(inputPath: string) {
  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

  return new Promise<boolean>((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ["-hide_banner", "-i", inputPath], {
      windowsHide: true,
    });
    let stderr = "";

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();

      if (stderr.length > MAX_FFMPEG_LOG_LENGTH) {
        stderr = stderr.slice(-MAX_FFMPEG_LOG_LENGTH);
      }
    });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", () => {
      resolve(/\bAudio:\s/.test(stderr));
    });
  });
}

function buildFfmpegArgs({
  inputPath,
  outputPath,
  payload,
  preparedTextOverlays,
}: {
  inputPath: string;
  outputPath: string;
  payload: RenderEditVideoPayload;
  preparedTextOverlays: PreparedTextOverlay[];
}) {
  const args = ["-y"];
  const trimDuration = getTrimDuration(payload);

  if (payload.draft.trimStartSeconds > 0) {
    args.push("-ss", formatSeconds(payload.draft.trimStartSeconds));
  }

  args.push("-i", inputPath);

  for (const overlay of preparedTextOverlays) {
    args.push("-loop", "1", "-framerate", "30", "-i", overlay.imagePath);
  }

  if (trimDuration !== null) {
    args.push("-t", formatSeconds(trimDuration));
  }

  args.push(
    "-filter_complex",
    buildEditedVideoFilterComplex(payload, preparedTextOverlays),
    "-map",
    "[rendered]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath,
  );

  return args;
}

function buildVideoFilters(payload: { ratio: RenderRatio }) {
  return [
    buildRatioScaleCropFilter(payload.ratio),
    "setsar=1",
    "fps=30",
  ].join(",");
}

function buildRatioScaleCropFilter(ratio: RenderRatio) {
  const { height, width } = renderDimensions[ratio];

  return [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
  ].join(",");
}

function buildEditedVideoFilterComplex(
  payload: { ratio: RenderRatio },
  preparedTextOverlays: PreparedTextOverlay[],
) {
  if (preparedTextOverlays.length === 0) {
    return `[0:v]${buildVideoFilters(payload)},setpts=PTS-STARTPTS[rendered]`;
  }

  const filters = [
    `[0:v]${buildVideoFilters(payload)},setpts=PTS-STARTPTS[video0]`,
  ];

  preparedTextOverlays.forEach((_, index) => {
    const inputLabel = index === 0 ? "video0" : `video${index}`;
    const outputLabel =
      index === preparedTextOverlays.length - 1
        ? "rendered"
        : `video${index + 1}`;
    const overlayInputIndex = index + 1;

    filters.push(
      `[${overlayInputIndex}:v]format=rgba,setpts=PTS-STARTPTS[image${index}]`,
      `[${inputLabel}][image${index}]overlay=x=0:y=0:shortest=1:format=auto[${outputLabel}]`,
    );
  });

  return filters.join(";");
}

function buildPreparedTextOverlay(params: {
  imagePath: string;
  overlay: RenderTextOverlay;
  ratio: RenderRatio;
}): PreparedTextOverlay | null {
  const text = params.overlay.text.trim();
  const savedLines = params.overlay.lines
    ?.map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean);

  if (!text) {
    return null;
  }

  const hasSavedFont =
    params.overlay.fontSize !== null && params.overlay.fontSize !== undefined;
  const hasSavedLines = Boolean(savedLines && savedLines.length > 0);

  if (hasSavedFont !== hasSavedLines) {
    throw new Error(
      "Hook text requires both saved lines and a saved font size.",
    );
  }

  if (
    hasSavedLines &&
    normalizeOverlayText(savedLines!.join(" ")) !== normalizeOverlayText(text)
  ) {
    throw new Error("The saved Hook lines do not match the Hook text.");
  }

  if (
    params.overlay.layoutVersion === HOOK_TEXT_LAYOUT_VERSION &&
    (!hasSavedFont || !hasSavedLines)
  ) {
    throw new Error("The authoritative Hook text layout is incomplete.");
  }

  const layout =
    hasSavedFont && savedLines && savedLines.length > 0
      ? buildResolvedEditOverlayTextLayout({
          fontSize: params.overlay.fontSize!,
          layoutVersion:
            params.overlay.layoutVersion ?? LEGACY_HOOK_TEXT_LAYOUT_VERSION,
          lines: savedLines,
          ratio: params.ratio,
          style: params.overlay.style,
          textColor: params.overlay.textColor,
        })
      : params.overlay.style === "hook"
        ? buildLegacyEditOverlayTextLayout(
            savedLines && savedLines.length > 0
              ? savedLines.join("\n")
              : text,
            params.overlay.style,
            params.ratio,
            params.overlay.textColor,
          )
        : buildEditOverlayTextLayout(
            savedLines && savedLines.length > 0
              ? savedLines.join("\n")
              : text,
            params.overlay.style,
            params.ratio,
            params.overlay.textColor,
          );

  return {
    imagePath: params.imagePath,
    layout,
    normalizedPosition: params.overlay.normalizedPosition ?? null,
    position: params.overlay.position,
    style: params.overlay.style,
  };
}

function normalizeOverlayText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

async function renderPreparedTextOverlayImage(
  preparedTextOverlay: PreparedTextOverlay,
) {
  await ensureEditOverlayFontRegistered();
  const svg = buildPreparedTextOverlaySvg(preparedTextOverlay);

  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(preparedTextOverlay.imagePath);
}

export function buildPreparedTextOverlaySvg(
  preparedTextOverlay: PreparedTextOverlay,
) {
  const { layout, normalizedPosition, position, style } = preparedTextOverlay;
  const {
    canvasHeight,
    canvasWidth,
    containerHeight,
    containerWidth,
    containerX: defaultContainerX,
  } = layout.bounds;
  const containerX = getOverlayContainerX(
    layout,
    defaultContainerX,
    normalizedPosition,
  );
  const containerY = getOverlayContainerY(
    layout,
    position,
    normalizedPosition,
  );
  const textTop = containerY + layout.padding;
  const centerX = containerX + containerWidth / 2;
  const fontFamily = escapeXml(
    `${EDIT_OVERLAY_FONT_FAMILY}, Noto Sans CJK SC, Noto Sans CJK JP, sans-serif`,
  );
  const background =
    layout.backgroundOpacity === null
      ? ""
      : [
          `<rect x="${containerX}" y="${containerY}"`,
          ` width="${containerWidth}" height="${containerHeight}"`,
          ` rx="${getOverlayCornerRadius(style, layout.fontSize)}"`,
          ` fill="#000000" fill-opacity="${layout.backgroundOpacity}" />`,
        ].join("");
  const textLines = layout.lines.flatMap((line, index) => {
    if (!line) {
      return [];
    }

    const baselineY = Math.round(
      textTop + layout.fontSize * 0.82 + index * layout.lineHeight,
    );
    const commonAttributes = [
      `font-family="${fontFamily}"`,
      `font-size="${layout.fontSize}"`,
      `font-weight="${layout.fontWeight}"`,
      'text-anchor="middle"',
      'xml:space="preserve"',
    ]
      .filter(Boolean)
      .join(" ");

    if (style === "hook" && hasHookInlineSymbols(line)) {
      return buildHookInlineTextLineSvg({
        baselineY,
        centerX,
        commonAttributes: commonAttributes.replace(/text-anchor="middle"\s*/u, ""),
        fontSize: layout.fontSize,
        line,
        textColor: layout.textColor,
      });
    }

    const escapedLine = escapeXml(line);

    const separationLayer =
      style === "hook"
        ? `<text x="${centerX}" y="${baselineY}" ${commonAttributes} fill="#000000" fill-opacity="0.82" stroke="#000000" stroke-opacity="0.82" stroke-width="5" stroke-linejoin="round" paint-order="stroke fill">${escapedLine}</text>`
        : `<text x="${centerX + EDIT_OVERLAY_SHADOW_OFFSET_PX}" y="${baselineY + EDIT_OVERLAY_SHADOW_OFFSET_PX}" ${commonAttributes} fill="${escapeXml(EDIT_OVERLAY_SHADOW_COLOR)}">${escapedLine}</text>`;

    return [
      separationLayer,
      `<text x="${centerX}" y="${baselineY}" ${commonAttributes} fill="${layout.textColor}">${escapedLine}</text>`,
    ];
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" text-rendering="geometricPrecision">`,
    background,
    ...textLines,
    "</svg>",
  ].join("");
}

function buildHookInlineTextLineSvg(params: {
  baselineY: number;
  centerX: number;
  commonAttributes: string;
  fontSize: number;
  line: string;
  textColor: string;
}) {
  const tokens = tokenizeHookInlineSymbols(params.line);
  const lineWidth = estimateEditOverlayLineWidth(
    params.line,
    params.fontSize,
  );
  let cursorX = params.centerX - lineWidth / 2;

  return tokens.flatMap((token) => {
    if (token.kind === "unsupported") {
      return [];
    }

    if (token.kind === "symbol") {
      const iconAdvance = estimateEditOverlayLineWidth("❌", params.fontSize);
      const iconSize = params.fontSize * 0.96;
      const iconX = cursorX + (iconAdvance - iconSize) / 2;
      const iconY = params.baselineY - params.fontSize * 0.84;
      cursorX += iconAdvance;

      return [
        buildHookInlineSymbolSvg({
          name: token.name,
          size: iconSize,
          x: iconX,
          y: iconY,
        }),
      ];
    }

    const escapedText = escapeXml(token.value);
    const fragmentWidth = estimateEditOverlayLineWidth(
      token.value,
      params.fontSize,
    );
    const x = cursorX;
    cursorX += fragmentWidth;

    return [
      `<text x="${x}" y="${params.baselineY}" ${params.commonAttributes} fill="#000000" fill-opacity="0.82" stroke="#000000" stroke-opacity="0.82" stroke-width="5" stroke-linejoin="round" paint-order="stroke fill">${escapedText}</text>`,
      `<text x="${x}" y="${params.baselineY}" ${params.commonAttributes} fill="${escapeXml(params.textColor)}">${escapedText}</text>`,
    ];
  });
}

export function ensureEditOverlayFontRegistered() {
  editOverlayFontRegistrationPromise ??= registerAndVerifyEditOverlayFont();
  return editOverlayFontRegistrationPromise;
}

async function registerAndVerifyEditOverlayFont() {
  const fontPath = await getEditOverlayFontPath();
  const directText = await sharp({
    text: {
      dpi: 72,
      font: `${EDIT_OVERLAY_FONT_FAMILY} SemiBold ${EDIT_OVERLAY_FONT_REGISTRATION_SIZE}`,
      fontfile: fontPath,
      rgba: true,
      text: escapePangoMarkup(EDIT_OVERLAY_FONT_REGISTRATION_TEXT),
      wrap: "none",
    },
  })
    .trim({ background: { alpha: 0, b: 0, g: 0, r: 0 } })
    .png()
    .toBuffer();
  const verificationSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="160">',
    `<text x="20" y="100" font-family="${EDIT_OVERLAY_FONT_FAMILY}" font-size="${EDIT_OVERLAY_FONT_REGISTRATION_SIZE}" font-weight="600" fill="#ffffff">`,
    escapeXml(EDIT_OVERLAY_FONT_REGISTRATION_TEXT),
    "</text></svg>",
  ].join("");
  const registeredText = await sharp(Buffer.from(verificationSvg))
    .trim({ background: { alpha: 0, b: 0, g: 0, r: 0 } })
    .png()
    .toBuffer();
  const [directMetadata, registeredMetadata] = await Promise.all([
    sharp(directText).metadata(),
    sharp(registeredText).metadata(),
  ]);
  const directBounds = requireImageBounds(directMetadata, "fontfile probe");
  const registeredBounds = requireImageBounds(
    registeredMetadata,
    "registered SVG probe",
  );

  if (
    Math.abs(directBounds.width - registeredBounds.width) > 2 ||
    Math.abs(directBounds.height - registeredBounds.height) > 2
  ) {
    throw new Error(
      "Geist SemiBold registration verification failed; refusing to render with a fallback font.",
    );
  }

  return { directBounds, fontPath, registeredBounds };
}

async function getEditOverlayFontPath() {
  const packagedFontParts = [
    "node_modules",
    "geist",
    "dist",
    "fonts",
    "geist-sans",
    "Geist-SemiBold.ttf",
  ];
  const packagedFontPath = join(/* turbopackIgnore: true */ process.cwd(), "node_modules", "geist", "dist", "fonts", "geist-sans", "Geist-SemiBold.ttf");
  const workspaceFontPath = join(/* turbopackIgnore: true */ process.cwd(), "..", "node_modules", "geist", "dist", "fonts", "geist-sans", "Geist-SemiBold.ttf");
  const candidatePaths =
    process.platform === "win32"
      ? [packagedFontPath, workspaceFontPath]
      : [
          packagedFontPath,
          workspaceFontPath,
          "/usr/local/share/fonts/geist/Geist-SemiBold.ttf",
        ];

  for (const fontPath of candidatePaths) {
    try {
      await readFile(/* turbopackIgnore: true */ fontPath);
      return fontPath;
    } catch {
      // Try the next packaged or container font path.
    }
  }

  throw new Error(
    "Geist SemiBold is unavailable; refusing to render with a fallback font.",
  );
}

function requireImageBounds(
  metadata: { height?: number; width?: number },
  label: string,
) {
  if (!metadata.height || !metadata.width) {
    throw new Error(`Could not measure the ${label}.`);
  }

  return { height: metadata.height, width: metadata.width };
}

function getOverlayContainerY(
  layout: EditOverlayTextLayout,
  position: TextOverlayPosition,
  normalizedPosition?: NormalizedTextPosition | null,
) {
  const { canvasHeight, containerHeight } = layout.bounds;
  const verticalInset = Math.round(
    canvasHeight * (EDIT_OVERLAY_VERTICAL_INSET_PERCENT / 100),
  );

  if (normalizedPosition) {
    return clampNumber(
      Math.round(normalizedPosition.y * canvasHeight - containerHeight / 2),
      verticalInset,
      canvasHeight - verticalInset - containerHeight,
    );
  }

  if (position === "top") {
    return verticalInset;
  }

  if (position === "middle") {
    return Math.round((canvasHeight - containerHeight) / 2);
  }

  return canvasHeight - verticalInset - containerHeight;
}

function getOverlayContainerX(
  layout: EditOverlayTextLayout,
  fallback: number,
  normalizedPosition?: NormalizedTextPosition | null,
) {
  if (!normalizedPosition) {
    return fallback;
  }

  const { canvasWidth, containerWidth } = layout.bounds;
  const horizontalInset = Math.round(canvasWidth * 0.04);

  return clampNumber(
    Math.round(normalizedPosition.x * canvasWidth - containerWidth / 2),
    horizontalInset,
    canvasWidth - horizontalInset - containerWidth,
  );
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getOverlayCornerRadius(
  style: TextOverlayStyle,
  fontSize: number,
) {
  return style === "bubble"
    ? Math.round(fontSize * 0.32)
    : Math.round(fontSize * 0.18);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getTrimDuration(payload: RenderEditVideoPayload) {
  const trimEnd = payload.draft.trimEndSeconds;

  if (trimEnd === null) {
    return null;
  }

  return Math.max(0, trimEnd - payload.draft.trimStartSeconds);
}

function buildRenderedVideoKey(payload: RenderEditVideoPayload) {
  return [
    "videos",
    "rendered",
    cleanPathPart(payload.userId),
    cleanPathPart(payload.projectId),
    `${cleanPathPart(payload.renderId)}.mp4`,
  ].join("/");
}

function buildScheduleCombinationVideoKey(
  payload: RenderScheduleCombinationPayload,
) {
  return [
    "videos",
    "rendered",
    cleanPathPart(payload.userId),
    cleanPathPart(payload.projectId),
    "schedule-combinations",
    `${cleanPathPart(payload.renderId)}.mp4`,
  ].join("/");
}

function buildWallTextVideoKey(payload: RenderWallTextVideoPayload) {
  return [
    "videos",
    "rendered",
    cleanPathPart(payload.userId),
    cleanPathPart(payload.projectId),
    "wall-text",
    `${cleanPathPart(payload.renderId)}.mp4`,
  ].join("/");
}

function buildCreateContentVideoKey(payload: RenderCreateContentVideoPayload) {
  return [
    "videos",
    "rendered",
    cleanPathPart(payload.userId),
    cleanPathPart(payload.projectId),
    "create-content",
    `${cleanPathPart(getCreateContentRenderArtifactId(payload))}.mp4`,
  ].join("/");
}

function getCreateContentRenderArtifactId(
  payload: Pick<RenderCreateContentVideoPayload, "renderAttempt" | "renderId">,
) {
  return `${payload.renderId}-attempt-${payload.renderAttempt}`;
}

function buildReactionVideoKey(payload: RenderReactionVideoPayload) {
  return [
    "videos",
    "rendered",
    "reaction",
    cleanPathPart(payload.creativeId),
    `${cleanPathPart(payload.renderId)}.mp4`,
  ].join("/");
}

function cleanPathPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function formatSeconds(value: number) {
  return Math.max(0, value).toFixed(3);
}

function escapeConcatPath(value: string) {
  return value.replace(/\\/g, "/").replace(/'/g, "'\\''");
}
