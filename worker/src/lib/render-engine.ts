import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";

import { getStorageProviderName, uploadBufferToS3 } from "./s3.js";
import { downloadVideoToBuffer } from "./download-video.js";
import {
  EDIT_OVERLAY_FONT_FAMILY,
  EDIT_OVERLAY_OUTPUT_DIMENSIONS,
  EDIT_OVERLAY_SHADOW_COLOR,
  EDIT_OVERLAY_SHADOW_OFFSET_PX,
  EDIT_OVERLAY_VERTICAL_INSET_PERCENT,
  buildEditOverlayTextLayout,
  type EditOverlayTextLayout,
} from "./edit-overlay-render-spec.js";
import { logger } from "../logger.js";

export type RenderRatio = "9:16" | "1:1" | "4:5" | "16:9";
export type TextOverlayPosition = "top" | "middle" | "bottom";
export type TextOverlayStyle = "clean" | "minimal" | "bubble";
export type PreparedTextOverlay = {
  imagePath: string;
  layout: EditOverlayTextLayout;
  position: TextOverlayPosition;
  style: TextOverlayStyle;
};

type RenderTextOverlay = {
  id: string;
  position: TextOverlayPosition;
  style: TextOverlayStyle;
  text: string;
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

const OUTPUT_CONTENT_TYPE = "video/mp4";
const MAX_FFMPEG_LOG_LENGTH = 8_000;
const renderDimensions = EDIT_OVERLAY_OUTPUT_DIMENSIONS;

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
  const hookOverlay = buildPreparedTextOverlay({
    imagePath: join(workDir, "hook-overlay.png"),
    overlay: {
      id: "hook-text",
      position: "bottom",
      style: "minimal",
      text: payload.hookText,
    },
    ratio: payload.ratio,
  });

  try {
    const [hookBuffer, demoBuffer] = await Promise.all([
      downloadVideoToBuffer(payload.hookVideoUrl),
      downloadVideoToBuffer(payload.demoVideoUrl),
    ]);

    await Promise.all([
      writeFile(hookInputPath, hookBuffer),
      writeFile(demoInputPath, demoBuffer),
      ...(hookOverlay ? [renderPreparedTextOverlayImage(hookOverlay)] : []),
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
      preparedTextOverlay: hookOverlay,
      segmentLabel: "hook",
    });
    await normalizeCombinationSegment({
      inputPath: demoInputPath,
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

    const renderedBuffer = await readFile(outputPath);
    const key = buildScheduleCombinationVideoKey(payload);
    const result = await uploadBufferToS3({
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
  preparedTextOverlay,
  segmentLabel,
}: {
  inputPath: string;
  outputPath: string;
  payload: RenderScheduleCombinationPayload;
  preparedTextOverlay: PreparedTextOverlay | null;
  segmentLabel: "demo" | "hook";
}) {
  const hasAudio = await inputHasAudio(inputPath);
  const args = buildScheduleCombinationSegmentArgs({
    hasAudio,
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

export function buildScheduleCombinationSegmentArgs({
  hasAudio,
  inputPath,
  outputPath,
  payload,
  preparedTextOverlay,
  segmentLabel,
}: {
  hasAudio: boolean;
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

  const silentAudioInputIndex = preparedTextOverlay ? 2 : 1;

  if (!hasAudio) {
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
    hasAudio ? "0:a:0" : `${silentAudioInputIndex}:a:0`,
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
}) {
  const text = params.overlay.text.trim();

  if (!text) {
    return null;
  }

  const layout = buildEditOverlayTextLayout(
    text,
    params.overlay.style,
    params.ratio,
  );

  return {
    imagePath: params.imagePath,
    layout,
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
  const { layout, position, style } = preparedTextOverlay;
  const {
    canvasHeight,
    canvasWidth,
    containerHeight,
    containerWidth,
    containerX,
  } = layout.bounds;
  const containerY = getOverlayContainerY(layout, position);
  const textTop = containerY + layout.padding;
  const centerX = canvasWidth / 2;
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

    return [
      `<text x="${centerX + EDIT_OVERLAY_SHADOW_OFFSET_PX}" y="${baselineY + EDIT_OVERLAY_SHADOW_OFFSET_PX}" ${commonAttributes} fill="${escapeXml(EDIT_OVERLAY_SHADOW_COLOR)}">${escapedLine}</text>`,
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
) {
  const { canvasHeight, containerHeight } = layout.bounds;
  const verticalInset = Math.round(
    canvasHeight * (EDIT_OVERLAY_VERTICAL_INSET_PERCENT / 100),
  );

  if (position === "top") {
    return verticalInset;
  }

  if (position === "middle") {
    return Math.round((canvasHeight - containerHeight) / 2);
  }

  return canvasHeight - verticalInset - containerHeight;
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
