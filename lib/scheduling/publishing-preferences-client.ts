import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "../http/read-deadline";
import { parsePublishingPreferences, type PublishingPreferences } from "./publishing-preferences";

export async function requestPublishingPreferences(value?: PublishingPreferences, signal?: AbortSignal) {
  return withReadDeadline(async (boundedSignal) => {
    const token = await getCurrentUserIdToken();
    boundedSignal.throwIfAborted();
    if (!token) throw new Error("Sign in to manage publishing preferences.");
    const response = await fetch("/api/account/publishing-preferences?schema=3", {
      method: value ? "PUT" : "GET", cache: "no-store",
      signal: boundedSignal,
      headers: { Authorization: `Bearer ${token}`, ...(value ? { "Content-Type": "application/json" } : {}) },
      ...(value ? { body: JSON.stringify(value) } : {}),
    });
    const data = await response.json().catch(() => null);
    boundedSignal.throwIfAborted();
    if (!response.ok || !data?.ok) throw new Error(data?.message ?? "Could not load publishing preferences.");
    return parsePublishingPreferences(data.preferences);
  }, signal, 10_000);
}
