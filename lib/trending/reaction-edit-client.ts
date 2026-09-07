import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { ReactionTextEditRecord } from "./reaction-edit-contract";

export async function fetchReactionTextEdit(
  item: { assignmentId: string; creativeId: string },
  body?: unknown,
  signal?: AbortSignal,
): Promise<ReactionTextEditRecord> {
  const token = await getCurrentUserIdToken();
  if (!token) throw new Error("Sign in before editing this Reaction Reel.");
  const response = await fetch(`/api/trending/reactions/${item.creativeId}/edit?assignmentId=${encodeURIComponent(item.assignmentId)}`, {
    method: body ? "PATCH" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal,
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.message ?? "Could not load this Reaction Reel.");
  return data.edit;
}
