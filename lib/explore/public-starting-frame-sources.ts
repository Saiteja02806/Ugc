import "server-only";
import { getHookReferenceGalleryItems } from "../../worker/src/lib/explore-hook-reference-release.ts";
import { getAdditionalStartingFrameSources } from "./starting-frame-reference-source.ts";

/** Public catalogue preparation only. Curated later frames never substitute for frame zero. */
export function getPublicStartingFrameSources(workflow: "all" | "hook" | "wall_text" | "talking_head" = "all") {
  const sources = [
    ...getHookReferenceGalleryItems().map(item => ({ ...item, workflow: "hook" as const })),
    ...getAdditionalStartingFrameSources(),
  ].filter(item => !item.id.startsWith("creator-account-") && (workflow === "all" || item.workflow === workflow));
  const unique = new Map<string, (typeof sources)[number]>();
  for (const source of sources) {
    const previous = unique.get(source.id);
    if (previous && previous.videoSha256 !== source.videoSha256) throw new Error("Conflicting public starting-frame source versions.");
    if (!previous) unique.set(source.id, source);
  }
  return [...unique.values()];
}
