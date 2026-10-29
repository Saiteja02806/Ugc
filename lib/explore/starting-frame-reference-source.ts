import "server-only";
import { getExploreWallTextVideoAssetsForImport } from "./wall-text-video-library.ts";
import { getExplorePairedReferences } from "../../worker/src/lib/explore-reference-soundtrack.ts";
import talkingSources from "./talking-head-source-manifest.json" with { type: "json" };
import importedCatalog from "./imported-catalog.json" with { type: "json" };
import { readCreatorPrivateJson, type CreatorCatalog } from "./creator-private-files.ts";
const creatorSources = readCreatorPrivateJson<CreatorCatalog>("creator-accounts.json", {version: 1, accounts: []});

/** Server-owned identities only. Never turn a browser URL into an input path. */
export function getAdditionalStartingFrameSources() {
  return [
    ...creatorSources.accounts.flatMap(account => account.items.map(item => ({ id: item.id, videoSha256: item.sourceSha256,
      videoStorageKey: "", width: item.width, height: item.height, durationSeconds: item.durationSeconds, workflow: "hook" as const }))),
    ...getExploreWallTextVideoAssetsForImport().map(item => ({
      id: item.id, videoSha256: item.sourceFileSha256, videoStorageKey: item.storageKey,
      workflow: "wall_text" as const, width: 0, height: 0,
    })),
    ...getExplorePairedReferences("wall_text").map(item => ({
      id: item.id, videoSha256: item.videoSha256, videoStorageKey: item.videoStorageKey,
      workflow: "wall_text" as const, width: item.width, height: item.height,
    })),
    ...(importedCatalog.mediaStatus === "published" ? importedCatalog.items.flatMap(item =>
      item.format === "wall_text" && "videoFile" in item && typeof item.videoFile === "string" && /^[a-f0-9]{64}\.mp4$/.test(item.videoFile)
        ? [{ id: item.id, videoSha256: item.videoFile.slice(0, -4), videoStorageKey: `explore/recreate/v1/${item.videoFile}`,
          workflow: "wall_text" as const, width: 0, height: 0, durationSeconds: item.durationSeconds }]
        : []) : []),
    ...talkingSources.items.map(item => ({ id: item.id, videoSha256: item.sourceSha256,
      videoStorageKey: "", localFile: item.file, width: item.width, height: item.height, workflow: "talking_head" as const })),
  ];
}
