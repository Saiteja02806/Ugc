"use client";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";

/** Bound authentication, transport, and response parsing as one operation. */
export function analyticsRequest<T>(url: string, owner: string, signal: AbortSignal, body?: object): Promise<T> {
  return withReadDeadline(async (bounded) => {
    const token = await getCurrentUserIdToken(owner);
    // A token lookup can finish after cancellation or the deadline. It must
    // not start a request for a screen that has already stopped waiting.
    bounded.throwIfAborted();
    if (!token) throw new Error("Sign in before viewing analytics.");
    const response = await fetch(url, {
      method: body ? "POST" : "GET", cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: bounded,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) throw new Error(result?.message ?? "Could not load analytics. Please try again.");
    return result as T;
  }, signal);
}
