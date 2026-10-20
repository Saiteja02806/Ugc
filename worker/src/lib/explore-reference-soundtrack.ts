import catalog from "./explore-paired-reference-catalog.json" with { type: "json" };
import { getHookReferenceReleaseItems } from "./explore-hook-reference-release.ts";

export type ExploreReferenceSoundtrack = {
  version: 1;
  referenceId: string;
  audioSha256: string;
  volume: number;
  /** Worker-owned audio base retains speech, edits and timing without the added music. */
  cleanStorageKey?: string;
};

export function getExplorePairedReferences(format?: "hook" | "wall_text") {
  const items = [...(catalog.mediaStatus === "published" ? catalog.items : []), ...getHookReferenceReleaseItems()];
  // A new release may reuse a previously published video/audio identity.
  return [...new Map(items.map(item => [item.id, item])).values()].filter(item => !format || item.format === format);
}

export function getExplorePairedReference(id: unknown) {
  return typeof id === "string" ? getExplorePairedReferences().find(item => item.id === id) ?? null : null;
}

export function isSilentExploreReference(reference: unknown): boolean {
  return !!reference && typeof reference === "object" && "audioPolicy" in reference && reference.audioPolicy === "silent";
}

export function getGenerationReferenceSoundtrack(input: Record<string, unknown>) {
  const reference = getExplorePairedReference(input.referenceId);
  if (!reference || input.referenceType !== reference.format || input.exploreFormat !== undefined && input.exploreFormat !== null && input.exploreFormat !== reference.format) return null;
  return reference;
}

const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Stored server provenance only. Audio URLs and storage paths supplied by a client are never used. */
export function getAssetReferenceSoundtrack(metadata: unknown): ExploreReferenceSoundtrack | null {
  const raw = object(metadata), saved = object(object(raw.render).referenceSoundtrack);
  const reference = getExplorePairedReference(saved.referenceId ?? raw.exploreReferenceId);
  if (!reference) return null;
  // New silent outputs have no soundtrack. Retain explicit historical receipts
  // so already rendered media can still be edited using its original mapping.
  if (!saved.referenceId && isSilentExploreReference(reference)) return null;
  if (saved.referenceId && (saved.version !== 1 || saved.audioSha256 !== reference.audioSha256)) throw new Error("The saved reference audio mapping could not be verified.");
  const volume = saved.volume === undefined ? .2 : saved.volume;
  if (typeof volume !== "number" || !Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error("The saved reference audio volume is invalid.");
  return { version: 1, referenceId: reference.id, audioSha256: reference.audioSha256, volume,
    ...(typeof saved.cleanStorageKey === "string" ? { cleanStorageKey: saved.cleanStorageKey } : {}) };
}

export function referenceAudioBaseStorageKey(assetId: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(assetId)) throw new Error("Invalid reference audio base identity.");
  return `explore/finishes/${assetId.toLowerCase()}/audio-base.mp4`;
}
