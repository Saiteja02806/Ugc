import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import ffprobeStatic from "ffprobe-static";

const SOURCE_BATCH = "hook-silent-2026-08-20-approved-11";
const REVIEWED_AT = "2026-08-20";
const OUTPUT_PATH = path.resolve(
  "scripts/data/hook-silent-approved-2026-08-20.json",
);

const sourceFolders = {
  approved_root:
    "C:\\Users\\chund\\OneDrive\\Desktop\\hook videos\\notbeen\\videos (6)",
};

const visualGroups = {
  airplane_reaction:
    "Influencer reacting while seated in an airplane cabin or beside an airplane window.",
  cafe_reaction: "Influencer seated in a cafe or restaurant environment.",
  desk_laptop_reaction:
    "Influencer reacting while a laptop or desk setup is visually prominent.",
  indoor_selfie_closeup:
    "Indoor face-led selfie or close-up reaction without a dominant prop.",
  indoor_selfie_medium:
    "Indoor medium-framed reaction showing more torso or surrounding room.",
};

const reactionTypes = {
  amusement_laughter:
    "Positive amusement, laughter, or delighted surprise.",
  concern_anxiety:
    "Concern, anxiety, worry, nervousness, or emotional unease.",
  confidence_approval:
    "Confident, knowing, satisfied, or approving expression.",
  focused_attention:
    "Neutral-to-focused action that supplies lower-intensity Hook movement.",
  shock_surprise:
    "Clear shock, surprise, disbelief, or startled realization.",
};

const ABOVE_HEAD = {
  preset: "above_head",
  reviewVersion: "hook-multiframe-placement-v2",
  reviewedAt: REVIEWED_AT,
  x: 0.5,
  y: 0.15,
};

const BELOW_FACE = {
  preset: "below_face",
  reviewVersion: "hook-multiframe-placement-v2",
  reviewedAt: REVIEWED_AT,
  x: 0.5,
  y: 0.68,
};

const assignments = [
  [
    "Face_swap_and_background_modific_202608191845-Vmake-silent.mp4",
    "creator_051",
    "airplane_reaction",
    "amusement_laughter",
    ABOVE_HEAD,
  ],
  [
    "Face_swap_and_video_editing_202608191842-Vmake-silent.mp4",
    "creator_052",
    "indoor_selfie_closeup",
    "concern_anxiety",
    BELOW_FACE,
  ],
  [
    "Perform_face_swap_and_action_202608131952 (1)-silent.mp4",
    "creator_053",
    "desk_laptop_reaction",
    "concern_anxiety",
    ABOVE_HEAD,
  ],
  [
    "Perform_face_swap_and_edit_202608131957 (1)-silent.mp4",
    "creator_054",
    "desk_laptop_reaction",
    "concern_anxiety",
    ABOVE_HEAD,
  ],
  [
    "Perform_face_swap_video_editing_202608131953 (1)-silent.mp4",
    "creator_055",
    "desk_laptop_reaction",
    "shock_surprise",
    ABOVE_HEAD,
  ],
  [
    "Perform_video_face_swap_202608191845-Vmake-silent.mp4",
    "creator_056",
    "airplane_reaction",
    "shock_surprise",
    ABOVE_HEAD,
  ],
  [
    "Remove_text_swap_face_202608121447 (1)-silent.mp4",
    "creator_057",
    "desk_laptop_reaction",
    "shock_surprise",
    BELOW_FACE,
  ],
  [
    "Swap_face_in_video_202608121447 (2)-silent.mp4",
    "creator_058",
    "desk_laptop_reaction",
    "confidence_approval",
    ABOVE_HEAD,
  ],
  [
    "Swap_face_in_video_202608121447_1-silent.mp4",
    "creator_059",
    "cafe_reaction",
    "amusement_laughter",
    BELOW_FACE,
  ],
  [
    "Video_face_swap_and_edit_202608191844-Vmake-silent.mp4",
    "creator_060",
    "airplane_reaction",
    "shock_surprise",
    ABOVE_HEAD,
  ],
  [
    "Video_face_swap_and_editing_202608191842-Vmake-silent.mp4",
    "creator_061",
    "indoor_selfie_medium",
    "focused_attention",
    ABOVE_HEAD,
  ],
];

const influencers = Object.fromEntries(
  assignments.map(([, influencerKey]) => [
    influencerKey,
    {
      displayName: `Creator ${influencerKey.slice(-3)}`,
      identityConfidence: "medium",
    },
  ]),
);

const assets = assignments.map(
  ([originalFileName, influencerKey, visualGroup, reactionType, hookTextPlacement], index) => {
    const sourceFolderKey = "approved_root";
    const filePath = path.join(sourceFolders[sourceFolderKey], originalFileName);
    const bytes = readFileSync(filePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const technical = probeVideo(filePath);

    if (technical.audioStreamCount !== 0) {
      throw new Error(`${originalFileName} still contains an audio stream.`);
    }
    if (
      technical.videoCodec !== "h264" ||
      technical.width !== 720 ||
      technical.height !== 1280 ||
      technical.width * 16 !== technical.height * 9
    ) {
      throw new Error(`${originalFileName} is not a 720x1280 H.264 Hook video.`);
    }

    const catalogName = [
      influencerKey.replaceAll("_", "-"),
      reactionType.replaceAll("_", "-"),
      sha256.slice(0, 10),
    ].join("-");

    return {
      assetKey: `hook-silent:${sha256}`,
      catalogName,
      durationSeconds: technical.durationSeconds,
      fileSizeBytes: statSync(filePath).size,
      hasAudio: false,
      height: technical.height,
      hookTextPlacement,
      influencerKey,
      originalFileName,
      ratio: "9:16",
      reactionType,
      reviewReason:
        "User approved the recommended 11-video import after technical validation and start/middle/end visual review.",
      reviewStatus: "approved",
      sha256,
      sortOrder: 107 + index,
      sourceFolderKey,
      videoCodec: technical.videoCodec,
      visualGroup,
      width: technical.width,
    };
  },
);

const manifest = {
  schemaVersion: "hook-silent-video-manifest-v1",
  sourceBatch: SOURCE_BATCH,
  reviewedAt: REVIEWED_AT,
  policy: {
    audio:
      "All imported files are silent and enter the Dynamic Hook audio path unless a later approved per-video lock is configured.",
    influencerIdentity:
      "Every generated face is conservatively kept as a separate provisional creator to avoid merging uncertain identities.",
    review:
      "The user approved the recommended 11-video import. The 1.387-second clip remains excluded for readability reasons.",
    textPlacement:
      "Static Hook text placement was reviewed across start, middle, and near-end frames because reveal clips can begin without a visible face.",
    visualGrouping:
      "Airplane clips use the new airplane_reaction visual/audio format; all other videos map to existing active Hook formats.",
  },
  sourceFolders,
  visualGroups,
  reactionTypes,
  influencers,
  assets,
  summary: {
    approvedCount: assets.length,
    rejectedCount: 0,
    silentCount: assets.filter((asset) => asset.hasAudio === false).length,
    sourceFolderCounts: countBy(assets, (asset) => asset.sourceFolderKey),
    visualGroupCounts: countBy(assets, (asset) => asset.visualGroup),
    reactionTypeCounts: countBy(assets, (asset) => asset.reactionType),
  },
};

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${assets.length} approved Hook videos to ${OUTPUT_PATH}.`);

function probeVideo(filePath) {
  const output = execFileSync(
    ffprobeStatic.path,
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,width,height:format=duration",
      "-of",
      "json",
      filePath,
    ],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(output);
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStreams = streams.filter((stream) => stream.codec_type === "video");
  const audioStreams = streams.filter((stream) => stream.codec_type === "audio");
  const video = videoStreams[0];
  const durationSeconds = Number(parsed.format?.duration);

  if (videoStreams.length !== 1 || !Number.isFinite(durationSeconds)) {
    throw new Error(`Could not inspect ${path.basename(filePath)}.`);
  }

  return {
    audioStreamCount: audioStreams.length,
    durationSeconds: Math.round(durationSeconds * 1000) / 1000,
    height: Number(video.height),
    videoCodec: video.codec_name,
    width: Number(video.width),
  };
}

function countBy(items, selector) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const key = selector(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())].sort(([left], [right]) => left.localeCompare(right)),
  );
}
