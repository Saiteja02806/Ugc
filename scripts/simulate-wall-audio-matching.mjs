import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildWallAudioIntent,
  getWallAudioFitMode,
  selectWallAudio,
  WALL_AUDIO_ENERGY_LEVELS,
  WALL_AUDIO_MESSAGE_TYPES,
  WALL_AUDIO_MOODS,
} from "../lib/trending/wall-audio-matcher.ts";
import { WALL_TEXT_PATTERNS } from "../lib/trending/wall-text-types.ts";

const DEFAULT_LIBRARY_ROOT = "D:\\walloftext_sound\\wall_audio_library_v2";
const args = parseArgs(process.argv.slice(2));
const libraryRoot = path.resolve(
  String(args.library || DEFAULT_LIBRARY_ROOT),
);
const manifest = JSON.parse(
  readFileSync(
    path.join(libraryRoot, "metadata", "wall_audio_assets.json"),
    "utf8",
  ),
);
const activeAssets = manifest.assets
  .filter(
    (asset) =>
      asset.status === "active" && asset.reviewStatus === "approved",
  )
  .map((asset) => ({
    audioUrl: `https://poc.invalid/${asset.id}.mp3`,
    cueStartSeconds: asset.cueStartSeconds,
    durationSeconds: asset.durationSeconds,
    energy: asset.energy,
    id: asset.id,
    loopable: asset.loopable,
    messageTypes: asset.messageTypes,
    moods: asset.moods,
    reviewStatus: "approved",
    status: "active",
  }));

assertVocabularyMatchesManifest(manifest.controlledVocabulary);

const durations = [3, 5, 6, 7, 10, 12];
const simulations = [];
const recentAssetIds = [];

for (const pattern of WALL_TEXT_PATTERNS) {
  const intent = buildWallAudioIntent({ pattern });
  for (const videoDurationSeconds of durations) {
    const selection = selectWallAudio({
      assets: activeAssets,
      intent,
      recentAssetIds,
      videoDurationSeconds,
    });
    if (!selection) {
      throw new Error(
        `No selection for ${pattern} at ${videoDurationSeconds} seconds.`,
      );
    }
    const asset = activeAssets.find(
      (candidate) => candidate.id === selection.audioAssetId,
    );
    if (
      !asset ||
      getWallAudioFitMode(asset, videoDurationSeconds) !== selection.fitMode
    ) {
      throw new Error(`Duration proof failed for ${selection.audioAssetId}.`);
    }

    simulations.push({
      assetDurationSeconds: selection.audioAssetDurationSeconds,
      audioAssetId: selection.audioAssetId,
      energy: intent.energy,
      fitMode: selection.fitMode,
      matchScore: selection.matchScore,
      messageTypes: intent.messageTypes,
      moods: intent.moods,
      pattern,
      videoDurationSeconds,
    });
    recentAssetIds.unshift(selection.audioAssetId);
  }
}

const shortLoopableAsset = activeAssets.find(
  (asset) => asset.loopable && asset.durationSeconds < 6,
);
if (!shortLoopableAsset) {
  throw new Error("The approved library has no short loopable proof asset.");
}
const forcedLoop = selectWallAudio({
  assets: [shortLoopableAsset],
  intent: buildWallAudioIntent({ pattern: "before_after" }),
  videoDurationSeconds: 10,
});
if (!forcedLoop || forcedLoop.fitMode !== "loop") {
  throw new Error("The ten-second loop fallback proof failed.");
}

const longTrimmableAsset = activeAssets
  .filter((asset) => asset.durationSeconds >= 30)
  .sort((left, right) => right.durationSeconds - left.durationSeconds)[0];
if (!longTrimmableAsset) {
  throw new Error("The approved library has no long soundtrack trim proof asset.");
}
const longTrim = selectWallAudio({
  assets: [shortLoopableAsset, longTrimmableAsset],
  intent: buildWallAudioIntent({ pattern: "before_after" }),
  videoDurationSeconds: 12,
});
if (!longTrim || longTrim.fitMode !== "trim") {
  throw new Error("The 12-second long-soundtrack trim proof failed.");
}

const report = {
  activeAssetCount: activeAssets.length,
  durationCoverage: durations.map((duration) => ({
    directCount: activeAssets.filter((asset) => {
      const fit = getWallAudioFitMode(asset, duration);
      return fit === "exact" || fit === "trim";
    }).length,
    durationSeconds: duration,
    loopFallbackCount: activeAssets.filter(
      (asset) => getWallAudioFitMode(asset, duration) === "loop",
    ).length,
    rejectedCount: activeAssets.filter(
      (asset) => getWallAudioFitMode(asset, duration) === null,
    ).length,
  })),
  forcedLoopProof: {
    assetDurationSeconds: forcedLoop.audioAssetDurationSeconds,
    audioAssetId: forcedLoop.audioAssetId,
    fitMode: forcedLoop.fitMode,
    videoDurationSeconds: 10,
  },
  longSoundtrackTrimProof: {
    assetDurationSeconds: longTrim.audioAssetDurationSeconds,
    audioAssetId: longTrim.audioAssetId,
    fitMode: longTrim.fitMode,
    videoDurationSeconds: 12,
  },
  generatedAt: new Date().toISOString(),
  librarySchemaVersion: manifest.schemaVersion,
  simulationCount: simulations.length,
  simulations,
};

const outputPath = path.resolve(
  String(
    args.output || ".tmp/wall-audio-poc/matching-simulation.json",
  ),
);
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Active approved assets: ${report.activeAssetCount}`);
console.log(`Pattern-duration simulations: ${report.simulationCount}`);
for (const coverage of report.durationCoverage) {
  console.log(
    `${coverage.durationSeconds}s: direct ${coverage.directCount}, loop ${coverage.loopFallbackCount}, rejected ${coverage.rejectedCount}`,
  );
}
console.log(
  `Forced 10s loop proof: ${report.forcedLoopProof.audioAssetId} (${report.forcedLoopProof.assetDurationSeconds}s -> 10s)`,
);
console.log(
  `Long soundtrack trim proof: ${report.longSoundtrackTrimProof.audioAssetId} (${report.longSoundtrackTrimProof.assetDurationSeconds}s -> 12s)`,
);
console.log(`Report: ${outputPath}`);

function assertVocabularyMatchesManifest(vocabulary) {
  const expected = {
    moods: [...WALL_AUDIO_MOODS],
    messageTypes: [...WALL_AUDIO_MESSAGE_TYPES],
    energy: [...WALL_AUDIO_ENERGY_LEVELS],
  };
  for (const [key, values] of Object.entries(expected)) {
    if (
      JSON.stringify([...(vocabulary?.[key] ?? [])].sort()) !==
      JSON.stringify([...values].sort())
    ) {
      throw new Error(`Manifest ${key} vocabulary does not match code.`);
    }
  }
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
