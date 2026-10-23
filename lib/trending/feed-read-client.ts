import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";

/** One deadline covers authentication, transport and parsing on mount/resume. */
export function readTrendingFeed<T>(ownerId: string, search: URLSearchParams, signal: AbortSignal) {
  return withReadDeadline(async bounded => {
    const token = await getCurrentUserIdToken(ownerId);
    bounded.throwIfAborted();
    if (!token) throw new Error("Sign in before viewing generated carousels.");
    const response = await fetch(`/api/trending/feed?${search.toString()}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: bounded,
    });
    const data = await response.json().catch(() => null) as T | null;
    return { response, data };
  }, signal, 20_000);
}
