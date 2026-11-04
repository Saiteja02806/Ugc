"use client";

import type { RecreateReference } from "@/lib/explore/recreate-types";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";

type RecreateReferencesResponse =
  | { items: RecreateReference[]; archivedHookItems?: RecreateReference[]; ok: true }
  | { message?: string; ok?: false };

export async function fetchRecreateReferences(signal?: AbortSignal, ownerId?: string): Promise<RecreateReference[]> {
  return withReadDeadline(async bounded => {
    const token = await getCurrentUserIdToken(ownerId);
    bounded.throwIfAborted();
    if (!token) throw new Error("Sign in before opening Recreate.");
    const response = await fetch("/api/explore/recreate-references", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: bounded,
    });
    const data = await response.json().catch(() => null) as RecreateReferencesResponse | null;
    if (!response.ok || data?.ok !== true || !("items" in data) || !Array.isArray(data.items)) throw new Error(data && "message" in data && typeof data.message === "string" ? data.message : "Could not load references.");
    return [...data.items, ...(data.archivedHookItems ?? [])];
  }, signal);
}
