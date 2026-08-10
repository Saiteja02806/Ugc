import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { buildLockedHookAudioSelection } from "../lib/trending/hook-video-audio-lock-logic.ts";

loadEnvFile(path.resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const remove = Boolean(args.remove);

if (execute && !args.yes) {
  throw new Error(
    "Refusing to change a Hook audio lock without --yes. Run the dry-run first, then add --execute --yes.",
  );
}

if (!args["video-id"] && !args["video-sha"]) {
  throw new Error("Provide --video-id or --video-sha.");
}

if (!remove && !args["audio-id"] && !args["audio-file"]) {
  throw new Error("Provide --audio-id or --audio-file.");
}

if (remove && (args["audio-id"] || args["audio-file"])) {
  throw new Error("Do not provide an audio selector together with --remove.");
}

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const video = await loadVideo();

if (remove) {
  console.log(
    JSON.stringify(
      {
        action: "remove",
        execute,
        hookFormatId: video.hook_format_id,
        hookVideoId: video.id,
        sourceSha256: video.source_file_sha256,
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log("Dry run complete. No Hook audio lock was changed.");
    process.exit(0);
  }

  const { error } = await supabase
    .from("hook_video_audio_locks")
    .delete()
    .eq("hook_video_id", video.id);
  if (error) throw new Error(`Could not remove Hook audio lock: ${error.message}`);
  console.log(`Removed the Locked audio for Hook video ${video.id}.`);
  process.exit(0);
}

const audio = await loadAudio();
const selection = buildLockedHookAudioSelection({
  audio: {
    audioUrl: audio.audio_url,
    durationSeconds: Number(audio.duration_seconds),
    id: audio.id,
    loopable: audio.loopable,
    reviewStatus: audio.review_status,
    status: audio.status,
  },
  video: {
    avatarType: video.avatar_type,
    deletedAt: video.deleted_at,
    durationSeconds:
      video.duration_seconds === null ? null : Number(video.duration_seconds),
    hasAudio: video.has_audio,
    hookFormatId: video.hook_format_id,
    id: video.id,
    sourceVideoUrl: video.source_video_url,
    status: video.status,
  },
});

await Promise.all([
  assertRemoteAssetAvailable(video.source_video_url, "Hook video"),
  assertRemoteAssetAvailable(audio.audio_url, "Hook audio"),
]);

console.log(
  JSON.stringify(
    {
      action: "upsert",
      audioFile: audio.source_file_name,
      execute,
      hookFormatId: video.hook_format_id,
      notes: normalizeNotes(args.notes),
      selection,
      sourceSha256: video.source_file_sha256,
    },
    null,
    2,
  ),
);

if (!execute) {
  console.log("Dry run complete. No Hook audio lock was changed.");
  process.exit(0);
}

const { error } = await supabase.from("hook_video_audio_locks").upsert(
  {
    audio_asset_id: audio.id,
    hook_video_id: video.id,
    notes: normalizeNotes(args.notes),
    updated_at: new Date().toISOString(),
  },
  { onConflict: "hook_video_id" },
);

if (error) {
  throw new Error(`Could not configure Hook audio lock: ${error.message}`);
}

console.log(`Locked ${audio.source_file_name} to Hook video ${video.id}.`);

async function loadVideo() {
  let query = supabase
    .from("avatar_assets")
    .select(
      "id,avatar_type,status,deleted_at,has_audio,hook_format_id,duration_seconds,source_video_url,source_file_sha256",
    );

  query = args["video-id"]
    ? query.eq("id", String(args["video-id"]).trim())
    : query.eq("source_file_sha256", normalizeSha(args["video-sha"]));

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load Hook video: ${error.message}`);
  if (!data) throw new Error("The selected Hook video was not found.");
  return data;
}

async function loadAudio() {
  let query = supabase
    .from("hook_audio_assets")
    .select(
      "id,audio_url,duration_seconds,loopable,review_status,status,source_file_name",
    );

  query = args["audio-id"]
    ? query.eq("id", String(args["audio-id"]).trim())
    : query.eq("source_file_name", String(args["audio-file"]).trim());

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load Hook audio: ${error.message}`);
  if (!data) throw new Error("The selected Hook audio was not found.");
  return data;
}

async function assertRemoteAssetAvailable(url, label) {
  const request = async (method) => {
    const response = await fetch(url, {
      headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
      method,
      signal: AbortSignal.timeout(15_000),
    });
    await response.body?.cancel();
    return response;
  };

  let response = await request("HEAD");
  if (response.status === 405) response = await request("GET");
  if (!response.ok) {
    throw new Error(`${label} is unavailable (${response.status}).`);
  }
}

function normalizeNotes(value) {
  if (value === undefined) return null;
  const notes = String(value).trim();
  if (!notes || notes.length > 1000) {
    throw new Error("--notes must contain between 1 and 1000 characters.");
  }
  return notes;
}

function normalizeSha(value) {
  const sha = String(value || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(sha)) {
    throw new Error("--video-sha must be a 64-character SHA-256 value.");
  }
  return sha;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[name] = true;
    } else {
      parsed[name] = next;
      index += 1;
    }
  }
  return parsed;
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const name = trimmed.slice(0, separator).trim();
    if (process.env[name] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[name] = value;
  }
}
