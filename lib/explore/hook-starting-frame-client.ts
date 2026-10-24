import { getCurrentUserIdToken } from "../firebase/auth";
import { getCuratedHookFrame } from "../../worker/src/lib/hook-curated-frames.ts";
import { withReadDeadline } from "../http/read-deadline";

export type HookStartingFrame = {
  referenceId: string;
  sourceSha256: string;
  frame: { index: number; timeSeconds: number; width: number; height: number; sha256: string };
  blob: Blob;
};

const SHA256 = /^[a-f0-9]{64}$/;

/** A source URL is a scope hint only. The server resolves the catalogue again. */
export function hookSourceSha256(videoUrl: string | undefined): string | null {
  if (!videoUrl) return null;
  try {
    const name = new URL(videoUrl).pathname.split("/").at(-1);
    return name?.endsWith(".mp4") && SHA256.test(name.slice(0, -4)) ? name.slice(0, -4) : null;
  } catch { return null; }
}

export async function fetchHookStartingFrame(input: {
  ownerId: string; referenceId: string; sourceSha256: string; signal?: AbortSignal;
  retainedFrame?: HookStartingFrame["frame"];
}): Promise<HookStartingFrame> {
  if (!SHA256.test(input.sourceSha256)) throw new Error("Choose an available Hook reference again.");
  return withReadDeadline(async signal => {
    const token = await getCurrentUserIdToken(input.ownerId);
    signal.throwIfAborted();
    if (!token) throw new Error("Sign in to prepare your starting image.");
    // This endpoint only decodes existing footage. It never starts inference.
    const response = await fetch("/api/explore/hook-starting-frame", {
      method: "POST", cache: "no-store", signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ referenceId: input.referenceId, ...(input.retainedFrame ? { sourceFrameSha256: input.retainedFrame.sha256 } : {}) }),
    });
    return readVerifiedHookStartingFrame(response, input);
  }, input.signal, 90_000);
}

/** Both live and development extraction must verify the exact same receipt. */
export async function readVerifiedHookStartingFrame(response: Response, input: {
  referenceId: string; sourceSha256: string;
  retainedFrame?: HookStartingFrame["frame"];
}): Promise<HookStartingFrame> {
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
      throw new Error(body?.message || body?.error || "The opening frame could not be prepared. Try again.");
    }
    const width = Number(response.headers.get("X-Hook-Frame-Width"));
    const height = Number(response.headers.get("X-Hook-Frame-Height"));
    const frameSha256 = response.headers.get("X-Hook-Frame-Sha256") ?? "";
    const selected = input.retainedFrame ?? getCuratedHookFrame(input.referenceId, input.sourceSha256);
    const index = selected?.index ?? 0, timeSeconds = selected?.timeSeconds ?? 0;
    if (response.headers.get("Content-Type")?.split(";")[0] !== "image/png" ||
      response.headers.get("X-Hook-Reference-Id") !== input.referenceId ||
      response.headers.get("X-Hook-Source-Sha256") !== input.sourceSha256 ||
      response.headers.get("X-Hook-Frame-Index") !== String(index) || response.headers.get("X-Hook-Frame-Time") !== String(timeSeconds) ||
      selected && (selected.sha256 !== frameSha256 || selected.width !== width || selected.height !== height) ||
      !SHA256.test(frameSha256) || !Number.isInteger(width) || !Number.isInteger(height) ||
      width < 1 || height < 1 || width > 8192 || height > 8192) {
      throw new Error("This opening frame does not match the selected source. Choose the reference again.");
    }
    const blob = await response.blob();
    if (!blob.size || blob.size > 32 * 1024 ** 2) throw new Error("The opening frame could not be loaded safely.");
    const actual = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))]
      .map(byte => byte.toString(16).padStart(2, "0")).join("");
    if (actual !== frameSha256) throw new Error("The opening frame download was incomplete. Try again.");
    return { referenceId: input.referenceId, sourceSha256: input.sourceSha256,
      frame: { index, timeSeconds, width, height, sha256: frameSha256 }, blob };
}
