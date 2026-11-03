"use client";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";

async function bounded<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([run(controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Reference preparation timed out")); }, timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

/** This endpoint only prepares immutable references. Never apply its retry policy to paid admission. */
export async function prepareStudioReferenceAssets(userId: string, traitIds: string[], dependencies = {
  token: getCurrentUserIdToken, fetch: ((...args) => globalThis.fetch(...args)) as typeof fetch, timeoutMs: 95_000,
}): Promise<string[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let retryable = true;
    try {
      const token = await bounded(() => dependencies.token(userId), 15_000);
      if (!token) { retryable = false; throw new Error("Sign in before preparing your character references."); }
      return await bounded(async signal => {
        const response = await dependencies.fetch("/api/characters/studio-references", {
          method: "POST", signal, cache: "no-store",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ traitIds }),
        });
        const result = await response.json();
        if (!response.ok || !result?.ok) {
          retryable = response.status === 503 && result?.retryable === true;
          throw new Error(typeof result?.error === "string" ? result.error : "Could not prepare character references.");
        }
        retryable = false;
        if (!Array.isArray(result.references) || result.references.length !== traitIds.length
          || result.references.some((ref: { traitId?: unknown; assetId?: unknown }, index: number) => ref.traitId !== traitIds[index]
            || typeof ref.assetId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref.assetId))
          || new Set(result.references.map((ref: { assetId: string }) => ref.assetId)).size !== traitIds.length) {
          throw new Error("The selected character references could not be verified. Try Generate again.");
        }
        return result.references.map((ref: { assetId: string }) => ref.assetId);
      }, dependencies.timeoutMs);
    } catch (error) {
      if (!attempt && retryable) continue;
      throw new Error(error instanceof Error && !["Failed to fetch", "Reference preparation timed out"].includes(error.message)
        ? error.message : "Character reference preparation was interrupted. Try Generate again; completed references are kept.");
    }
  }
  throw new Error("Could not prepare character references.");
}
