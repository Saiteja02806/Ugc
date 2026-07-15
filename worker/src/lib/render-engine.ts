import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { uploadBufferToS3 } from "./s3.js";
import { downloadVideoToBuffer } from "./download-video.js";
import { logger } from "../logger.js";

export type RenderRatio = "9:16" | "1:1" | "4:5" | "16:9";
export type TextOverlayPosition = "top" | "middle" | "bottom";
export type TextOverlayStyle = "clean" | "minimal" | "bubble";
type PreparedTextOverlay = {
  boxBorderWidth: number;
  fontSize: number;
  position: TextOverlayPosition;
  style: TextOverlayStyle;
  text: string;
  textFilePath: string;
};

type RenderTextOverlay = {
  id: string;
  position: TextOverlayPosition;
  style: TextOverlayStyle;
  text: string;
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
  demoVideoId: string;
  demoVideoUrl: string;
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

const OUTPUT_CONTENT_TYPE = "video/mp4";
const MAX_FFMPEG_LOG_LENGTH = 8_000;
const renderDimensions: Record<RenderRatio, { height: number; width: number }> =
  {
    "9:16": { width: 1080, height: 1920 },
    "1:1": { width: 1080, height: 1080 },
    "4:5": { width: 1080, height: 1350 },
    "16:9": { width: 1920, height: 1080 },
  };

export async function renderEditedVideoToS3(
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
          overlay,
          ratio: payload.ratio,
          textFilePath: join(workDir, `overlay-text-${index}.txt`),
        }),
      )
      .filter(
        (overlay): overlay is PreparedTextOverlay => Boolean(overlay),
      );

    await writeFile(inputPath, sourceBuffer);
    const sourceReadyAt = Date.now();

    await Promise.all(
      preparedTextOverlays.map((overlay) =>
        writeFile(overlay.textFilePath, overlay.text, "utf8"),
      ),
    );

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
    const encodedAt = Date.now();

    const renderedBuffer = await readFile(outputPath);
    const key = buildRenderedVideoKey(payload);
    const result = await uploadBufferToS3({
      key,
      buffer: renderedBuffer,
      contentType: OUTPUT_CONTENT_TYPE,
      cacheControl: "public, max-age=31536000, immutable",
    });
    const uploadedAt = Date.now();

    logger.info("Edited video render uploaded to S3", {
      key: result.key,
      renderId: payload.renderId,
      renderedSize: renderedBuffer.length,
      sourceVideoId: payload.sourceVideoId,
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

export async function renderScheduleCombinationToS3(
  payload: RenderScheduleCombinationPayload,
): Promise<RenderScheduleCombinationOutput> {
  const workDir = await mkdtemp(join(tmpdir(), "ugc-combine-render-"));
  const hookInputPath = join(workDir, "hook-source-video");
  const demoInputPath = join(workDir, "demo-source-video");
  const hookSegmentPath = join(workDir, "hook-normalized.mp4");
  const demoSegmentPath = join(workDir, "demo-normalized.mp4");
  const concatListPath = join(workDir, "concat-list.txt");
  const outputPath = join(workDir, "combined.mp4");

  try {
    const [hookBuffer, demoBuffer] = await Promise.all([
      downloadVideoToBuffer(payload.hookVideoUrl),
      downloadVideoToBuffer(payload.demoVideoUrl),
    ]);

    await Promise.all([
      writeFile(hookInputPath, hookBuffer),
      writeFile(demoInputPath, demoBuffer),
    ]);

    logger.info("Schedule combination sources downloaded", {
      demoSize: demoBuffer.length,
      demoVideoId: payload.demoVideoId,
      hookSize: hookBuffer.length,
      hookVideoId: payload.hookVideoId,
      renderId: payload.renderId,
      scheduleId: payload.scheduleId,
    });

    await normalizeCombinationSegment({
      inputPath: hookInputPath,
      outputPath: hookSegmentPath,
      payload,
      segmentLabel: "hook",
    });
    await normalizeCombinationSegment({
      inputPath: demoInputPath,
      outputPath: demoSegmentPath,
      payload,
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

    const renderedBuffer = await readFile(outputPath);
    const key = buildScheduleCombinationVideoKey(payload);
    const result = await uploadBufferToS3({
      key,
      buffer: renderedBuffer,
      contentType: OUTPUT_CONTENT_TYPE,
      cacheControl: "public, max-age=31536000, immutable",
    });

    logger.info("Schedule combination render uploaded to S3", {
      key: result.key,
      renderId: payload.renderId,
      renderedSize: renderedBuffer.length,
      scheduleId: payload.scheduleId,
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
  } finally {
    await rm(workDir, {
      force: true,
      recursive: true,
    });
  }
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
  inputPath,
  outputPath,
  payload,
  segmentLabel,
}: {
  inputPath: string;
  outputPath: string;
  payload: RenderScheduleCombinationPayload;
  segmentLabel: string;
}) {
  const hasAudio = await inputHasAudio(inputPath);
  const args = ["-y", "-i", inputPath];

  if (!hasAudio) {
    args.push(
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=48000",
    );
  }

  args.push(
    "-vf",
    buildVideoFilters(payload, []),
    "-map",
    "0:v:0",
    "-map",
    hasAudio ? "0:a:0" : "1:a:0",
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

  await runFfmpegCommand({
    args,
    label: `schedule ${segmentLabel} segment normalize`,
    renderId: payload.renderId,
  });
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
  const filters = buildVideoFilters(payload, preparedTextOverlays);

  if (payload.draft.trimStartSeconds > 0) {
    args.push("-ss", formatSeconds(payload.draft.trimStartSeconds));
  }

  args.push("-i", inputPath);

  if (trimDuration !== null) {
    args.push("-t", formatSeconds(trimDuration));
  }

  args.push(
    "-vf",
    filters,
    "-map",
    "0:v:0",
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

function buildVideoFilters(
  payload: { ratio: RenderRatio },
  preparedTextOverlays: PreparedTextOverlay[],
) {
  const filters = [
    buildRatioScaleCropFilter(payload.ratio),
    "setsar=1",
    "fps=30",
  ];
  filters.push(...preparedTextOverlays.map(buildDrawTextFilter));

  return filters.join(",");
}

function buildRatioScaleCropFilter(ratio: RenderRatio) {
  const { height, width } = renderDimensions[ratio];

  return [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
  ].join(",");
}

function buildDrawTextFilter(preparedTextOverlay: PreparedTextOverlay) {
  const lineSpacing = preparedTextOverlay.style === "bubble" ? 10 : 8;
  const boxOpacity =
    preparedTextOverlay.style === "bubble"
      ? "0.65"
      : preparedTextOverlay.style === "minimal"
        ? "0.35"
        : null;
  const boxOptions = boxOpacity
    ? `:box=1:boxcolor=black@${boxOpacity}:boxborderw=${preparedTextOverlay.boxBorderWidth}`
    : "";

  return [
    "drawtext=textfile='",
    escapeDrawText(preparedTextOverlay.textFilePath),
    "'",
    ":fontcolor=white",
    `:fontsize=${preparedTextOverlay.fontSize}`,
    `:line_spacing=${lineSpacing}`,
    ":fontfile=",
    escapeDrawText(getFontPath()),
    ":x=(w-text_w)/2",
    `:y=${getDrawTextYExpression(preparedTextOverlay.position)}`,
    ":fix_bounds=1",
    ":shadowcolor=black@0.45",
    ":shadowx=2",
    ":shadowy=2",
    boxOptions,
  ].join("");
}

function buildPreparedTextOverlay(params: {
  overlay: RenderTextOverlay;
  ratio: RenderRatio;
  textFilePath: string;
}) {
  const text = params.overlay.text.trim();

  if (!text) {
    return null;
  }

  const textLayout = buildTextOverlayLayout(
    text,
    params.overlay.style,
    params.ratio,
  );

  return {
    ...textLayout,
    position: params.overlay.position,
    style: params.overlay.style,
    textFilePath: params.textFilePath,
  };
}

function buildTextOverlayLayout(
  text: string,
  style: TextOverlayStyle,
  ratio: RenderRatio,
) {
  const { height, width } = renderDimensions[ratio];
  const baseFontSize = style === "bubble" ? 62 : style === "minimal" ? 64 : 68;
  const minFontSize = style === "bubble" ? 38 : style === "minimal" ? 40 : 42;
  const maxTextWidth = Math.round(width * 0.84);
  const maxTextHeight = Math.round(height * (ratio === "16:9" ? 0.42 : 0.34));
  const lineSpacing = style === "bubble" ? 10 : 8;
  const averageCharacterWidthFactor = style === "bubble" ? 0.58 : 0.55;

  for (
    let fontSize = baseFontSize;
    fontSize >= minFontSize;
    fontSize -= 2
  ) {
    const maxCharactersPerLine = getMaxCharactersPerLine({
      averageCharacterWidthFactor,
      fontSize,
      maxTextWidth,
    });
    const lines = wrapText(text, maxCharactersPerLine);
    const estimatedTextHeight =
      lines.length * fontSize + Math.max(0, lines.length - 1) * lineSpacing;

    if (estimatedTextHeight <= maxTextHeight) {
      return {
        boxBorderWidth: getBoxBorderWidth(fontSize, style),
        fontSize,
        text: lines.join("\n"),
      };
    }
  }

  const maxCharactersPerLine = getMaxCharactersPerLine({
    averageCharacterWidthFactor,
    fontSize: minFontSize,
    maxTextWidth,
  });

  return {
    boxBorderWidth: getBoxBorderWidth(minFontSize, style),
    fontSize: minFontSize,
    text: wrapText(text, maxCharactersPerLine).join("\n"),
  };
}

function getMaxCharactersPerLine(params: {
  averageCharacterWidthFactor: number;
  fontSize: number;
  maxTextWidth: number;
}) {
  return Math.max(
    10,
    Math.floor(
      params.maxTextWidth /
        (params.fontSize * params.averageCharacterWidthFactor),
    ),
  );
}

function wrapText(text: string, maxCharactersPerLine: number) {
  const manualLines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .split("\n");

  const lines = manualLines.flatMap((line) =>
    wrapManualLine(line, maxCharactersPerLine),
  );

  return lines.length > 0 ? lines : [text];
}

function wrapManualLine(line: string, maxCharactersPerLine: number) {
  const normalizedLine = line.replace(/[^\S\n]+/g, " ").trim();

  if (!normalizedLine) {
    return [""];
  }

  const words = normalizedLine
    .split(" ")
    .flatMap((word) => splitLongWord(word, maxCharactersPerLine));
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidateLine = currentLine ? `${currentLine} ${word}` : word;

    if (candidateLine.length <= maxCharactersPerLine) {
      currentLine = candidateLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [normalizedLine];
}

function splitLongWord(word: string, maxCharactersPerLine: number) {
  if (word.length <= maxCharactersPerLine) {
    return [word];
  }

  const chunks: string[] = [];

  for (let index = 0; index < word.length; index += maxCharactersPerLine) {
    chunks.push(word.slice(index, index + maxCharactersPerLine));
  }

  return chunks;
}

function getBoxBorderWidth(fontSize: number, style: TextOverlayStyle) {
  if (style === "clean") {
    return 0;
  }

  return style === "bubble"
    ? Math.max(18, Math.round(fontSize * 0.45))
    : Math.max(12, Math.round(fontSize * 0.3));
}

function getDrawTextYExpression(position: TextOverlayPosition) {
  if (position === "top") {
    return "h*0.12";
  }

  if (position === "middle") {
    return "(h-text_h)/2";
  }

  return "h-text_h-h*0.12";
}

function getFontPath() {
  if (process.platform === "win32") {
    return join(
      process.cwd(),
      "node_modules",
      "geist",
      "dist",
      "fonts",
      "geist-sans",
      "Geist-SemiBold.ttf",
    );
  }

  return "/usr/local/share/fonts/geist/Geist-SemiBold.ttf";
}

function escapeDrawText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/%/g, "\\%");
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
