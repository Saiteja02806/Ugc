import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import sharp from "sharp";

import {
  buildWallAudioIntent,
  getWallAudioFitMode,
  selectWallAudio,
} from "../lib/trending/wall-audio-matcher.ts";
import {
  buildWallTextVideoArgs,
  ensureWallTextFontsRegistered,
} from "../worker/dist/lib/render-engine.js";
import { buildWallTextOverlaySvg } from "../worker/dist/lib/wall-text-render-spec.js";

const DEFAULT_LIBRARY_ROOT = "D:\\walloftext_sound\\wall_audio_library_v2";
const DEFAULT_BACKGROUND =
  "C:\\Users\\chund\\OneDrive\\Desktop\\videos_real\\sound\\Avatar_reaction_video_bathroom_s_202608051523-Vmake.mp4";
const args = parseArgs(process.argv.slice(2));
const libraryRoot = path.resolve(
  String(args.library || DEFAULT_LIBRARY_ROOT),
);
const backgroundPath = path.resolve(
  String(args.background || DEFAULT_BACKGROUND),
);
const outputRoot = path.resolve(
  String(args.output || ".tmp/wall-audio-poc/renders"),
);
const manifest = JSON.parse(
  readFileSync(
    path.join(libraryRoot, "metadata", "wall_audio_assets.json"),
    "utf8",
  ),
);
const activeAssets = manifest.assets
  .filter(
    (asset) =>
      asset.status === "active" && asset.reviewStatus === "approved",
  )
  .map((asset) => ({
    audioUrl: path.join(libraryRoot, asset.storagePath),
    cueStartSeconds: asset.cueStartSeconds,
    durationSeconds: asset.durationSeconds,
    energy: asset.energy,
    id: asset.id,
    loopable: asset.loopable,
    messageTypes: asset.messageTypes,
    moods: asset.moods,
    reviewStatus: "approved",
    status: "active",
  }));

const scenarios = [
  {
    allowedAssetIds: activeAssets.map((asset) => asset.id),
    content: {
      fullText:
        "Track every small choice because the details shape the real result. Review the pattern, then improve one thing.",
      segments: [
        { lines: ["Track every small choice"], role: "lead" },
        {
          lines: ["because the details", "shape the real result."],
          role: "support",
        },
        {
          lines: ["Review the pattern,", "then improve one thing."],
          role: "closing",
        },
      ],
    },
    durationSeconds: 5,
    expectedFitMode: "trim",
    name: "wall-audio-5s-trim",
    pattern: "action_benefit",
  },
  {
    allowedAssetIds: ["audio_013"],
    content: {
      fullText:
        "I tracked the obvious steps but missed the quiet habits. Those small details explained why the result kept changing.",
      segments: [
        { lines: ["I tracked the obvious steps"], role: "lead" },
        {
          lines: ["but missed", "the quiet habits."],
          role: "support",
        },
        {
          lines: ["Those small details explained", "why the result", "kept changing."],
          role: "closing",
        },
      ],
    },
    durationSeconds: 7,
    expectedFitMode: "exact",
    name: "wall-audio-7s-exact",
    pattern: "situation_discovery",
  },
  {
    allowedAssetIds: ["audio_014"],
    content: {
      fullText:
        "Before, I guessed what mattered and changed everything at once. After tracking the pattern, one clear adjustment made progress easier.",
      segments: [
        { lines: ["Before, I guessed", "what mattered"], role: "lead" },
        {
          lines: ["and changed everything", "at once."],
          role: "support",
        },
        {
          lines: ["After tracking the pattern,", "one clear adjustment", "made progress easier."],
          role: "closing",
        },
      ],
    },
    durationSeconds: 10,
    expectedFitMode: "loop",
    name: "wall-audio-10s-loop",
    pattern: "before_after",
  },
  {
    allowedAssetIds: ["audio_017_segment_01"],
    content: {
      fullText:
        "I thought one good week showed the full pattern. A longer view revealed what kept changing and made the next adjustment clearer.",
      segments: [
        {
          lines: ["I thought one good week", "showed the full pattern."],
          role: "lead",
        },
        {
          lines: ["A longer view revealed", "what kept changing"],
          role: "support",
        },
        {
          lines: ["and made the next", "adjustment clearer."],
          role: "closing",
        },
      ],
    },
    durationSeconds: 12,
    expectedFitMode: "trim",
    name: "wall-audio-12s-long-track-trim",
    pattern: "situation_discovery",
  },
];

mkdirSync(outputRoot, { recursive: true });
await ensureWallTextFontsRegistered();

const sourceProbe = probeMedia(backgroundPath);
const report = {
  backgroundPath,
  generatedAt: new Date().toISOString(),
  librarySchemaVersion: manifest.schemaVersion,
  renders: [],
  sourceHasAudio: sourceProbe.streams.some(
    (stream) => stream.codec_type === "audio",
  ),
};

for (const scenario of scenarios) {
  console.log(`Rendering ${scenario.name}...`);
  const candidates = activeAssets.filter((asset) =>
    scenario.allowedAssetIds.includes(asset.id),
  );
  const selection = selectWallAudio({
    assets: candidates,
    intent: buildWallAudioIntent({ pattern: scenario.pattern }),
    videoDurationSeconds: scenario.durationSeconds,
  });
  if (!selection || selection.fitMode !== scenario.expectedFitMode) {
    throw new Error(`${scenario.name} did not produce the expected fit mode.`);
  }

  const asset = candidates.find(
    (candidate) => candidate.id === selection.audioAssetId,
  );
  if (
    !asset ||
    getWallAudioFitMode(asset, scenario.durationSeconds) !==
      scenario.expectedFitMode
  ) {
    throw new Error(`${scenario.name} failed duration validation.`);
  }

  const preparedBackgroundPath = path.join(
    outputRoot,
    `${scenario.name}-background.mp4`,
  );
  const overlayPath = path.join(outputRoot, `${scenario.name}-overlay.png`);
  const outputPath = path.join(outputRoot, `${scenario.name}.mp4`);
  prepareBackground(
    backgroundPath,
    preparedBackgroundPath,
    scenario.durationSeconds,
  );
  const textBox = {
    height: 480 / 1920,
    width: 660 / 1080,
    x: 210 / 1080,
    y: 660 / 1920,
  };
  const overlaySvg = buildWallTextOverlaySvg({
    content: scenario.content,
    placement: "middle",
    safeArea: {
      bottom: 460 / 1920,
      left: 120 / 1080,
      right: 200 / 1080,
      top: 280 / 1920,
    },
    textBox,
  });
  await sharp(Buffer.from(overlaySvg))
    .png({ compressionLevel: 9 })
    .toFile(overlayPath);

  const renderPayload = {
    audio: {
      assetDurationSeconds: selection.audioAssetDurationSeconds,
      assetId: selection.audioAssetId,
      audioUrl: "https://poc.invalid/audio.mp3",
      cueStartSeconds: selection.cueStartSeconds,
      fadeOutSeconds: selection.fadeOutSeconds,
      fitMode: selection.fitMode,
      matchingVersion: selection.matchingVersion,
      selectionId: `poc-${scenario.name}`,
    },
    durationSeconds: scenario.durationSeconds,
  };
  const ffmpegArgs = buildWallTextVideoArgs({
    audioPath: asset.audioUrl,
    inputPath: preparedBackgroundPath,
    outputPath,
    overlayPath,
    payload: renderPayload,
  });
  execFileSync(ffmpegPath, ffmpegArgs, { stdio: "pipe" });

  const outputProbe = probeMedia(outputPath);
  const formatDuration = Number(outputProbe.format.duration);
  const videoStream = outputProbe.streams.find(
    (stream) => stream.codec_type === "video",
  );
  const audioStream = outputProbe.streams.find(
    (stream) => stream.codec_type === "audio",
  );
  if (
    !videoStream ||
    !audioStream ||
    videoStream.width !== 1080 ||
    videoStream.height !== 1920 ||
    Math.abs(formatDuration - scenario.durationSeconds) > 0.08
  ) {
    throw new Error(`${scenario.name} output verification failed.`);
  }

  report.renders.push({
    audioAssetDurationSeconds: selection.audioAssetDurationSeconds,
    audioAssetId: selection.audioAssetId,
    audioCodec: audioStream.codec_name,
    durationSeconds: formatDuration,
    expectedDurationSeconds: scenario.durationSeconds,
    fitMode: selection.fitMode,
    outputPath,
    videoCodec: videoStream.codec_name,
    videoHeight: videoStream.height,
    videoWidth: videoStream.width,
  });
}

const reportPath = path.join(outputRoot, "proof-report.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Proof renders complete: ${report.renders.length}`);
console.log(`Source background had audio: ${report.sourceHasAudio}`);
console.log(`Report: ${reportPath}`);

function prepareBackground(sourcePath, outputPath, durationSeconds) {
  execFileSync(
    ffmpegPath,
    [
      "-y",
      "-stream_loop",
      "-1",
      "-i",
      sourcePath,
      "-t",
      durationSeconds.toFixed(3),
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { stdio: "pipe" },
  );
}

function probeMedia(filePath) {
  return JSON.parse(
    execFileSync(
      ffprobeStatic.path,
      [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        filePath,
      ],
      { encoding: "utf8" },
    ),
  );
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
