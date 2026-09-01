import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";

import {
  getStorageProviderName,
  uploadBufferToStorage,
} from "./storage.js";
import {
  downloadAudioToBuffer,
  downloadVideoToBuffer,
} from "./download-video.js";
import {
  EDIT_OVERLAY_FONT_FAMILY,
  EDIT_OVERLAY_OUTPUT_DIMENSIONS,
  EDIT_OVERLAY_SHADOW_COLOR,
  EDIT_OVERLAY_SHADOW_OFFSET_PX,
  EDIT_OVERLAY_VERTICAL_INSET_PERCENT,
  HOOK_TEXT_LAYOUT_VERSION,
  LEGACY_HOOK_TEXT_LAYOUT_VERSION,
  buildEditOverlayTextLayout,
  buildLegacyEditOverlayTextLayout,
  buildResolvedEditOverlayTextLayout,
  estimateEditOverlayLineWidth,
  type EditOverlayTextLayout,
  type HookTextLayoutVersion,
} from "./edit-overlay-render-spec.js";
import {
  buildHookInlineSymbolSvg,
  hasHookInlineSymbols,
  tokenizeHookInlineSymbols,
} from "./hook-inline-symbols.js";
import {
  buildWallTextRenderLayout,
  buildWallTextOverlaySvg,
  WALL_TEXT_INLINE_SAFE_PADDING,
  WALL_TEXT_OUTLINE_WIDTH,
  WALL_TEXT_RENDER_HEIGHT,
  WALL_TEXT_RENDER_WIDTH,
  type WallTextNormalizedBox,
  type WallTextPlacementZone,
  type WallTextRenderContent,
  type WallTextSafeArea,
} from "./wall-text-render-spec.js";
import { logger } from "../logger.js";

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
let wallTextFontRegistrationPromise: Promise<void> | null = null;

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
    selectionSource: "video_locked";
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

export type RenderWallTextVideoPayload = {
  assignmentId: string;
  attribution: {
    contentHash: string;
    editClassification: "major" | "minor" | "none";
    formatId: string | null;
    formatLearningEligible: boolean;
    formatVersion: number;
    instagramReelTemplateId: string | null;
    selectionMode: string;
    selectionWeight: number;
    selectorVersion: string;
    sourceKind: "creative_asset" | "instagram_reel" | "ugcpilot";
  };
  audio: {
    assetDurationSeconds: number;
    assetId: string;
    audioUrl: string;
    cueStartSeconds: number;
    fadeOutSeconds: number;
    fitMode: "exact" | "trim" | "loop";
    matchingVersion: string;
    selectionId: string;
  };
  creativeEditId: string | null;
  creativeEditRevision: number | null;
  creativeId: string;
  durationSeconds: number;
  placement: WallTextPlacementZone;
  projectId: string;
  renderId: string;
  safeArea: WallTextSafeArea;
  sourceVideoUrl: string;
  text: WallTextRenderContent;
  textColor: string;
  textBox: WallTextNormalizedBox;
  title: string;
  userId: string;
};

export type RenderWallTextVideoOutput = {
  assignmentId: string;
  creativeId: string;
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
    ? join(workDir, "hook-locked-audio")
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
    await ensureWallTextFontsRegistered();
    assertWallTextTextBoxMatchesPayload(payload.text, payload.textBox);
    const renderContent = await reflowWallTextContentForRenderer({
      content: payload.text,
      textBox: payload.textBox,
    });
    await validateWallTextRenderedLineWidths(renderContent, payload.textBox);
    const overlaySvg = buildWallTextOverlaySvg({
      content: renderContent,
      placement: payload.placement,
      safeArea: payload.safeArea,
      textColor: payload.textColor,
      textBox: payload.textBox,
    });
    const overlayPng = await rasterizeWallTextOverlay({
      overlaySvg,
      textBox: payload.textBox,
    });
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
  const useLockedHookAudio = isHook && Boolean(hookAudioPath);

  if (useLockedHookAudio) {
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
    useLockedHookAudio
      ? `${auxiliaryAudioInputIndex}:a:0`
      : hasAudio
        ? "0:a:0"
        : `${auxiliaryAudioInputIndex}:a:0`,
    ...(useLockedHookAudio
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

export function ensureWallTextFontsRegistered() {
  wallTextFontRegistrationPromise ??= registerWallTextFonts();
  return wallTextFontRegistrationPromise;
}

async function registerWallTextFonts() {
  const fonts = await Promise.all([
    getWallTextFont({ family: "Inter" }),
    getWallTextFont({ family: "Arial" }),
  ]);

  await Promise.all(
    fonts.map(async (font) => {
      const directText = await sharp({
        text: {
          dpi: 72,
          font: `${font.name} 46`,
          fontfile: font.path,
          rgba: true,
          text: "Wall text 0123",
          wrap: "none",
        },
      }).metadata();

      if (!directText.width || !directText.height) {
        throw new Error(
          `${font.name} could not be registered for Wall-of-text rendering.`,
        );
      }
    }),
  );
}

async function validateWallTextRenderedLineWidths(
  content: WallTextRenderContent,
  textBox: WallTextNormalizedBox,
) {
  const maximumWidth =
    Math.round(textBox.width * WALL_TEXT_RENDER_WIDTH) -
    WALL_TEXT_INLINE_SAFE_PADDING * 2;
  const layout = buildWallTextRenderLayout({ content, textBox });
  const font = await getWallTextFontForContent(content);

  for (const segment of layout.segments) {
    for (const line of segment.lines) {
      const metadata = await sharp({
        text: {
          dpi: 72,
            font: `${font.name} ${segment.fontSize}`,
          fontfile: font.path,
          rgba: true,
          text: escapePangoMarkup(line),
          wrap: "none",
        },
      }).metadata();

      if (
        !metadata.width ||
        metadata.width + WALL_TEXT_OUTLINE_WIDTH * 2 >= maximumWidth
      ) {
        throw new Error(
          `Wall-of-text line exceeds the measured ${font.name} text width: "${line}"`,
        );
      }
    }
  }
}

/**
 * The browser produces the initial semantic layout, but its font engine is
 * not byte-for-byte identical to the packaged renderer font. Reflow the
 * persisted legacy layout with the renderer's own Inter metrics before
 * drawing it, so a one-pixel metrics difference never turns a valid Reel into
 * a failed background job. V3 uses the exact same bundled Arial Bold bytes in
 * both layout stages, so its measured five-to-eight-line layout is immutable.
 */
export async function reflowWallTextContentForRenderer(params: {
  content: WallTextRenderContent;
  textBox: WallTextNormalizedBox;
}): Promise<WallTextRenderContent> {
  const { content, textBox } = params;

  if (
    !content.finalLayout ||
    content.finalLayout.version === "wall-text-final-layout-v3"
  ) {
    return content;
  }

  const maximumWidth =
    Math.round(textBox.width * WALL_TEXT_RENDER_WIDTH) -
    WALL_TEXT_INLINE_SAFE_PADDING * 2;
  const maximumHeight = Math.round(textBox.height * WALL_TEXT_RENDER_HEIGHT);
  const font = await getWallTextFontForContent(content);
  const fontSizes = getWallTextReflowFontSizes(content.finalLayout.fontSizePx);

  for (const fontSizePx of fontSizes) {
    const blocks = await Promise.all(
      content.finalLayout.blocks.map(async (block) => ({
        lines: await reflowWallTextBlockLines({
          font,
          fontSizePx,
          maximumWidth,
          text: block.lines.join(" "),
        }),
        role: block.role,
      })),
    );
    const lineCount = blocks.reduce((total, block) => total + block.lines.length, 0);

    if (
      ["wall-text-final-layout-v2", "wall-text-final-layout-v3"].includes(
        content.finalLayout.version,
      ) &&
      (lineCount < 4 || lineCount > 8)
    ) {
      continue;
    }

    const lineHeightPx = Math.round(fontSizePx * 1.1 * 100) / 100;
    const blockHeight =
      lineCount * lineHeightPx + Math.max(0, blocks.length - 1) * 18;

    if (blockHeight > maximumHeight) {
      continue;
    }

    const finalLayout = {
      ...content.finalLayout,
      blocks,
      fontSizePx,
      fontWeight: 400 as const,
      lineHeightPx,
    };

    return { ...content, finalLayout };
  }

  throw new Error(
    "Wall-of-text copy cannot fit the selected placement zone with the renderer font.",
  );
}

function getWallTextReflowFontSizes(
  selectedFontSize: NonNullable<WallTextRenderContent["finalLayout"]>["fontSizePx"],
) {
  const supportedFontSizes = [52, 50, 48, 46, 44, 42, 40, 38, 36] as const;

  return supportedFontSizes.filter((fontSize) => fontSize <= selectedFontSize);
}

async function reflowWallTextBlockLines(params: {
  font: WallTextRenderFont;
  fontSizePx: number;
  maximumWidth: number;
  text: string;
}) {
  const words = params.text.replace(/\s+/gu, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const candidateWidth = await measureWallTextLineWidth({
      font: params.font,
      fontSizePx: params.fontSizePx,
      text: candidate,
    });

    if (candidateWidth + WALL_TEXT_OUTLINE_WIDTH * 2 < params.maximumWidth) {
      line = candidate;
      continue;
    }

    if (!line) {
      throw new Error(
        `Wall-of-text word exceeds the measured ${params.font.name} text width: "${word}"`,
      );
    }

    lines.push(line);
    line = word;
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

async function measureWallTextLineWidth(params: {
  font: WallTextRenderFont;
  fontSizePx: number;
  text: string;
}) {
  const metadata = await sharp({
    text: {
      dpi: 72,
      font: `${params.font.name} ${params.fontSizePx}`,
      fontfile: params.font.path,
      rgba: true,
      text: escapePangoMarkup(params.text),
      wrap: "none",
    },
  }).metadata();

  if (!metadata.width) {
    throw new Error(
      `${params.font.name} could not measure Wall-of-text copy for rendering.`,
    );
  }

  return metadata.width;
}

export function assertWallTextTextBoxMatchesPayload(
  content: WallTextRenderContent,
  payloadTextBox: WallTextNormalizedBox,
) {
  const savedTextBox = content.finalLayout?.textBox;

  if (!savedTextBox) {
    return;
  }

  const fields = ["height", "width", "x", "y"] as const;
  const matches = fields.every(
    (field) => Math.abs(savedTextBox[field] - payloadTextBox[field]) < 0.000001,
  );

  if (!matches) {
    throw new Error(
      "Wall-of-text final layout text box does not match the render payload.",
    );
  }
}

type WallTextPixelBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export function assertWallTextOverlayPixelsInsideTextBox(params: {
  channels: number;
  height: number;
  pixels: Buffer;
  textBox: {
    height: number;
    left: number;
    top: number;
    width: number;
  };
  width: number;
}) {
  const bounds = getWallTextPixelBounds(params);

  if (!bounds) {
    throw new Error("Wall-of-text overlay did not draw any visible pixels.");
  }

  const innerLeft = params.textBox.left + WALL_TEXT_INLINE_SAFE_PADDING;
  const innerRight =
    params.textBox.left + params.textBox.width - WALL_TEXT_INLINE_SAFE_PADDING - 1;
  const innerTop = params.textBox.top;
  const innerBottom = params.textBox.top + params.textBox.height - 1;

  // The inner fence itself is not usable text space. A fully transparent
  // pixel remains between the visible outline/shadow and every fence edge.
  if (
    bounds.left <= innerLeft ||
    bounds.right >= innerRight ||
    bounds.top <= innerTop ||
    bounds.bottom >= innerBottom
  ) {
    throw new Error(
      "Wall-of-text overlay crosses the protected inner text fence.",
    );
  }

  return bounds;
}

async function rasterizeWallTextOverlay(params: {
  overlaySvg: string;
  textBox: WallTextNormalizedBox;
}) {
  const raster = await sharp(Buffer.from(params.overlaySvg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  assertWallTextOverlayPixelsInsideTextBox({
    channels: raster.info.channels,
    height: raster.info.height,
    pixels: raster.data,
    textBox: {
      height: Math.round(params.textBox.height * WALL_TEXT_RENDER_HEIGHT),
      left: Math.round(params.textBox.x * WALL_TEXT_RENDER_WIDTH),
      top: Math.round(params.textBox.y * WALL_TEXT_RENDER_HEIGHT),
      width: Math.round(params.textBox.width * WALL_TEXT_RENDER_WIDTH),
    },
    width: raster.info.width,
  });

  return sharp(raster.data, {
    raw: {
      channels: raster.info.channels,
      height: raster.info.height,
      width: raster.info.width,
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function getWallTextPixelBounds(params: {
  channels: number;
  height: number;
  pixels: Buffer;
  width: number;
}): WallTextPixelBounds | null {
  if (params.channels < 4) {
    throw new Error("Wall-of-text overlay must contain an alpha channel.");
  }

  let left = params.width;
  let right = -1;
  let top = params.height;
  let bottom = -1;

  for (let y = 0; y < params.height; y += 1) {
    for (let x = 0; x < params.width; x += 1) {
      const alphaOffset = (y * params.width + x) * params.channels + 3;
      if (params.pixels[alphaOffset] === 0) {
        continue;
      }

      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  return right < left || bottom < top ? null : { bottom, left, right, top };
}

type WallTextRenderFont = {
  name: "Arial Bold" | "Inter Regular";
  path: string;
};

async function getWallTextFontForContent(content: WallTextRenderContent) {
  return getWallTextFont({
    family:
      content.finalLayout?.version === "wall-text-final-layout-v3"
        ? "Arial"
        : "Inter",
  });
}

async function getWallTextFont(params: {
  family: "Arial" | "Inter";
}): Promise<WallTextRenderFont> {
  if (params.family === "Arial") {
    const candidatePaths = [
      join(process.cwd(), "assets", "fonts", "arial-bold.ttf"),
      join(process.cwd(), "worker", "src", "assets", "fonts", "arial-bold.ttf"),
    ];

    for (const fontPath of candidatePaths) {
      try {
        await readFile(fontPath);
        return { name: "Arial Bold", path: fontPath };
      } catch {
        // Try the next packaged font path.
      }
    }

    throw new Error(
      "Arial Bold is unavailable; refusing to render Wall-of-text with a fallback font.",
    );
  }

  const fontParts = [
    "node_modules",
    "@fontsource",
    "inter",
    "files",
    "inter-latin-400-normal.woff2",
  ];
  const candidatePaths = [
    join(process.cwd(), ...fontParts),
    join(process.cwd(), "..", ...fontParts),
  ];

  for (const fontPath of candidatePaths) {
    try {
      await readFile(fontPath);
      return { name: "Inter Regular", path: fontPath };
    } catch {
      // Try the next packaged font path.
    }
  }

  throw new Error(
    "Inter Regular is unavailable; refusing to render with a fallback font.",
  );
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
  const packagedFontPath = join(process.cwd(), ...packagedFontParts);
  const workspaceFontPath = join(process.cwd(), "..", ...packagedFontParts);
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
      await readFile(fontPath);
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

function escapePangoMarkup(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
