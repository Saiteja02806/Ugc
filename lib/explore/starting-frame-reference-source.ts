import "server-only";
import { getExploreWallTextVideoAssetsForImport } from "./wall-text-video-library.ts";
import { getExplorePairedReferences } from "../../worker/src/lib/explore-reference-soundtrack.ts";
import talkingSources from "./talking-head-source-manifest.json" with { type: "json" };

/** Server-owned identities only. Never turn a browser URL into an input path. */
export function getAdditionalStartingFrameSources() {
  return [
    ...getExploreWallTextVideoAssetsForImport().map(item => ({
      id: item.id, videoSha256: item.sourceFileSha256, videoStorageKey: item.storageKey,
      workflow: "wall_text" as const, width: 0, height: 0,
    })),
    ...getExplorePairedReferences("wall_text").map(item => ({
      id: item.id, videoSha256: item.videoSha256, videoStorageKey: item.videoStorageKey,
      workflow: "wall_text" as const, width: item.width, height: item.height,
    })),
    ...talkingSources.items.map(item => ({ id: item.id, videoSha256: item.sourceSha256,
      videoStorageKey: "", localFile: item.file, width: item.width, height: item.height, workflow: "talking_head" as const })),
  ];
}
