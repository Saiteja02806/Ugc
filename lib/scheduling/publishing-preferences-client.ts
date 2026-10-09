import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { parsePublishingPreferences, type PublishingPreferences } from "./publishing-preferences";

export async function requestPublishingPreferences(value?: PublishingPreferences, signal?: AbortSignal) {
  const token = await getCurrentUserIdToken();
  if (!token) throw new Error("Sign in to manage publishing preferences.");
  const response = await fetch("/api/account/publishing-preferences", {
    method: value ? "PUT" : "GET", cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token}`, ...(value ? { "Content-Type": "application/json" } : {}) },
    ...(value ? { body: JSON.stringify(value) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) throw new Error(data?.message ?? "Could not load publishing preferences.");
  return parsePublishingPreferences(data.preferences);
}
