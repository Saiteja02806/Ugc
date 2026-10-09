import { getCurrentUserIdToken } from "@/lib/firebase/auth";

export class AudioClientError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export type AudioApi = <T>(path: string, init?: RequestInit) => Promise<T>;

/** Wait for Firebase restoration; never send a missing token or switch owners. */
export function createAudioFetch(userId: string | undefined) {
  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (!userId) throw new AudioClientError("Your session is still loading. Try again shortly.", 401);
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await getCurrentUserIdToken(userId, attempt === 1);
      init.signal?.throwIfAborted();
      if (!token) throw new AudioClientError("Your session could not be restored. Reload and try again.", 401);
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(path, { ...init, headers, cache: "no-store" });
      if (response.status === 401 && attempt === 0) continue;
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new AudioClientError(
        response.status === 401 ? "Your session could not be restored. Reload and try again." : result?.error || "Audio could not be loaded. Try again.", response.status,
        );
      }
      return response;
    }
    throw new AudioClientError("Your session could not be restored. Reload and try again.", 401);
  };
}
export function createAudioApi(userId: string | undefined): AudioApi {
  const audioFetch = createAudioFetch(userId);
  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const result = await (await audioFetch(path, init)).json().catch(() => null);
    if (!result) throw new AudioClientError("Audio could not be loaded. Try again.", 502);
    return result as T;
  };
}
