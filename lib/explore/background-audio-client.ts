import type { BackgroundAudioTrack } from "./background-audio-types";

const extensions: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/mp4": "m4a" };

export async function readBackgroundAudioFile(track: BackgroundAudioTrack, token: string, signal: AbortSignal) {
  const params = new URLSearchParams({ source: track.source, id: track.id });
  const response = await fetch(`/api/explore/background-audio/file?${params}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal });
  if (!response.ok) {
    const value = await response.json().catch(() => null);
    throw new Error(typeof value?.error === "string" ? value.error : "Could not load this background track.");
  }
  const type = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  if (!extensions[type] || Number(response.headers.get("Content-Length")) > 25 * 1024 ** 2) throw new Error("This background audio file could not be verified.");
  const blob = await response.blob();
  signal.throwIfAborted();
  if (!blob.size || blob.size > 25 * 1024 ** 2) throw new Error("Choose a complete background track up to 25 MB.");
  const loopable = response.headers.get("X-Explore-Music-Loopable");
  if (loopable !== "true" && loopable !== "false") throw new Error("This track's playback setting could not be verified.");
  return { file: new File([blob], `${track.name}.${extensions[type]}`, { type }), playback: loopable === "true" ? "repeat" as const : "once" as const };
}
