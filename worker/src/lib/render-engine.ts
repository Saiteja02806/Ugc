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
  buildEditOverlayTextLayout,
  buildResolvedEditOverlayTextLayout,
  type EditOverlayTextLayout,
} from "./edit-overlay-render-spec.js";
import {
  buildWallTextRenderLayout,
  buildWallTextOverlaySvg,
  WALL_TEXT_OUTLINE_WIDTH,
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
    const [sourceBuffer, audioBuffer] = await Promise.all([
      downloadVideoToBuffer(payload.sourceVideoUrl),
      downloadAudioToBuffer(payload.audio.audioUrl, {
        maxBytes: 50 * 1024 * 1024,
      }),
    ]);
    await ensureWallTextFontsRegistered();
    await validateWallTextRenderedLineWidths(payload.text, payload.textBox);
    const overlaySvg = buildWallTextOverlaySvg({
      content: payload.text,
      placement: payload.placement,
      safeArea: payload.safeArea,
      textColor: payload.textColor,
      textBox: payload.textBox,
    });

    await Promise.all([
      writeFile(audioPath, audioBuffer),
      writeFile(inputPath, sourceBuffer),
      sharp(Buffer.from(overlaySvg))
        .png({ compressionLevel: 9 })
        .toFile(overlayPath),
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

  const layout =
    params.overlay.fontSize !== null &&
    params.overlay.fontSize !== undefined &&
    savedLines &&
    savedLines.length > 0
      ? buildResolvedEditOverlayTextLayout({
          fontSize: params.overlay.fontSize,
          lines: savedLines,
          ratio: params.ratio,
          style: params.overlay.style,
          textColor: params.overlay.textColor,
        })
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
    `${EDIT_OVERLAY_FONT_FAMILY}, Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Noto Sans CJK SC, Noto Sans CJK JP, sans-serif`,
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
    const escapedLine = escapeXml(line);
    const commonAttributes = [
      `font-family="${fontFamily}"`,
      `font-size="${layout.fontSize}"`,
      `font-weight="${layout.fontWeight}"`,
      'text-anchor="middle"',
      'xml:space="preserve"',
    ]
      .filter(Boolean)
      .join(" ");

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

export function ensureWallTextFontsRegistered() {
  wallTextFontRegistrationPromise ??= registerWallTextFonts();
  return wallTextFontRegistrationPromise;
}

async function registerWallTextFonts() {
  const fontPath = await getWallTextFontPath();
  const directText = await sharp({
    text: {
      dpi: 72,
      font: "Inter Bold 52",
      fontfile: fontPath,
      rgba: true,
      text: "Wall text 0123",
      wrap: "none",
    },
  }).metadata();

  if (!directText.width || !directText.height) {
    throw new Error(
      "Inter Bold could not be registered for Wall-of-text rendering.",
    );
  }
}

async function validateWallTextRenderedLineWidths(
  content: WallTextRenderContent,
  textBox: WallTextNormalizedBox,
) {
  const maximumWidth = Math.round(textBox.width * WALL_TEXT_RENDER_WIDTH);
  const layout = buildWallTextRenderLayout({ content, textBox });
  const fontPath = await getWallTextFontPath();

  for (const segment of layout.segments) {
    for (const line of segment.lines) {
      const metadata = await sharp({
        text: {
          dpi: 72,
          font: `Inter Bold ${segment.fontSize}`,
          fontfile: fontPath,
          rgba: true,
          text: escapePangoMarkup(line),
          wrap: "none",
        },
      }).metadata();

      if (
        !metadata.width ||
        metadata.width + WALL_TEXT_OUTLINE_WIDTH * 2 > maximumWidth
      ) {
        throw new Error(
          `Wall-of-text line exceeds the measured Inter text width: "${line}"`,
        );
      }
    }
  }
}

async function getWallTextFontPath() {
  const fontParts = [
    "node_modules",
    "@fontsource",
    "inter",
    "files",
    "inter-latin-700-normal.woff",
  ];
  const candidatePaths = [
    join(process.cwd(), ...fontParts),
    join(process.cwd(), "..", ...fontParts),
  ];

  for (const fontPath of candidatePaths) {
    try {
      await readFile(fontPath);
      return fontPath;
    } catch {
      // Try the next packaged font path.
    }
  }

  throw new Error(
    "Inter Bold is unavailable; refusing to render with a fallback font.",
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
