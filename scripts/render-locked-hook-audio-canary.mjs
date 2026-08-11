import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

import { renderScheduleCombinationToBuffer } from "../worker/dist/lib/render-engine.js";

const LOCKED_HOOK_VIDEO_ID = "f8493ecd-9ce1-4918-9c36-94d740382321";
const CANARY_USER_ID = "hook-v6-locked-canary";
const execute = process.argv.includes("--execute");
const confirmed = process.argv.includes("--yes");
const referenceOverlay = process.argv.includes("--reference-overlay");
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

if (!execute) {
  console.log(
    "Dry run: this renders the saved synthetic v6 Hook with its Locked EWW audio. Add --execute --yes to run it.",
  );
  process.exit(0);
}

if (!confirmed) {
  throw new Error("Refusing to render the canary without --yes.");
}

const supabaseUrl =
  process.env.SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey || !ffmpegPath || !ffprobeStatic.path) {
  throw new Error("Supabase, ffmpeg, and ffprobe are required for the render canary.");
}

process.env.FFMPEG_PATH = ffmpegPath;
process.env.FFPROBE_PATH = ffprobeStatic.path;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const [videoResult, lockResult, suggestionResult] = await Promise.all([
  supabase
    .from("avatar_assets")
    .select("id,name,source_video_url,duration_seconds,ratio,status,has_audio,hook_format_id")
    .eq("id", LOCKED_HOOK_VIDEO_ID)
    .single(),
  supabase
    .from("hook_video_audio_locks")
    .select("audio_asset_id")
    .eq("hook_video_id", LOCKED_HOOK_VIDEO_ID)
    .single(),
  supabase
    .from("hook_video_suggestions")
    .select("id,text,opening_lines,prompt_version")
    .eq("user_id", CANARY_USER_ID)
    .eq("influencer_video_id", LOCKED_HOOK_VIDEO_ID)
    .eq("prompt_version", "trending-hook-copy-v6")
    .order("created_at", { ascending: false })
    .limit(1)
    .single(),
]);

if (videoResult.error || !videoResult.data) {
  throw new Error(`Could not load the Locked Hook video: ${videoResult.error?.message}`);
}
if (lockResult.error || !lockResult.data) {
  throw new Error(`Could not load the Locked Hook mapping: ${lockResult.error?.message}`);
}
if (suggestionResult.error || !suggestionResult.data) {
  throw new Error(
    `Run test-locked-hook-v6-canary.mjs first so a validated v6 Hook is available: ${suggestionResult.error?.message ?? "no matching suggestion"}`,
  );
}

const { data: audio, error: audioError } = await supabase
  .from("hook_audio_assets")
  .select("id,source_file_name,audio_url,duration_seconds,status,review_status")
  .eq("id", lockResult.data.audio_asset_id)
  .single();

if (audioError || !audio) {
  throw new Error(`Could not load EWW audio: ${audioError?.message}`);
}

const video = videoResult.data;
const suggestion = suggestionResult.data;
const durationSeconds = Number(video.duration_seconds);
const savedLines = Array.isArray(suggestion.opening_lines)
  ? suggestion.opening_lines.map(String)
  : [];
const lines = referenceOverlay
  ? ["Meal logging", "shouldn't interrupt", "your whole day 😩"]
  : savedLines;
const hookText = lines.join(" ");

if (
  video.status !== "ready" ||
  video.ratio !== "9:16" ||
  video.has_audio !== false ||
  audio.status !== "active" ||
  audio.review_status !== "approved" ||
  audio.source_file_name !== "EWW.mp3" ||
  !Number.isFinite(durationSeconds) ||
  durationSeconds <= 0 ||
  lines.length < 1 ||
  lines.length > 3
) {
  throw new Error("The Locked render canary inputs are no longer valid.");
}

const renderId = randomUUID();
const renderedBuffer = await renderScheduleCombinationToBuffer({
  autoFinalize: false,
  compositionFingerprint: `locked-hook-audio-canary:${renderId}`,
  demoVideoId: `${video.id}:demo-canary`,
  demoVideoUrl: video.source_video_url,
  hookAudio: {
    audioAssetId: audio.id,
    audioUrl: audio.audio_url,
    durationSeconds: Number(audio.duration_seconds),
    selectionSource: "video_locked",
  },
  hookText,
  hookTextFontSize: null,
  hookTextLines: lines,
  hookTextPosition: null,
  hookTextColor: "#ffffff",
  hookTrimEnd: durationSeconds,
  hookTrimStart: 0,
  hookVideoId: video.id,
  hookVideoUrl: video.source_video_url,
  projectId: "hook-v6-locked-canary",
  ratio: "9:16",
  renderId,
  scheduleId: "locked-hook-audio-canary",
  title: "Locked Hook EWW render canary",
  userId: CANARY_USER_ID,
});

const artifactDirectory = path.resolve("artifacts", "hook-audio-canary");
const outputPath = path.join(
  artifactDirectory,
  referenceOverlay
    ? "creator-022-three-line-emoji-reference-canary.mp4"
    : "creator-022-confusion-skepticism-EWW-v6-canary.mp4",
);
const workDirectory = await mkdtemp(path.join(tmpdir(), "hook-audio-proof-"));
const audioPath = path.join(workDirectory, "EWW.mp3");

try {
  await mkdir(artifactDirectory, { recursive: true });
  await writeFile(outputPath, renderedBuffer);
  const response = await fetch(audio.audio_url);
  if (!response.ok) {
    throw new Error(`Could not download EWW proof audio: ${response.status}`);
  }
  await writeFile(audioPath, Buffer.from(await response.arrayBuffer()));

  const probe = JSON.parse(
    await runProcess(ffprobeStatic.path, [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_name,codec_type",
      "-of",
      "json",
      outputPath,
    ]),
  );
  const audioStream = probe.streams?.find((stream) => stream.codec_type === "audio");

  if (!audioStream?.codec_name) {
    throw new Error("The rendered canary has no playable audio stream.");
  }

  const [renderedPcm, sourcePcm] = await Promise.all([
    extractPcm(outputPath, durationSeconds),
    extractPcm(audioPath, durationSeconds),
  ]);
  const renderedEnvelope = buildRmsEnvelope(renderedPcm);
  const sourceEnvelope = buildRmsEnvelope(sourcePcm);
  const waveformCorrelation = bestEnvelopeCorrelation(
    renderedEnvelope,
    sourceEnvelope,
  );
  const renderedRms = totalRms(renderedPcm);

  if (renderedRms < 0.0001 || waveformCorrelation < 0.55) {
    throw new Error(
      `Rendered Hook audio did not match EWW strongly enough (RMS ${renderedRms.toFixed(6)}, correlation ${waveformCorrelation.toFixed(3)}).`,
    );
  }

  console.log(
    JSON.stringify(
      {
        audioAssetId: audio.id,
        audioCodec: audioStream.codec_name,
        audioFile: audio.source_file_name,
        hookTextLines: lines,
        outputPath,
        renderedRms: Number(renderedRms.toFixed(6)),
        testedVideoId: video.id,
        threeLineLimitSatisfied: lines.length <= 3,
        waveformCorrelation: Number(waveformCorrelation.toFixed(3)),
      },
      null,
      2,
    ),
  );
} finally {
  await rm(workDirectory, { force: true, recursive: true });
}

async function extractPcm(inputPath, duration) {
  const stdout = await runProcessBuffer(ffmpegPath, [
    "-v",
    "error",
    "-i",
    inputPath,
    "-t",
    duration.toFixed(3),
    "-map",
    "0:a:0",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "f32le",
    "pipe:1",
  ]);
  return new Float32Array(
    stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.byteLength),
  );
}

function buildRmsEnvelope(samples) {
  const windowSize = 800;
  const values = [];
  for (let offset = 0; offset + windowSize <= samples.length; offset += windowSize) {
    let sum = 0;
    for (let index = offset; index < offset + windowSize; index += 1) {
      sum += samples[index] * samples[index];
    }
    values.push(Math.sqrt(sum / windowSize));
  }
  return values;
}

function bestEnvelopeCorrelation(left, right) {
  let best = -1;
  for (let shift = -4; shift <= 4; shift += 1) {
    const leftStart = Math.max(0, shift);
    const rightStart = Math.max(0, -shift);
    const count = Math.min(left.length - leftStart, right.length - rightStart);
    if (count < 8) continue;
    best = Math.max(
      best,
      pearson(left.slice(leftStart, leftStart + count), right.slice(rightStart, rightStart + count)),
    );
  }
  return best;
}

function pearson(left, right) {
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquare += leftDelta * leftDelta;
    rightSquare += rightDelta * rightDelta;
  }
  return numerator / Math.sqrt(leftSquare * rightSquare || 1);
}

function totalRms(samples) {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / Math.max(samples.length, 1));
}

function runProcess(command, args) {
  return runProcessBuffer(command, args).then((buffer) => buffer.toString("utf8"));
}

function runProcessBuffer(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }
      reject(new Error(Buffer.concat(stderr).toString("utf8").trim()));
    });
  });
}
