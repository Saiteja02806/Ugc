import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isTrustedStorageUrl } from "@/lib/storage/storage";
import type { BackgroundAudioSource, BackgroundAudioTrack } from "./background-audio-types";

type AudioRow = {
  id: string;
  audio_url: string;
  duration_seconds: number | string;
  moods: string[];
  energy: string;
  loopable: boolean;
};

const columns = "id,audio_url,duration_seconds,moods,energy,loopable";
const tables = { hook: "hook_audio_assets", wall: "wall_audio_assets" } as const;
const moods = new Set(["curious", "uplifting", "serious", "calm", "urgent", "playful"]);
const PAGE_SIZE = 200;
let client: ReturnType<typeof createClient> | undefined;

function getClient() {
  if (client) return client;
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Background audio database is unavailable.");
  client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}

function approvedQuery(source: BackgroundAudioSource) {
  const query = getClient().from(tables[source]).select(columns)
    .eq("status", "active").eq("review_status", "approved").eq("storage_provider", "gcp");
  // Tracks bound to a specific Instagram reference stay with that reference.
  return source === "wall" ? query.eq("selection_scope", "matcher_pool") : query;
}

function parseTrack(row: AudioRow, source: BackgroundAudioSource) {
  const durationSeconds = Number(row.duration_seconds);
  if (!/^[\w-]{1,200}$/.test(row.id) || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 600
    || typeof row.loopable !== "boolean" || !Array.isArray(row.moods) || !["low", "medium", "high"].includes(row.energy)) return null;
  let url: URL;
  try { url = new URL(row.audio_url); } catch { return null; }
  if (url.protocol !== "https:" || (url.hostname !== "storage.googleapis.com" && !url.hostname.endsWith(".storage.googleapis.com"))
    || !isTrustedStorageUrl(url.href)) return null;
  const number = row.id.match(/(?:hook_)?audio_(\d+)(?:_segment_(\d+))?$/);
  const name = number ? `${source === "hook" ? "Hook" : "Wall"} track ${Number(number[1]).toString().padStart(2, "0")}${number[2] ? ` · Segment ${Number(number[2])}` : ""}`
    : `${source === "hook" ? "Hook" : "Wall"} · ${row.id.replace(/[_-]+/g, " ")}`;
  const track: BackgroundAudioTrack = { id: row.id, source, name, durationSeconds,
    moods: row.moods.filter(mood => moods.has(mood)), energy: row.energy, loopable: row.loopable };
  return { track, audioUrl: url.href };
}

async function listSource(source: BackgroundAudioSource): Promise<BackgroundAudioTrack[]> {
  const tracks: BackgroundAudioTrack[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await approvedQuery(source).order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) throw new Error("Could not load the background audio library.");
    for (const row of data as unknown as AudioRow[]) {
      const parsed = parseTrack(row, source);
      if (parsed) tracks.push(parsed.track);
    }
    if (data.length < PAGE_SIZE) return tracks;
  }
}

export async function listBackgroundAudioTracks(): Promise<BackgroundAudioTrack[]> {
  const [hook, wall] = await Promise.all([listSource("hook"), listSource("wall")]);
  return [...hook, ...wall];
}

export async function getBackgroundAudioTrack(source: BackgroundAudioSource, id: string) {
  const { data, error } = await approvedQuery(source).eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load this background track.");
  return data ? parseTrack(data as unknown as AudioRow, source) : null;
}
