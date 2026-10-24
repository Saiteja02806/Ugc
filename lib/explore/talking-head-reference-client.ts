import { getCurrentUserIdToken } from "../firebase/auth";
import { withReadDeadline } from "../http/read-deadline";
import type { TalkingHeadReference } from "./talking-head-reference";

export async function fetchTalkingHeadReferences(signal?: AbortSignal): Promise<TalkingHeadReference[]> {
  return withReadDeadline(async bounded => {
    const token = await getCurrentUserIdToken();
    if (!token) throw new Error("Sign in to browse talking-head references.");
    const response = await fetch("/api/explore/talking-head-references", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: bounded });
    const data = await response.json();
    if (!response.ok || data.ok !== true || !Array.isArray(data.items)) throw new Error("Talking-head references could not load. Try again.");
    return data.items;
  }, signal);
}

export async function loadTalkingHeadReferenceFile(reference: TalkingHeadReference, signal?: AbortSignal) {
  return withReadDeadline(async bounded => {
    const path = reference.videoUrl;
    if (!path || !/^\/explore\/talking-head-references\/v1\/[a-z0-9-]+\.mp4$/.test(path)) throw new Error("This reference is unavailable. Choose another example.");
    const response = await fetch(path, { signal: bounded, redirect: "error" });
    if (!response.ok) throw new Error("The reference video could not load. Try again; your previous reference is kept.");
    const blob = await response.blob();
    if (!blob.size || blob.size > 32 * 1024 ** 2) throw new Error("This reference video is unavailable.");
    return new File([blob], `${reference.id}.mp4`, { type: "video/mp4" });
  }, signal);
}
