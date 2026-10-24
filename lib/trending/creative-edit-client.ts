import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import type { TrendingCarouselEditStatus, TrendingCreativeEditRecord } from "./creative-edit-contract";

type Scope = Pick<TrendingCreativeEditRecord, "assignmentId" | "creativeId" | "format">;
const pending = new Map<string, Promise<TrendingCreativeEditRecord>>();
const keyFor = (owner: string, scope: Scope) => JSON.stringify([owner, scope.format, scope.creativeId, scope.assignmentId]);
const endpoint = (scope: Scope) => `/api/trending/creatives/${encodeURIComponent(scope.format)}/${encodeURIComponent(scope.creativeId)}/edit`;

async function request(owner: string, url: string, init?: RequestInit, signal?: AbortSignal) {
  if (!owner) throw new Error("Sign in before editing this post.");
  return withReadDeadline(async bounded => {
    const token = await getCurrentUserIdToken(owner);
    bounded.throwIfAborted();
    if (!token) throw new Error("Sign in before editing this post.");
    const response = await fetch(url, { ...init, cache: "no-store", signal: bounded,
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) throw new Error(data?.error || "Could not check this edit. Try again.");
    return data;
  }, signal, init?.method === "PATCH" ? 60_000 : 20_000);
}

export async function readCreativeEdit(owner: string, scope: Scope, view: "editor" | "history" = "history", signal?: AbortSignal): Promise<TrendingCreativeEditRecord> {
  // A route remount must join an existing submission before reading its result.
  // Navigation never cancels the write or submits it a second time.
  await pending.get(keyFor(owner, scope))?.catch(() => undefined);
  signal?.throwIfAborted();
  return (await request(owner, `${endpoint(scope)}?assignmentId=${encodeURIComponent(scope.assignmentId)}&view=${view}`, undefined, signal)).edit;
}

export async function readCarouselEditStatus(owner: string, scope: Scope, signal?: AbortSignal): Promise<TrendingCarouselEditStatus> {
  return (await request(owner, `${endpoint(scope)}?assignmentId=${encodeURIComponent(scope.assignmentId)}&view=status`, undefined, signal)).status;
}

export function submitCreativeEdit(owner: string, scope: Scope, payload: unknown, recover: (edit: TrendingCreativeEditRecord) => boolean): Promise<TrendingCreativeEditRecord> {
  const key = keyFor(owner, scope);
  const existing = pending.get(key);
  if (existing) return existing;
  const operation = (async () => {
    try {
      const body = JSON.stringify(payload);
      // Small submissions can finish even if the document navigates away. Stay
      // below the browser's shared 64 KiB keepalive quota for larger edits.
      const keepalive = new TextEncoder().encode(body).byteLength <= 48_000;
      return (await request(owner, endpoint(scope), { method: "PATCH", body, keepalive })).edit as TrendingCreativeEditRecord;
    } catch (error) {
      // The response may have been lost after commit. Read once, never retry a
      // mutation automatically or assume a different tab's revision is ours.
      const data = await request(owner, `${endpoint(scope)}?assignmentId=${encodeURIComponent(scope.assignmentId)}&view=history`).catch(() => null);
      if (data?.edit && recover(data.edit)) return data.edit as TrendingCreativeEditRecord;
      throw error;
    }
  })();
  pending.set(key, operation);
  void operation.finally(() => { if (pending.get(key) === operation) pending.delete(key); }).catch(() => undefined);
  return operation;
}
