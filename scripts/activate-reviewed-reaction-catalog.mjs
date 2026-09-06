import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_MANIFEST_PATH = path.resolve(
  "artifacts/reaction-asset-review/reaction-manifest-template.json",
);

// These are the approved visual-review decisions from 2026-09-06.  The index
// is deliberately asserted against the reviewed source filename below so a
// later manifest reorder cannot silently apply the wrong tags to an asset.
const BACKGROUND_TAGS = [
  [["sunset", "outdoors"], "bottom_center"],
  [["gym"], "bottom_center"],
  [["restaurant"], "bottom_center"],
  [["park", "night_walk"], "bottom_center"],
  [["park"], "bottom_center"],
  [["park", "sunset"], "bottom_center"],
  [["park", "night_walk"], "bottom_center"],
  [["living_room"], "bottom_center"],
  [["bedroom"], "bottom_center"],
  [["beach", "sunset"], "bottom_center"],
  [["pastel"], "center"],
  [["park"], "bottom_center"],
  [["window_light"], "center"],
  [["sunset"], "bottom_center"],
  [["night_walk"], "bottom_center"],
  [["night_walk"], "bottom_center"],
  [["sunset"], "bottom_center"],
  [["sunset"], "bottom_center"],
  [["night_walk"], "bottom_center"],
];

const CLIP_TAGS = [
  [["disappointment", "regret"], "one", "close_up", 0.64],
  [["laughter", "celebration"], "one", "bust", 0.55],
  [["confusion", "concern"], "one", "bust", 0.58],
  [["unbothered", "deadpan"], "one", "bust", 0.58],
  [["side_eye", "deadpan"], "one", "close_up", 0.72],
  [["deadpan", "unbothered"], "one", "bust", 0.56],
  [["shock", "confusion"], "one", "full_body", 0.72],
  [["playful", "celebration"], "two", "full_body", 0.58],
  [["concern", "disappointment"], "two", "full_body", 0.65],
  [["concern", "confusion"], "one", "bust", 0.8],
  [["deadpan", "unbothered"], "one", "close_up", 0.72],
  [["celebration", "playful"], "one", "bust", 0.62],
  [["deadpan", "side_eye"], "one", "close_up", 0.72],
  [["confusion", "concern"], "two", "full_body", 0.62],
  [["side_eye", "confusion"], "one", "bust", 0.55],
  [["concern", "focused"], "one", "bust", 0.55],
  [["side_eye", "unbothered"], "one", "bust", 0.55],
  [["deadpan", "confusion"], "one", "bust", 0.6],
  [["shock", "confusion"], "one", "close_up", 0.75],
  [["concern", "focused"], "one", "bust", 0.7],
  [["playful", "unbothered"], "one", "full_body", 0.7],
  [["celebration", "playful"], "one", "bust", 0.65],
  [["deadpan", "side_eye"], "one", "close_up", 0.58],
  [["regret", "concern"], "one", "bust", 0.55],
  [["side_eye", "concern"], "one", "bust", 0.58],
  [["shock", "confusion"], "one", "close_up", 0.72],
  [["confusion", "playful"], "one", "full_body", 0.75],
  [["laughter", "celebration"], "one", "bust", 0.55],
  [["relief", "concern"], "one", "bust", 0.58],
  [["confusion", "concern"], "group", "bust", 0.62],
  [["celebration", "playful"], "one", "full_body", 0.73],
  [["playful", "celebration"], "one", "full_body", 0.8],
  [["shock", "confusion"], "one", "close_up", 0.72],
  [["shock", "playful"], "one", "close_up", 0.75],
  [["side_eye", "deadpan"], "one", "close_up", 0.75],
  [["celebration", "playful"], "one", "full_body", 0.7],
  [["celebration", "playful"], "group", "full_body", 0.8],
  [["deadpan", "unbothered"], "one", "close_up", 0.76],
  [["celebration", "playful"], "two", "full_body", 0.6],
  [["playful", "celebration"], "two", "full_body", 0.7],
  [["side_eye", "confusion"], "one", "bust", 0.55],
  [["shock", "confusion"], "one", "close_up", 0.7],
  [["side_eye", "deadpan"], "one", "close_up", 0.75],
  [["celebration", "playful"], "one", "full_body", 0.75],
  [["unbothered", "playful"], "one", "bust", 0.68],
  [["confusion", "concern"], "two", "bust", 0.6],
  [["shock", "confusion"], "one", "close_up", 0.72],
  [["shock", "confusion"], "one", "bust", 0.6],
  [["unbothered", "playful"], "one", "bust", 0.65],
  [["playful", "celebration"], "one", "close_up", 0.7],
  [["celebration", "playful"], "one", "full_body", 0.75],
  [["side_eye", "deadpan"], "one", "close_up", 0.72],
  [["deadpan", "unbothered"], "one", "bust", 0.55],
  [["shock", "confusion"], "one", "close_up", 0.7],
  [["relief", "unbothered"], "one", "full_body", 0.65],
  [["celebration", "playful"], "one", "full_body", 0.72],
  [["playful", "focused"], "one", "full_body", 0.76],
  [["shock", "confusion"], "one", "close_up", 0.75],
  [["concern", "confusion"], "one", "bust", 0.55],
  [["unbothered", "deadpan"], "one", "bust", 0.55],
  [["shock", "confusion"], "one", "bust", 0.55],
];

const expectedBackgroundFiles = [
  "🌅.jpg", "a (1).jpg", "a (2).jpg", "diac park.jpg", "download (1).jpg",
  "download (2).jpg", "download (24).jpg", "download (25).jpg", "download (26).jpg",
  "download (3).jpg", "download (4).jpg", "download (5).jpg", "download.jpg",
  "Golden Sunset Sky _ Beautiful Evening Clouds & Nature Photography.jpg",
  "Late night walks 🦢🦚.jpg", "mind relaxing _just listening 🎧.jpg",
  "Some lessons only come after disappointment_ ☁️  • •.jpg", "Sunset.jpg", "The Weather 🌧️.jpg",
];

const expectedClipFiles = [
  "diy_gift_green_removed_prores4444.mov", "morning_rhythm_green_removed_prores4444.mov",
  ...Array.from({ length: 20 }, (_, index) => `${String(index + 1).padStart(2, "0")}_green_removed_clean.mov`),
  ...Array.from({ length: 20 }, (_, index) => `${String(index + 1).padStart(2, "0")}_core_edgeclean_ProRes4444_q12_alpha.mov`),
  ...Array.from({ length: 19 }, (_, index) => `${String(index + 1).padStart(2, "0")}_ProRes4444_Q12_transparent.mov`),
];

const manifestPath = path.resolve(String(process.argv[2] ?? DEFAULT_MANIFEST_PATH));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest.backgrounds) || manifest.backgrounds.length !== BACKGROUND_TAGS.length) {
  throw new Error("The reviewed background catalog no longer has the expected 19 assets.");
}
if (!Array.isArray(manifest.videos) || manifest.videos.length !== CLIP_TAGS.length) {
  throw new Error("The reviewed clip catalog no longer has the expected 61 assets.");
}

manifest.backgrounds.forEach((asset, index) => {
  const [contextTags, foregroundPlacement] = BACKGROUND_TAGS[index];
  if (asset.sourceFileName !== expectedBackgroundFiles[index]) {
    throw new Error(`Background catalog order changed at ${index + 1}: ${asset.sourceFileName}`);
  }
  asset.contextTags = contextTags;
  asset.foregroundPlacement = foregroundPlacement;
  asset.status = "active";
});

manifest.videos.forEach((asset, index) => {
  const [reactions, subjectCount, composition, heightPercent] = CLIP_TAGS[index];
  if (asset.sourceFileName !== expectedClipFiles[index]) {
    throw new Error(`Clip catalog order changed at ${index + 1}: ${asset.sourceFileName}`);
  }
  if (!asset.hasAlpha) {
    throw new Error(`Reviewed clip ${asset.assetId} no longer has alpha.`);
  }
  asset.reactions = reactions;
  asset.subjectCount = subjectCount;
  asset.composition = composition;
  asset.placement = { anchor: "bottom_center", heightPercent };
  asset.status = "active";
});

manifest.review = {
  approvedAt: "2026-09-06T00:00:00.000Z",
  approvedBy: "product-review",
  note: "Approved assets activated after visual and technical review. Tags are intentionally limited to the Reaction matcher contract.",
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Activated ${manifest.videos.length} Reaction clips and ${manifest.backgrounds.length} backgrounds.`);
