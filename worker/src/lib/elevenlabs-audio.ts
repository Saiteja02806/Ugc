import { AUDIO_MODEL_IDS, AudioError, isVoiceEligible, resolveAudioAccount, type AudioAccount, type AudioModel, type AudioVoice } from "./audio-contract.ts";

const BASE = "https://api.elevenlabs.io";
type VoiceRecord = Record<string, unknown> & { voice_id: string; name: string };
/** Server runtimes only. Never import credential access into client components. */
export function getElevenLabsApiKey(environment: Readonly<Record<string, string | undefined>> = process.env): string {
  return environment.ELEVENLABS_VOICE_API_KEY?.trim() || environment.ELEVENLABS_API_KEY?.trim() || environment.elevenlabs_api_key?.trim() || "";
}
export class ElevenLabsError extends AudioError {
  constructor(message: string, status: number, public readonly uncertain = false) { super(message, status, "elevenlabs_error"); }
}
export class ElevenLabsAudio {
  constructor(private readonly key = getElevenLabsApiKey(), private readonly fetcher: typeof fetch = fetch) {}
  async request(path: string, init: RequestInit = {}, timeout = 20000) {
    if (!this.key) throw new AudioError("Audio generation has not been connected yet.", 503, "audio_not_configured");
    let response: Response;
    try { response = await this.fetcher(`${BASE}${path}`, { ...init, redirect: "error", signal: AbortSignal.timeout(timeout), headers: { ...init.headers, "xi-api-key": this.key } }); }
    catch { throw new ElevenLabsError("ElevenLabs could not be reached. Check the generation history before trying again.", 503, init.method === "POST"); }
    if (!response.ok) {
      // Never surface provider payloads, scripts, request headers or credentials.
      const message = response.status === 401 ? "The ElevenLabs API key is invalid." : response.status === 403 ? "This voice or feature is unavailable on the ElevenLabs account." : response.status === 429 ? "ElevenLabs is busy or its allowance has been reached. Try again later." : response.status === 402 ? "The ElevenLabs allowance has been reached." : "ElevenLabs could not complete this request.";
      throw new ElevenLabsError(message, response.status >= 500 ? 503 : response.status, init.method === "POST" && response.status >= 500);
    }
    return response;
  }
  async account(): Promise<AudioAccount> { return resolveAudioAccount(await (await this.request("/v1/user/subscription")).json() as Record<string, unknown>); }
  async models(): Promise<AudioModel[]> {
    const models = await (await this.request("/v1/models")).json() as Array<Record<string, unknown>>;
    return models.filter(m => m.can_do_text_to_speech === true && (AUDIO_MODEL_IDS as readonly unknown[]).includes(m.model_id)).map(m => ({ id: String(m.model_id), name: String(m.name), languages: Array.isArray(m.languages) ? m.languages.map(l => String((l as Record<string, unknown>).language_id)) : [] }));
  }
  async voices(voiceType?: string): Promise<VoiceRecord[]> {
    const voices: VoiceRecord[] = []; let token = ""; const seen = new Set<string>();
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({ page_size: "100", include_custom_rates: "false", include_live_moderated: "false" });
      if (voiceType) params.set("voice_type", voiceType);
      if (token) params.set("next_page_token", token);
      const data = await (await this.request(`/v2/voices?${params}`)).json() as { voices: VoiceRecord[]; has_more?: boolean; next_page_token?: string };
      voices.push(...data.voices);
      if (!data.has_more) return voices;
      if (!data.next_page_token || seen.has(data.next_page_token)) throw new AudioError("The voice catalogue could not be loaded completely.", 503);
      token = data.next_page_token; seen.add(token);
    }
    throw new AudioError("The voice catalogue is too large. Configure a smaller approved selection.", 503);
  }
  async voice(id: string) { return await (await this.request(`/v1/voices/${encodeURIComponent(id)}`)).json() as VoiceRecord; }
  async speech(input: { script: string; voiceId: string; modelId: string; speed: number }) {
    return this.request(`/v1/text-to-speech/${encodeURIComponent(input.voiceId)}/stream?output_format=mp3_44100_128`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input.script, model_id: input.modelId, voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: input.speed } }) }, 120000);
  }
  async clone(name: string, audio: Blob) {
    const form = new FormData(); form.append("name", name); form.append("files", audio, "reference.mp3");
    return await (await this.request("/v1/voices/add", { method: "POST", body: form }, 120000)).json() as { voice_id: string; requires_verification?: boolean };
  }
  async deleteVoice(id: string) { await this.request(`/v1/voices/${encodeURIComponent(id)}`, { method: "DELETE" }); }
}
export function toAudioVoice(record: VoiceRecord, account: AudioAccount, privateVoice = false): AudioVoice {
  const labels: Record<string, string> = {};
  for (const [key, value] of Object.entries(record.labels as Record<string, unknown> ?? {})) if (typeof value === "string") labels[key] = value;
  let previewUrl: string | null = null;
  try { const url = new URL(String(record.preview_url)); if (url.protocol === "https:") previewUrl = url.toString(); } catch {}
  return { id: record.voice_id, name: record.name, description: typeof record.description === "string" ? record.description : "", previewUrl: privateVoice ? null : previewUrl, labels, category: String(record.category), private: privateVoice, available: isVoiceEligible(record, account) };
}
