import { withReadDeadline } from "../http/read-deadline.ts";

const extensions: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/mp4": "m4a" };

/** Read-only approved track loading for playback or an explicit export.
 * Downloading it never uploads audio or submits a render. */
export async function loadWorkflowDefaultMusic(deps: {
  token: () => Promise<string | null>; fetch: typeof fetch; assertActive: () => void; timeoutMs?: number;
}) {
  return withReadDeadline(async signal => {
    deps.assertActive();
    const token = await deps.token();
    signal.throwIfAborted();
    if (!token) throw new Error("Sign in before adding background music.");
    deps.assertActive();
    const { fetch: send } = deps;
    const response = await send("/api/explore/default-music", { method: "GET", cache: "no-store", signal, headers: { Authorization: `Bearer ${token}` } });
    signal.throwIfAborted();
    deps.assertActive();
    if (!response.ok) {
      const value = await response.json().catch(() => null);
      signal.throwIfAborted();
      throw new Error(typeof value?.error === "string" ? value.error : "Default background music is unavailable. Turn it off to keep original sound.");
    }
    const type = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
    if (!extensions[type]) throw new Error("The approved music file could not be verified.");
    const blob = await response.blob();
    signal.throwIfAborted();
    deps.assertActive();
    if (!blob.size || blob.size > 25 * 1024 ** 2) throw new Error("The approved music file exceeds the upload limit.");
    const loopable = response.headers.get("X-Explore-Music-Loopable");
    if (loopable !== "true" && loopable !== "false") throw new Error("The approved music playback setting could not be verified.");
    return { file: new File([blob], `default-background.${extensions[type]}`, { type }), playback: loopable === "true" ? "repeat" as const : "once" as const };
  }, undefined, deps.timeoutMs ?? 30_000);
}
