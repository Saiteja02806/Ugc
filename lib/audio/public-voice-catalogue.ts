import "server-only";
import { resolveAudioAccount, type AudioVoice } from "../../worker/src/lib/audio-contract.ts";
import { toAudioVoice } from "../../worker/src/lib/elevenlabs-audio.ts";

const PUBLIC_VOICES_URL = "https://api.elevenlabs.io/v1/voices";
const CACHE_MS = 15 * 60 * 1000;
const FAILURE_CACHE_MS = 60 * 1000;
const publicAccount = resolveAudioAccount({ tier: "free", status: "active" });

function publicPreview(value: unknown, voiceId: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.hostname === "storage.googleapis.com" && url.pathname.startsWith(`/eleven-public-prod/premade/voices/${voiceId}/`)) return url.toString();
    if (["api.elevenlabs.io", "api.us.elevenlabs.io"].includes(url.hostname) && url.pathname === `/v1/voices/${voiceId}/previews/audio`) return url.toString();
  } catch {}
  return null;
}

/** Read-only provider demos. These records never authorize speech generation. */
export class PublicElevenLabsCatalogue {
  private cached: { expires: number; voices: AudioVoice[] } | null = null;
  private loading: Promise<AudioVoice[]> | null = null;

  constructor(private readonly fetcher: typeof fetch = fetch, private readonly now: () => number = Date.now) {}

  async voices(): Promise<AudioVoice[]> {
    if (this.cached && this.cached.expires > this.now()) return this.cached.voices;
    if (this.loading) return this.loading;
    this.loading = this.load();
    try { return await this.loading; } finally { this.loading = null; }
  }

  private async load(): Promise<AudioVoice[]> {
    try {
      // Deliberately never read or forward ELEVENLABS_API_KEY. The public v1
      // endpoint currently exposes premade demos without authentication.
      const response = await this.fetcher(PUBLIC_VOICES_URL, { method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Public demos unavailable");
      const value: unknown = await response.json();
      const records = value && typeof value === "object" ? (value as { voices?: unknown }).voices : null;
      if (!Array.isArray(records)) throw new Error("Public demos unavailable");
      const voices: AudioVoice[] = [];
      const ids = new Set<string>();
      for (const record of records.slice(0, 100)) {
        if (!record || typeof record !== "object") continue;
        const voice = record as Record<string, unknown>;
        // Never include community records, workspace clones, or retired demos
        // if the provider changes the anonymous endpoint's response shape.
        if (voice.category !== "premade" || voice.is_legacy === true || voice.sharing || typeof voice.voice_id !== "string" || !/^[\w-]{1,100}$/.test(voice.voice_id) || typeof voice.name !== "string" || !voice.name.trim() || ids.has(voice.voice_id)) continue;
        const item = toAudioVoice({ ...voice, voice_id: voice.voice_id, name: voice.name.slice(0, 100) }, publicAccount);
        if (!item.available) continue;
        item.previewUrl = publicPreview(voice.preview_url, voice.voice_id);
        item.description = item.description.slice(0, 1000);
        item.available = false;
        voices.push(item); ids.add(item.id);
      }
      this.cached = { expires: this.now() + CACHE_MS, voices };
      return voices;
    } catch {
      // A public catalogue outage must not break the workspace or advertise
      // stale provider IDs as available voices.
      this.cached = { expires: this.now() + FAILURE_CACHE_MS, voices: [] };
      return [];
    }
  }
}

export const publicElevenLabsCatalogue = new PublicElevenLabsCatalogue();
