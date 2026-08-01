import ffprobeStatic from "ffprobe-static";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const SOURCE_BATCH = "hook-silent-2026-07-29";
const ffprobePath = ffprobeStatic.path;
const OUTPUT_PATH = path.resolve(
  "scripts/data/hook-silent-videos-2026-07-29.json",
);
const CSV_PATH = path.resolve(
  "scripts/data/hook-silent-videos-2026-07-29.csv",
);
const SUMMARY_PATH = path.resolve(
  "scripts/data/hook-silent-videos-2026-07-29-summary.md",
);

const SOURCE_FOLDERS = {
  first: "C:\\Users\\chund\\OneDrive\\Desktop\\avatar_video's\\1st",
  new: "C:\\Users\\chund\\OneDrive\\Desktop\\avatar_video's\\new",
  talia: "C:\\Users\\chund\\OneDrive\\Desktop\\avatar_video's\\Talia",
  nine_one:
    "C:\\Users\\chund\\OneDrive\\Desktop\\avatar_video's\\new-2\\9.1",
  mira: "C:\\Users\\chund\\OneDrive\\Desktop\\avatar_video's\\10\\Mira",
  amara: "C:\\Users\\chund\\OneDrive\\Desktop\\avatar_video's\\Amara",
  real_four:
    "C:\\Users\\chund\\OneDrive\\Desktop\\real videos\\videos (4)",
};

const VISUAL_GROUPS = {
  bedroom_reaction:
    "Influencer reacting in a bedroom or bed setting.",
  cafe_reaction:
    "Influencer seated in a cafe or restaurant environment.",
  desk_laptop_reaction:
    "Influencer reacting while a laptop or desk setup is visually prominent.",
  fitness_workspace_reaction:
    "Fitness-styled influencer moving beside a laptop or workspace.",
  headphones_reaction:
    "Headphones are a prominent part of the influencer reaction.",
  indoor_selfie_closeup:
    "Indoor face-led selfie or close-up reaction without a dominant prop.",
  indoor_selfie_medium:
    "Indoor medium-framed reaction showing more torso or surrounding room.",
  office_selfie:
    "Influencer in a recognizable office or shared-workspace setting.",
  phone_reaction:
    "A phone is visibly involved in the influencer reaction.",
  sofa_reaction:
    "Influencer reacting while seated on a sofa or lounge chair.",
};

const REACTION_TYPES = {
  amusement_laughter:
    "Positive amusement, laughter, or delighted surprise.",
  concern_anxiety:
    "Concern, worry, stress, embarrassment, or anxious realization.",
  confidence_approval:
    "Confident, knowing, satisfied, or approving expression.",
  confusion_skepticism:
    "Confusion, doubt, skepticism, or questioning disbelief.",
  curiosity_discovery:
    "Curiosity, discovery, attention shift, or an emerging realization.",
  focused_attention:
    "Neutral-to-focused action that supplies lower-intensity Hook movement.",
  secret_reveal:
    "Shh, secrecy, concealed information, or a reveal gesture.",
  shock_surprise:
    "Clear shock, surprise, disbelief, or startled realization.",
};

const INFLUENCERS = {
  amara: influencer("Amara", "high"),
  mira: influencer("Mira", "high"),
  talia: influencer("Talia", "high"),
  creator_001: influencer("Creator 001", "high"),
  creator_002: influencer("Creator 002", "high"),
  creator_003: influencer("Creator 003", "high"),
  creator_004: influencer("Creator 004", "high"),
  creator_005: influencer("Creator 005", "high"),
  creator_006: influencer("Creator 006", "medium"),
  creator_007: influencer("Creator 007", "medium"),
  creator_008: influencer("Creator 008", "medium"),
  creator_009: influencer("Creator 009", "medium"),
  creator_010: influencer("Creator 010", "medium"),
  creator_011: influencer("Creator 011", "medium"),
  creator_012: influencer("Creator 012", "medium"),
  creator_013: influencer("Creator 013", "medium"),
  creator_014: influencer("Creator 014", "medium"),
  creator_015: influencer("Creator 015", "medium"),
  creator_016: influencer("Creator 016", "medium"),
  creator_017: influencer("Creator 017", "medium"),
  creator_018: influencer("Creator 018", "medium"),
  creator_019: influencer("Creator 019", "medium"),
  creator_020: influencer("Creator 020", "medium"),
  creator_021: influencer("Creator 021", "medium"),
};

const REVIEW_DECISIONS = [
  review(
    "first",
    "0caf-bb90-4026-95a0-1ffd9e77ba78.mp4",
    "creator_001",
    "indoor_selfie_closeup",
    "concern_anxiety",
  ),
  review(
    "first",
    "3908-89a0-4a32-8094-0b181fb857c3.mp4",
    "creator_001",
    "desk_laptop_reaction",
    "focused_attention",
    "Approved as a lower-intensity Hook: putting on headphones and beginning focused laptop work provides clear movement.",
  ),
  review(
    "first",
    "3e10-a088-47b1-9dbe-8ce491f358d6.mp4",
    "creator_001",
    "indoor_selfie_closeup",
    "secret_reveal",
  ),
  review(
    "first",
    "4bc4-ec37-4623-9f68-23b6f76fd229.mp4",
    "creator_001",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "first",
    "69ff-576f-4330-a4fd-064470910d24.mp4",
    "creator_001",
    "indoor_selfie_closeup",
    "amusement_laughter",
  ),
  review(
    "first",
    "6cc5-d213-43b7-8b77-dfd73f71a791.mp4",
    "creator_001",
    "indoor_selfie_closeup",
    "amusement_laughter",
  ),
  review(
    "first",
    "765d-c495-4e73-8820-b01ff46e3ee5.mp4",
    "creator_001",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "first",
    "81ef-5314-4d59-a07f-277c53abfc9e.mp4",
    "creator_001",
    "indoor_selfie_medium",
    "confusion_skepticism",
  ),
  review(
    "first",
    "8c14-58c7-4c4e-a64a-0a743ad20643.mp4",
    "creator_001",
    "desk_laptop_reaction",
    "confusion_skepticism",
  ),
  review(
    "first",
    "93df-ada7-4a1a-a096-f59a17b2d615.mp4",
    "creator_001",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "first",
    "aa79-ba78-4f24-a87e-511d5bf6da89.mp4",
    "creator_001",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "first",
    "b6e0-d146-46bc-a543-9132a0974cd4.mp4",
    "creator_001",
    "desk_laptop_reaction",
    "shock_surprise",
  ),
  review(
    "first",
    "d37f-6073-4ba3-9a4f-59fd81b775ed.mp4",
    "creator_001",
    "headphones_reaction",
    "amusement_laughter",
  ),
  review(
    "first",
    "d90e-a72c-4af2-987c-75355a42dc39.mp4",
    "creator_001",
    "headphones_reaction",
    "amusement_laughter",
  ),
  review(
    "first",
    "eedb-145d-4e4a-9cea-0f91bff974a0.mp4",
    "creator_001",
    "indoor_selfie_closeup",
    "amusement_laughter",
  ),
  review(
    "first",
    "fb54-4909-410d-8633-b9101e051a4b.mp4",
    "creator_001",
    "indoor_selfie_closeup",
    "amusement_laughter",
  ),
  review(
    "first",
    "Woman_reacting_to_camera_202607211246 (1)_MutedVideo_com.mp4",
    "creator_002",
    "desk_laptop_reaction",
    "shock_surprise",
  ),
  review(
    "first",
    "Woman_reacting_to_social_app_202607211312 (1)_MutedVideo_com.mp4",
    "creator_001",
    "indoor_selfie_medium",
    "concern_anxiety",
  ),
  review(
    "first",
    "Woman_skeptical_at_laptop_202607210230 (1)_MutedVideo_com.mp4",
    "creator_001",
    "desk_laptop_reaction",
    "confusion_skepticism",
  ),

  review(
    "new",
    "44a9-6912-4fcb-9e93-a0b8e948f258.mp4",
    "creator_003",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "new",
    "67aa-1691-4386-8a2f-a26fc6215d3b (1).mp4",
    "creator_003",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "new",
    "80e1-0494-4248-9142-4b1799ead239.mp4",
    "creator_003",
    "indoor_selfie_medium",
    "shock_surprise",
  ),
  review(
    "new",
    "9985-6507-492d-8169-4b88de264ef3.mp4",
    "creator_003",
    "indoor_selfie_closeup",
    "amusement_laughter",
  ),
  review(
    "new",
    "a788-edb0-4ee8-a7b5-77a9bb8a9f68.mp4",
    "creator_003",
    "indoor_selfie_medium",
    "shock_surprise",
  ),
  review(
    "new",
    "Avatar_reveals_secret_on_laptop_202607210225 (1)_MutedVideo_com.mp4",
    "creator_003",
    "desk_laptop_reaction",
    "confusion_skepticism",
  ),
  review(
    "new",
    "Create_a_vertical_9_16_realistic_202607061541 (1).mp4",
    "creator_003",
    "indoor_selfie_medium",
    "confusion_skepticism",
  ),
  review(
    "new",
    "d6ab-b014-4e09-bf7f-e38bd1864f1c.mp4",
    "creator_003",
    "indoor_selfie_medium",
    "shock_surprise",
  ),
  review(
    "new",
    "Female_avatar_in_home_environment_202607210225 (1)_MutedVideo_com.mp4",
    "creator_003",
    "indoor_selfie_closeup",
    "concern_anxiety",
  ),
  review(
    "new",
    "Woman_confused_realization_lapto_202607210225_MutedVideo_com.mp4",
    "creator_003",
    "indoor_selfie_closeup",
    "confusion_skepticism",
  ),

  review(
    "talia",
    "3fc3-ef29-44af-a3c4-2fea6c84e2ee.mp4",
    "talia",
    "phone_reaction",
    "shock_surprise",
  ),
  review(
    "talia",
    "66dd-3bf3-417c-bccf-d3e358e43aaf.mp4",
    "talia",
    "desk_laptop_reaction",
    "concern_anxiety",
  ),
  review(
    "talia",
    "Avatar_performs_secret_shh_ges_202607210159_MutedVideo_com.mp4",
    "talia",
    "indoor_selfie_closeup",
    "secret_reveal",
  ),
  review(
    "talia",
    "ee37-26ac-437e-9099-471fe8f170a9.mp4",
    "talia",
    "sofa_reaction",
    "shock_surprise",
  ),
  review(
    "talia",
    "Red_headphones_shocked_happy_laugh_202607210145 (1)_MutedVideo_com.mp4",
    "talia",
    "headphones_reaction",
    "amusement_laughter",
  ),
  review(
    "talia",
    "Stunned_disbelief_headphone_remo_202607210146 (1)_MutedVideo_com.mp4",
    "talia",
    "headphones_reaction",
    "shock_surprise",
  ),
  review(
    "talia",
    "Woman_hand_on_chest_reaction_202607031555 (1)_MutedVideo_com.mp4",
    "talia",
    "sofa_reaction",
    "shock_surprise",
  ),
  review(
    "talia",
    "Woman_putting_on_headphones_202607210148 (1)_MutedVideo_com.mp4",
    "talia",
    "headphones_reaction",
    "curiosity_discovery",
  ),

  review(
    "nine_one",
    "21c0-e21c-474e-a6d6-aa5f8df29249.mp4",
    "creator_004",
    "cafe_reaction",
    "concern_anxiety",
  ),
  review(
    "nine_one",
    "4285-14b8-41f0-9532-eb7bc7fd91b1.mp4",
    "creator_004",
    "cafe_reaction",
    "amusement_laughter",
  ),
  review(
    "nine_one",
    "Female_avatar_in_cafe_202607211002 (1)_MutedVideo_com.mp4",
    "creator_004",
    "cafe_reaction",
    "concern_anxiety",
    "Approved after beginning/middle/end review: the clip changes from concern to attentive composure.",
  ),
  review(
    "nine_one",
    "Woman_with_hand_on_head_202607211000 (1)_MutedVideo_com.mp4",
    "creator_005",
    "cafe_reaction",
    "concern_anxiety",
  ),

  review(
    "mira",
    "11a2-0094-424c-8d73-fd761b1de524.mp4",
    "mira",
    "indoor_selfie_medium",
    "shock_surprise",
  ),
  review(
    "mira",
    "1b39-4a26-4def-a189-61c372bc9a95.mp4",
    "mira",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "mira",
    "1d89-c533-42a2-bd24-0dbfc5e03447.mp4",
    "mira",
    "indoor_selfie_closeup",
    "amusement_laughter",
  ),
  review(
    "mira",
    "2313-58e5-4e6a-8458-33da5042c4f3.mp4",
    "mira",
    "indoor_selfie_closeup",
    "concern_anxiety",
  ),
  review(
    "mira",
    "2e09-0064-447d-a543-76e080dac160.mp4",
    "mira",
    "indoor_selfie_medium",
    "shock_surprise",
  ),
  review(
    "mira",
    "baad-895e-4711-8ae1-34017a60fee1.mp4",
    "mira",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "mira",
    "d728-95ae-44d8-a628-9ca4bc9c099d.mp4",
    "mira",
    "indoor_selfie_closeup",
    "confusion_skepticism",
  ),
  review(
    "mira",
    "e1ca-c66b-4413-a521-2c9c775834ff.mp4",
    "mira",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "mira",
    "f34e-d2a8-4ed9-a44d-b1f962b93db4.mp4",
    "mira",
    "indoor_selfie_closeup",
    "secret_reveal",
  ),
  review(
    "mira",
    "f765-81a0-4c3c-a195-632537a135a4.mp4",
    "mira",
    "indoor_selfie_closeup",
    "amusement_laughter",
  ),
  review(
    "mira",
    "fd94-be0b-4eab-9816-6e166b957b7b.mp4",
    "mira",
    "indoor_selfie_closeup",
    "amusement_laughter",
  ),
  review(
    "mira",
    "UGC_avatar_curiosity_intrigue_la_202607021048.mp4",
    "mira",
    "desk_laptop_reaction",
    "confusion_skepticism",
  ),
  review(
    "mira",
    "Woman_laughing_at_phone_1080p_202607021048.mp4",
    "mira",
    "indoor_selfie_closeup",
    "amusement_laughter",
  ),
  review(
    "mira",
    "Young_woman_laughing_silently_1080p_202607021048.mp4",
    "mira",
    "indoor_selfie_closeup",
    "amusement_laughter",
  ),

  review(
    "amara",
    "6c09-c330-4692-bae5-4cf7310b4ab4.mp4",
    "amara",
    "indoor_selfie_medium",
    "shock_surprise",
  ),
  review(
    "amara",
    "Avatar_covered-mouth_laugh_reaction_202607210138 (1)_MutedVideo_com.mp4",
    "amara",
    "headphones_reaction",
    "amusement_laughter",
  ),
  review(
    "amara",
    "Avatar_performs_secret_shh_ges_202607210159 (1)_MutedVideo_com.mp4",
    "amara",
    "indoor_selfie_closeup",
    "secret_reveal",
  ),
  review(
    "amara",
    "Avatar_shocked_amused_laugh_reac_202607210139_MutedVideo_com.mp4",
    "amara",
    "headphones_reaction",
    "amusement_laughter",
  ),
  review(
    "amara",
    "Glasses-off_stunned_disbelief_hook_202607210137 (1)_MutedVideo_com.mp4",
    "amara",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "amara",
    "Woman_stunned_on_sofa_202607031557 (2)_MutedVideo_com.mp4",
    "amara",
    "sofa_reaction",
    "concern_anxiety",
  ),

  review(
    "real_four",
    "Female_avatar_reaction_video_202607250057 (1)-silent.mp4",
    "creator_006",
    "indoor_selfie_medium",
    "shock_surprise",
  ),
  review(
    "real_four",
    "Female_avatar_reaction_video_202607250058 (1)-silent.mp4",
    "creator_007",
    "indoor_selfie_medium",
    "shock_surprise",
  ),
  review(
    "real_four",
    "Female_avatar_shocked_reaction_202607250111 (1)-silent.mp4",
    "creator_008",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "real_four",
    "Person_showing_disbelief_with_su_202607250049-silent.mp4",
    "creator_009",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "real_four",
    "Remove_text_on_video_202607250036_1-silent.mp4",
    "creator_010",
    "fitness_workspace_reaction",
    "focused_attention",
    "Approved after motion review: the stretching action provides strong movement even without a facial reaction.",
  ),
  review(
    "real_four",
    "Remove_text_on_video_202607250048 (1)-silent.mp4",
    "creator_011",
    "indoor_selfie_closeup",
    "curiosity_discovery",
    "Approved after motion review: the clip moves from drinking to a close-up realization.",
  ),
  review(
    "real_four",
    "sds-silent.mp4",
    "creator_012",
    "desk_laptop_reaction",
    "shock_surprise",
  ),
  review(
    "real_four",
    "Video_with_swapped_face_202607250040 (1)-silent.mp4",
    "creator_013",
    "desk_laptop_reaction",
    "curiosity_discovery",
    "Approved after motion review: the clip visibly changes from drinking to discovery at the laptop.",
  ),
  review(
    "real_four",
    "Woman_reacting_to_discovery_202607250041 (2)-silent.mp4",
    "creator_014",
    "indoor_selfie_closeup",
    "shock_surprise",
  ),
  review(
    "real_four",
    "Woman_reacting_to_discovery_202607250057 (1)-silent.mp4",
    "creator_015",
    "desk_laptop_reaction",
    "shock_surprise",
  ),
  review(
    "real_four",
    "Woman_reacting_to_laptop_202607250038 (1)-silent.mp4",
    "creator_016",
    "desk_laptop_reaction",
    "shock_surprise",
  ),
  review(
    "real_four",
    "Woman_reacting_to_laptop_202607250055 (1)-silent.mp4",
    "creator_017",
    "desk_laptop_reaction",
    "curiosity_discovery",
    "Approved after motion review: the expression progresses from drinking to a clear positive discovery.",
  ),
  review(
    "real_four",
    "Woman_taping_mouth_closed_202607250036 (1)-silent.mp4",
    "creator_018",
    "indoor_selfie_medium",
    "secret_reveal",
    "Approved as an unusual secrecy/reveal gesture with clear beginning-to-end movement.",
  ),
  review(
    "real_four",
    "Woman_taping_mouth_thumbs_up_202607250045 (2)-silent.mp4",
    "creator_019",
    "indoor_selfie_medium",
    "secret_reveal",
    "Approved as an unusual secrecy/reveal gesture with clear beginning-to-end movement.",
  ),
  review(
    "real_four",
    "Woman_with_confident_smirk_202607250113 (1)-silent.mp4",
    "creator_020",
    "office_selfie",
    "confidence_approval",
    "Approved after motion review: the controlled smirk and head turn provide a confident lower-intensity Hook.",
  ),
  review(
    "real_four",
    "Woman_with_hand_covering_mouth_202607250056 (1)-silent.mp4",
    "creator_021",
    "bedroom_reaction",
    "amusement_laughter",
  ),
  review(
    "real_four",
    "Woman_with_hand_on_forehead_202607250056 (1)-silent.mp4",
    "creator_021",
    "bedroom_reaction",
    "concern_anxiety",
  ),
];

const reviewBySource = new Map(
  REVIEW_DECISIONS.map((decision) => [
    sourceKey(decision.sourceFolderKey, decision.originalFileName),
    decision,
  ]),
);

assertReviewTaxonomy();

const discovered = [];

for (const [sourceFolderKey, sourceFolder] of Object.entries(
  SOURCE_FOLDERS,
)) {
  const files = readdirSync(sourceFolder)
    .filter((fileName) => isVideoFile(fileName))
    .sort((left, right) => left.localeCompare(right));

  for (const originalFileName of files) {
    const sourcePath = path.join(sourceFolder, originalFileName);
    const technical = inspectVideo(sourcePath);

    if (technical.hasAudio) {
      continue;
    }

    const decision = reviewBySource.get(
      sourceKey(sourceFolderKey, originalFileName),
    );

    if (!decision) {
      throw new Error(
        `Silent Hook video is missing a manual review: ${sourceFolderKey}/${originalFileName}`,
      );
    }

    discovered.push({
      assetKey: `hook-silent:${technical.sha256}`,
      catalogName: [
        decision.influencerKey.replaceAll("_", "-"),
        decision.reactionType.replaceAll("_", "-"),
        technical.sha256.slice(0, 10),
      ].join("-"),
      durationSeconds: technical.durationSeconds,
      fileSizeBytes: statSync(sourcePath).size,
      hasAudio: false,
      height: technical.height,
      influencerKey: decision.influencerKey,
      originalFileName,
      ratio: technical.ratio,
      reactionType: decision.reactionType,
      reviewReason:
        decision.reviewReason ??
        `Approved: the clip provides a usable ${REACTION_TYPES[
          decision.reactionType
        ].toLowerCase()}`,
      reviewStatus: decision.reviewStatus,
      sha256: technical.sha256,
      sourceFolderKey,
      videoCodec: technical.videoCodec,
      visualGroup: decision.visualGroup,
      width: technical.width,
    });
  }
}

assertDiscoveredAssets(discovered);

const approvedAssets = discovered.filter(
  (asset) => asset.reviewStatus === "approved",
);
const rejectedAssets = discovered.filter(
  (asset) => asset.reviewStatus === "rejected",
);
const manifest = {
  schemaVersion: "hook-silent-video-manifest-v1",
  sourceBatch: SOURCE_BATCH,
  reviewedAt: "2026-07-29",
  policy: {
    audio:
      "This first batch includes only source files with no audio stream. Original files are not modified.",
    influencerIdentity:
      "Named source folders retain their known influencer identity. Mixed unnamed folders use provisional Creator labels and keep uncertain identities separate.",
    localFiles:
      "Source files keep their original local names. A stable catalog name is generated from influencer, reaction, and SHA-256.",
    review:
      "Every asset received a manual frame review. Ambiguous clips were additionally checked across beginning, middle, and end.",
    visualGrouping:
      "Every video has exactly one primary visual group for feed diversity.",
  },
  sourceFolders: SOURCE_FOLDERS,
  visualGroups: VISUAL_GROUPS,
  reactionTypes: REACTION_TYPES,
  influencers: INFLUENCERS,
  summary: {
    approvedCount: approvedAssets.length,
    rejectedCount: rejectedAssets.length,
    silentCount: discovered.length,
    sourceFolderCounts: countBy(
      discovered,
      (asset) => asset.sourceFolderKey,
    ),
    visualGroupCounts: countBy(
      approvedAssets,
      (asset) => asset.visualGroup,
    ),
    reactionTypeCounts: countBy(
      approvedAssets,
      (asset) => asset.reactionType,
    ),
    durationBands: {
      under1_5Seconds: discovered.filter(
        (asset) => asset.durationSeconds < 1.5,
      ).length,
      from1_5ToUnder2_2Seconds: discovered.filter(
        (asset) =>
          asset.durationSeconds >= 1.5 &&
          asset.durationSeconds < 2.2,
      ).length,
      from2_2ToUnder3Seconds: discovered.filter(
        (asset) =>
          asset.durationSeconds >= 2.2 &&
          asset.durationSeconds < 3,
      ).length,
      atLeast3Seconds: discovered.filter(
        (asset) => asset.durationSeconds >= 3,
      ).length,
    },
  },
  assets: discovered,
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(CSV_PATH, renderCsv(discovered));
writeFileSync(SUMMARY_PATH, renderSummary(manifest));

console.log("Silent Hook review manifest prepared");
console.log(`Manifest: ${OUTPUT_PATH}`);
console.log(`CSV: ${CSV_PATH}`);
console.log(`Summary: ${SUMMARY_PATH}`);
console.log(`Silent videos: ${manifest.summary.silentCount}`);
console.log(`Approved: ${manifest.summary.approvedCount}`);
console.log(`Rejected: ${manifest.summary.rejectedCount}`);

function influencer(displayName, identityConfidence) {
  return {
    displayName,
    identityConfidence,
  };
}

function review(
  sourceFolderKey,
  originalFileName,
  influencerKey,
  visualGroup,
  reactionType,
  reviewReason,
) {
  return {
    influencerKey,
    originalFileName,
    reactionType,
    reviewReason,
    reviewStatus: "approved",
    sourceFolderKey,
    visualGroup,
  };
}

function sourceKey(sourceFolderKey, originalFileName) {
  return `${sourceFolderKey}/${originalFileName}`;
}

function inspectVideo(sourcePath) {
  const probe = JSON.parse(
    execFileSync(
      ffprobePath,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-show_entries",
        "stream=codec_name,codec_type,width,height",
        "-of",
        "json",
        "--",
        sourcePath,
      ],
      { encoding: "utf8" },
    ),
  );
  const videoStream = probe.streams?.find(
    (stream) => stream.codec_type === "video",
  );
  const durationSeconds = Number(probe.format?.duration);
  const width = Number(videoStream?.width);
  const height = Number(videoStream?.height);

  if (
    !videoStream ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0
  ) {
    throw new Error(`Invalid Hook video metadata: ${sourcePath}`);
  }

  return {
    durationSeconds: Math.round(durationSeconds * 1000) / 1000,
    hasAudio: probe.streams?.some(
      (stream) => stream.codec_type === "audio",
    ),
    height,
    ratio: getRatio(width, height),
    sha256: createHash("sha256")
      .update(readFileSync(sourcePath))
      .digest("hex"),
    videoCodec: videoStream.codec_name,
    width,
  };
}

function getRatio(width, height) {
  const actual = width / height;
  const target = 9 / 16;

  return Math.abs(actual - target) <= 0.01 ? "9:16" : "other";
}

function assertReviewTaxonomy() {
  const knownFolderKeys = new Set(Object.keys(SOURCE_FOLDERS));
  const knownInfluencerKeys = new Set(Object.keys(INFLUENCERS));
  const knownVisualGroups = new Set(Object.keys(VISUAL_GROUPS));
  const knownReactionTypes = new Set(Object.keys(REACTION_TYPES));
  const seenSources = new Set();

  for (const decision of REVIEW_DECISIONS) {
    const key = sourceKey(
      decision.sourceFolderKey,
      decision.originalFileName,
    );

    if (seenSources.has(key)) {
      throw new Error(`Duplicate Hook review decision: ${key}`);
    }

    seenSources.add(key);

    if (!knownFolderKeys.has(decision.sourceFolderKey)) {
      throw new Error(`Unknown Hook source folder: ${key}`);
    }

    if (!knownInfluencerKeys.has(decision.influencerKey)) {
      throw new Error(`Unknown Hook influencer: ${key}`);
    }

    if (!knownVisualGroups.has(decision.visualGroup)) {
      throw new Error(`Unknown Hook visual group: ${key}`);
    }

    if (!knownReactionTypes.has(decision.reactionType)) {
      throw new Error(`Unknown Hook reaction type: ${key}`);
    }
  }
}

function assertDiscoveredAssets(assets) {
  const discoveredKeys = new Set(
    assets.map((asset) =>
      sourceKey(asset.sourceFolderKey, asset.originalFileName),
    ),
  );
  const reviewedSilentKeys = new Set(
    REVIEW_DECISIONS.map((decision) =>
      sourceKey(decision.sourceFolderKey, decision.originalFileName),
    ),
  );

  if (assets.length !== 78) {
    throw new Error(
      `Expected 78 silent Hook videos, but discovered ${assets.length}.`,
    );
  }

  if (reviewedSilentKeys.size !== discoveredKeys.size) {
    throw new Error(
      `Expected ${reviewedSilentKeys.size} reviewed silent videos, but discovered ${discoveredKeys.size}.`,
    );
  }

  for (const reviewedKey of reviewedSilentKeys) {
    if (!discoveredKeys.has(reviewedKey)) {
      throw new Error(
        `Reviewed Hook source is missing or no longer silent: ${reviewedKey}`,
      );
    }
  }

  if (new Set(assets.map((asset) => asset.sha256)).size !== assets.length) {
    throw new Error("Silent Hook source files contain duplicate SHA-256 hashes.");
  }

  const invalid = assets.filter(
    (asset) =>
      asset.hasAudio ||
      asset.ratio !== "9:16" ||
      asset.videoCodec !== "h264" ||
      !asset.reviewReason.trim() ||
      !["approved", "rejected"].includes(asset.reviewStatus),
  );

  if (invalid.length > 0) {
    throw new Error(
      `${invalid.length} silent Hook video(s) failed manifest validation.`,
    );
  }
}

function countBy(items, getKey) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const key = getKey(item);

      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())].sort(([left], [right]) =>
      String(left).localeCompare(String(right)),
    ),
  );
}

function renderCsv(assets) {
  const columns = [
    "catalogName",
    "sourceFolderKey",
    "originalFileName",
    "influencerKey",
    "visualGroup",
    "reactionType",
    "durationSeconds",
    "width",
    "height",
    "hasAudio",
    "sha256",
    "reviewStatus",
    "reviewReason",
  ];

  return [
    columns.join(","),
    ...assets.map((asset) =>
      columns.map((column) => csvCell(asset[column])).join(","),
    ),
    "",
  ].join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");

  return /[",\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function renderSummary(manifest) {
  const rejected = manifest.assets.filter(
    (asset) => asset.reviewStatus === "rejected",
  );

  return [
    "# Silent Hook Video Review",
    "",
    `- Source batch: \`${manifest.sourceBatch}\``,
    `- Silent videos reviewed: ${manifest.summary.silentCount}`,
    `- Approved: ${manifest.summary.approvedCount}`,
    `- Rejected: ${manifest.summary.rejectedCount}`,
    `- Exact duplicate hashes: 0`,
    `- Audio streams: 0`,
    `- Format: all 9:16 H.264`,
    "",
    "## Source folders",
    "",
    ...Object.entries(manifest.summary.sourceFolderCounts).map(
      ([key, count]) => `- ${key}: ${count}`,
    ),
    "",
    "## Duration bands",
    "",
    `- Under 1.5 seconds: ${manifest.summary.durationBands.under1_5Seconds}`,
    `- 1.5 to under 2.2 seconds: ${manifest.summary.durationBands.from1_5ToUnder2_2Seconds}`,
    `- 2.2 to under 3 seconds: ${manifest.summary.durationBands.from2_2ToUnder3Seconds}`,
    `- At least 3 seconds: ${manifest.summary.durationBands.atLeast3Seconds}`,
    "",
    "## Rejected files",
    "",
    ...(rejected.length > 0
      ? rejected.map(
          (asset) =>
            `- ${asset.sourceFolderKey}/${asset.originalFileName}: ${asset.reviewReason}`,
        )
      : ["No videos were rejected in this silent batch."]),
    "",
    "No database row or GCP object is created by this preparation step.",
    "",
  ].join("\n");
}

function isVideoFile(fileName) {
  return [".m4v", ".mov", ".mp4", ".webm"].includes(
    path.extname(fileName).toLowerCase(),
  );
}
