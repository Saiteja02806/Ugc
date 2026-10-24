"use client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import type { HookStartingFrameSelection } from "./hook-keyframe-client";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function readRecentStartingFrame(value: unknown, ownerId: string): HookStartingFrameSelection {
  const frame = value as HookStartingFrameSelection;
  let validUrl = false;
  try { const url = new URL(frame?.url); validUrl = url.protocol === "https:" && !url.username && !url.password; } catch { /* Reject malformed media. */ }
  if (!frame || frame.ownerId !== ownerId || !uuid.test(frame.assetId) || !uuid.test(frame.jobId) || !uuid.test(frame.draftId) ||
    typeof frame.referenceId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(frame.referenceId) || !/^[a-f0-9]{64}$/.test(frame.sourceSha256) || !validUrl ||
    !Number.isInteger(frame.width) || frame.width < 1 || frame.width > 8192 || !Number.isInteger(frame.height) || frame.height < 1 || frame.height > 8192 ||
    ![4, 8].includes(frame.durationSeconds) || typeof frame.motionInstructions !== "string" || !frame.motionInstructions.trim() || frame.motionInstructions.length > 24000 ||
    typeof frame.generateAudio !== "boolean") throw new Error("This starting frame could not be verified. Refresh the list and try again.");
  return frame;
}
async function read(ownerId: string, query: string, signal?: AbortSignal) {
  return withReadDeadline(async bounded => {
    const token = await getCurrentUserIdToken(ownerId);
    if (!token) throw new Error("Sign in to choose your starting frames.");
    bounded.throwIfAborted();
    const response = await fetch(`/api/explore/hook-starting-frames${query}`, { cache: "no-store", signal: bounded, headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.message || "Could not load your starting frames.");
    return body;
  }, signal);
}
export async function fetchRecentStartingFrames(ownerId: string, signal?: AbortSignal): Promise<HookStartingFrameSelection[]> {
  const body = await read(ownerId, "", signal);
  if (!Array.isArray(body.frames) || body.frames.length > 24) throw new Error("Could not verify your starting frames.");
  return body.frames.map((frame: unknown) => readRecentStartingFrame(frame, ownerId));
}
export async function fetchRecentStartingFrame(frame: Pick<HookStartingFrameSelection, "assetId" | "jobId">, ownerId: string, signal?: AbortSignal) {
  const body = await read(ownerId, `?jobId=${encodeURIComponent(frame.jobId)}&assetId=${encodeURIComponent(frame.assetId)}`, signal);
  const verified = readRecentStartingFrame(body.frame, ownerId);
  if (verified.assetId !== frame.assetId || verified.jobId !== frame.jobId) throw new Error("The selected starting frame changed. Refresh and choose it again.");
  return verified;
}
