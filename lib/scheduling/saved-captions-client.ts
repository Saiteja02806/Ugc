import { getCurrentUserIdToken } from "../firebase/auth";
import { withReadDeadline } from "../http/read-deadline";
import { parseSavedCaptionLibrary, type SavedCaptionLibrary } from "./saved-captions";

export async function requestSavedCaptions(owner: string, input?: SavedCaptionLibrary, signal?: AbortSignal): Promise<SavedCaptionLibrary> {
  return withReadDeadline(async bounded => {
    const token = await getCurrentUserIdToken(owner);
    bounded.throwIfAborted();
    if (!token) throw new Error("Sign in to save captions.");
    const response = await fetch("/api/account/saved-captions", { method: input ? "PUT" : "GET", cache: "no-store", signal: bounded,
      headers: { Authorization: `Bearer ${token}`, ...(input ? { "Content-Type": "application/json" } : {}) }, ...(input ? { body: JSON.stringify(input) } : {}) });
    const body = await response.json();
    if (!response.ok || body?.ok !== true) throw new Error(typeof body?.message === "string" ? body.message : "Could not load saved captions.");
    return parseSavedCaptionLibrary(body.library);
  }, signal);
}
