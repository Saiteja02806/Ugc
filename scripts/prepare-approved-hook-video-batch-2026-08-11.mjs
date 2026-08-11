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

const SOURCE_BATCH = "hook-silent-2026-08-11-approved-28";
const REVIEWED_AT = "2026-08-11";
const OUTPUT_PATH = path.resolve(
  "scripts/data/hook-silent-approved-2026-08-11.json",
);

const sourceFolders = {
  approved_root:
    "C:\\Users\\chund\\OneDrive\\Desktop\\hook videos\\videos (5)",
  approved_reviewed:
    "C:\\Users\\chund\\OneDrive\\Desktop\\hook videos\\videos (5)\\reviewed",
  normalized:
    "C:\\Users\\chund\\OneDrive\\Desktop\\UGC\\artifacts\\hook-video-library-import-20260811\\normalized",
};

const visualGroups = {
  bedroom_reaction: "Influencer reacting in a bedroom or bed setting.",
  cafe_reaction: "Influencer seated in a cafe or restaurant environment.",
  desk_laptop_reaction:
    "Influencer reacting while a laptop or desk setup is visually prominent.",
  headphones_reaction:
    "Headphones are a prominent part of the influencer reaction.",
  indoor_selfie_closeup:
    "Indoor face-led selfie or close-up reaction without a dominant prop.",
  indoor_selfie_medium:
    "Indoor medium-framed reaction showing more torso or surrounding room.",
};

const reactionTypes = {
  amusement_laughter:
    "Positive amusement, laughter, or delighted surprise.",
  confidence_approval:
    "Confident, knowing, satisfied, or approving expression.",
  confusion_skepticism:
    "Confusion, doubt, skepticism, disgust, or questioning disbelief.",
  focused_attention:
    "Neutral-to-focused action that supplies lower-intensity Hook movement.",
  shock_surprise:
    "Clear shock, surprise, disbelief, or startled realization.",
};

const assignments = [
  ["approved_root", "5a0c-27d6-4dba-b33c-a9a34506162b.mp4", "creator_023", "desk_laptop_reaction", "shock_surprise"],
  ["approved_root", "eww.mp4", "creator_024", "desk_laptop_reaction", "confusion_skepticism"],
  ["approved_root", "eww1.mp4", "creator_025", "desk_laptop_reaction", "confusion_skepticism"],
  ["normalized", "eww2-silent.mp4", "creator_026", "desk_laptop_reaction", "confusion_skepticism"],
  ["approved_reviewed", "Face_swap_and_edit_video_202608111717 (2)-silent.mp4", "creator_027", "desk_laptop_reaction", "shock_surprise"],
  ["approved_root", "Face_swap_and_replicate_video_202608111717 (1)-silent.mp4", "creator_028", "indoor_selfie_closeup", "amusement_laughter"],
  ["approved_root", "Face_swap_video_editing_instruct_202608111711-silent.mp4", "creator_029", "desk_laptop_reaction", "shock_surprise"],
  ["approved_reviewed", "Face_swap_video_editing_instruct_202608111726-silent.mp4", "creator_030", "desk_laptop_reaction", "focused_attention"],
  ["approved_root", "Influencer_reaction_to_screen_time_202608111731_1-silent.mp4", "creator_031", "headphones_reaction", "shock_surprise"],
  ["approved_root", "Remove_text_swap_face_202608111710_1-silent.mp4", "creator_032", "headphones_reaction", "shock_surprise"],
  ["approved_root", "Remove_text_swap_face_202608111710-silent.mp4", "creator_033", "desk_laptop_reaction", "shock_surprise"],
  ["approved_root", "Remove_text_swap_face_202608111713-silent.mp4", "creator_034", "desk_laptop_reaction", "shock_surprise"],
  ["approved_reviewed", "Remove_text_swap_face_202608111716_1-silent.mp4", "creator_035", "bedroom_reaction", "shock_surprise"],
  ["approved_reviewed", "Remove_text_swap_face_202608111716-silent.mp4", "creator_036", "bedroom_reaction", "shock_surprise"],
  ["approved_reviewed", "Remove_text_swap_face_202608111723-silent.mp4", "creator_037", "bedroom_reaction", "amusement_laughter"],
  ["approved_root", "Remove_text_swap_face_202608111725-silent.mp4", "creator_038", "cafe_reaction", "shock_surprise"],
  ["approved_reviewed", "Remove_text_swap_face_video_202608111709-silent.mp4", "creator_039", "indoor_selfie_medium", "confidence_approval"],
  ["approved_root", "Swap_face_and_replicate_actions_202608111726-silent.mp4", "creator_040", "desk_laptop_reaction", "shock_surprise"],
  ["approved_reviewed", "Swap_face_and_replicate_actions_202608111734-silent.mp4", "creator_041", "desk_laptop_reaction", "confidence_approval"],
  ["approved_root", "Swap_face_change_outfit_background_202608111709_1-silent.mp4", "creator_042", "desk_laptop_reaction", "confusion_skepticism"],
  ["approved_reviewed", "Swap_face_change_outfit_background_202608111709_2-silent.mp4", "creator_043", "indoor_selfie_closeup", "shock_surprise"],
  ["approved_root", "Swap_face_change_outfit_background_202608111709-silent.mp4", "creator_044", "indoor_selfie_closeup", "shock_surprise"],
  ["approved_root", "Swap_face_in_video_202608111711-silent.mp4", "creator_045", "indoor_selfie_closeup", "amusement_laughter"],
  ["approved_root", "Swap_face_in_video_202608111719-silent.mp4", "creator_046", "indoor_selfie_closeup", "shock_surprise"],
  ["approved_root", "Swap_face_in_video_202608111720-silent.mp4", "creator_047", "indoor_selfie_closeup", "amusement_laughter"],
  ["approved_root", "Video_editing_and_face_swapping_202608111730-silent.mp4", "creator_048", "desk_laptop_reaction", "shock_surprise"],
  ["approved_root", "Video_face_swap_and_edit_202608111730-silent.mp4", "creator_049", "desk_laptop_reaction", "shock_surprise"],
  ["approved_root", "Video_face_swap_and_edit_202608111734-silent.mp4", "creator_050", "desk_laptop_reaction", "confusion_skepticism"],
];

const influencers = Object.fromEntries(
  assignments.map(([, , influencerKey]) => [
    influencerKey,
    {
      displayName: `Creator ${influencerKey.slice(-3)}`,
      identityConfidence: "medium",
    },
  ]),
);

const assets = assignments.map(
  ([sourceFolderKey, originalFileName, influencerKey, visualGroup, reactionType], index) => {
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
      influencerKey,
      originalFileName,
      ratio: "9:16",
      reactionType,
      reviewReason:
        originalFileName === "eww2-silent.mp4"
          ? "User-approved EWW Hook video normalized from eww2.mp4 by removing its embedded audio; lock to EWW.mp3."
          : originalFileName.toLowerCase().startsWith("eww")
            ? "User-approved EWW Hook video; lock to EWW.mp3."
            : "User approved the complete 28-video batch after manual beginning-to-end review.",
      reviewStatus: "approved",
      sha256,
      sortOrder: 79 + index,
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
      "All imported files are silent. eww2.mp4 is represented by a lossless-video silent derivative so Locked EWW.mp3 audio can be applied safely.",
    influencerIdentity:
      "Every newly generated face is conservatively kept as a separate provisional creator to avoid merging uncertain identities.",
    review:
      "The user manually approved all 28 videos after the visual and technical audit.",
    visualGrouping:
      "Every video maps to one existing active Hook format; no new format is introduced by this batch.",
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
