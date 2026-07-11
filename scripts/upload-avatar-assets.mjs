import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";

const DEFAULT_EMMA_FOLDER =
  "C:\\Users\\chund\\OneDrive\\Desktop\\avatar_video's\\1st\\emma";
const DEFAULT_AVATAR_KEY = "emma";
const DEFAULT_AVATAR_LABEL = "Emma";
const DEFAULT_EXPECTED_COUNT = 9;
const DEFAULT_DURATION_SECONDS = 3;
const DEFAULT_RATIO = "9:16";
const MAX_AVATAR_UPLOAD_BYTES = 500 * 1024 * 1024;
const AVATAR_THUMBNAIL_WIDTH = 450;
const AVATAR_THUMBNAIL_HEIGHT = 800;

const AVATAR_FILE_MAPPINGS = {
  amara: [
    {
      match: /^Create_realistic_UGC_image_frame_202607031803.*\.mp4$/i,
      slug: "alarmed-by-phone",
      title: "Alarmed By Phone",
    },
    {
      match: /^Create_realistic_UGC_image_frame_202607031832.*\.mp4$/i,
      slug: "speechless-disbelief",
      title: "Speechless Disbelief",
    },
    {
      match: /^Woman_hand_on_chest_reaction_.*\.mp4$/i,
      slug: "startled-hand-on-chest",
      title: "Startled Hand On Chest",
    },
    {
      match: /^Woman_stunned_on_sofa_.*\.mp4$/i,
      slug: "stunned-on-sofa",
      title: "Stunned On Sofa",
    },
    {
      match: /^Woman_with_confused_disbelief_ex_.*\.mp4$/i,
      slug: "confused-disbelief",
      title: "Confused Disbelief",
    },
    {
      match: /^Woman_with_hand_on_forehead_.*\.mp4$/i,
      slug: "worried-hand-on-forehead",
      title: "Worried Hand On Forehead",
    },
  ],
  ava: [
    {
      match: /^Woman_hand_on_chest_reaction_.* \(2\)\.mp4$/i,
      slug: "shocked-at-phone",
      title: "Shocked At Phone",
    },
    {
      match: /^Woman_hand_on_chest_reaction_.*_1\.mp4$/i,
      slug: "taken-aback",
      title: "Taken Aback",
    },
    {
      match: /^Woman_touching_forehead_shock_.*\.mp4$/i,
      slug: "forehead-shock-reaction",
      title: "Forehead Shock Reaction",
    },
  ],
  emma: [
    {
      match: /^Avatar_excited_discovery_reaction_.*\.mp4$/i,
      slug: "excited-discovery-reaction",
      title: "Excited Discovery Reaction",
    },
    {
      match: /^Avatar_gives_satisfied_approval_.*\.mp4$/i,
      slug: "satisfied-approval",
      title: "Satisfied Approval",
    },
    {
      match: /^Avatar_happy_realization_product_.*\.mp4$/i,
      slug: "happy-realization-product",
      title: "Happy Realization Product",
    },
    {
      match: /^Avatar_impressed_wow_reaction_.*\.mp4$/i,
      slug: "impressed-wow-reaction",
      title: "Impressed Wow Reaction",
    },
    {
      match: /^Avatar_positive_shock_reaction_.*\.mp4$/i,
      slug: "positive-shock-reaction",
      title: "Positive Shock Reaction",
    },
    {
      match: /^Avatar_relieved_problem_solved_.*\.mp4$/i,
      slug: "relieved-problem-solved",
      title: "Relieved Problem Solved",
    },
    {
      match: /^Avatar_shows_silent_curiosity_.*\.mp4$/i,
      slug: "silent-curiosity",
      title: "Silent Curiosity",
    },
    {
      match: /^Confused_face_to_relieved_expres.*\.mp4$/i,
      slug: "confused-to-relieved",
      title: "Confused To Relieved",
    },
    {
      match: /^Same_video_same_emotion_.*\.mp4$/i,
      slug: "same-emotion-neutral",
      title: "Same Emotion Neutral",
    },
  ],
  kiara: [
    {
      match: /^Woman_covering_mouth_in_disbelief_.*\.mp4$/i,
      slug: "covering-mouth-in-disbelief",
      title: "Covering Mouth In Disbelief",
    },
    {
      match: /^Woman_sitting_on_sofa_shocked_.*\.mp4$/i,
      slug: "shocked-on-sofa",
      title: "Shocked On Sofa",
    },
    {
      match: /^Woman_with_confused_disbelief_ex_.*\.mp4$/i,
      slug: "confused-disbelief",
      title: "Confused Disbelief",
    },
  ],
  lewis: [
    {
      match: /^Man_reacts_to_laptop_screen_.*\.mp4$/i,
      slug: "shocked-by-laptop",
      title: "Shocked By Laptop",
    },
    {
      match: /^Man_sitting_chair_intense_wow_.*\.mp4$/i,
      slug: "intense-wow-reaction",
      title: "Intense Wow Reaction",
    },
    {
      match: /^Man_with_heavy_sad_emotion_.*\.mp4$/i,
      slug: "overwhelmed-with-sadness",
      title: "Overwhelmed With Sadness",
    },
  ],
  john: [
    {
      match: /^Recreate_emotion_different_avata_.*\.mp4$/i,
      slug: "surprised-to-skeptical",
      title: "Surprised To Skeptical",
    },
    {
      match: /^same_avatar_different_emotion_.*\.mp4$/i,
      slug: "surprised-to-delighted",
      title: "Surprised To Delighted",
    },
  ],
  harry: [
    {
      match: /^Man_reacts_with_intense_wow_.*\.mp4$/i,
      slug: "intense-wow-reaction",
      title: "Intense Wow Reaction",
    },
    {
      match: /^Man_shows_deadpan_disbelief_reac_.*\.mp4$/i,
      slug: "deadpan-disbelief",
      title: "Deadpan Disbelief",
    },
    {
      match: /^Man_shows_instant_regret_emotion_.*\.mp4$/i,
      slug: "instant-regret",
      title: "Instant Regret",
    },
    {
      match: /^Man_with_depressed_emotion_.*\.mp4$/i,
      slug: "downcast-and-defeated",
      title: "Downcast And Defeated",
    },
    {
      match: /^Man_with_social_battery_shutdown_.*\.mp4$/i,
      slug: "social-battery-drained",
      title: "Social Battery Drained",
    },
  ],
  maya: [
    {
      match: /^Avatar_impressed_wow_reaction_.*\.mp4$/i,
      slug: "impressed-wow-reaction",
      title: "Impressed Wow Reaction",
    },
    {
      match: /^Creator_looking_curious_at_camera_.*\.mp4$/i,
      slug: "curious-at-camera",
      title: "Curious At Camera",
    },
    {
      match: /^Creator_noticing_something_off-s_.*\.mp4$/i,
      slug: "noticing-something-off",
      title: "Noticing Something Off",
    },
    {
      match: /^Creator_showing_confusion_to_cla.*\.mp4$/i,
      slug: "confusion-to-clarity",
      title: "Confusion To Clarity",
    },
    {
      match: /^Creator_showing_impressed_delight_.*\.mp4$/i,
      slug: "impressed-delight",
      title: "Impressed Delight",
    },
    {
      match: /^Creator_showing_positive_shock_.*\.mp4$/i,
      slug: "positive-shock-reaction",
      title: "Positive Shock Reaction",
    },
    {
      match: /^Creator_showing_relief_and_smile_.*\.mp4$/i,
      slug: "relief-and-smile",
      title: "Relief And Smile",
    },
    {
      match: /^Creator_understanding_and_relief_.*\.mp4$/i,
      slug: "understanding-and-relief",
      title: "Understanding And Relief",
    },
  ],
  mitchell: [
    {
      match: /^Man_reacts_to_surprising_laptop_.*\.mp4$/i,
      slug: "surprised-by-laptop",
      title: "Surprised By Laptop",
    },
    {
      match: /^Man_shows_confused_disbelief_rea_.*\.mp4$/i,
      slug: "confused-disbelief",
      title: "Confused Disbelief",
    },
    {
      match: /^Man_shows_deadpan_disbelief_reac_.*\.mp4$/i,
      slug: "deadpan-disbelief",
      title: "Deadpan Disbelief",
    },
    {
      match: /^Man_sitting_chair_intense_wow_.*\.mp4$/i,
      slug: "intense-wow-reaction",
      title: "Intense Wow Reaction",
    },
    {
      match: /^Man_with_depressed_emotion_sitting_.*\.mp4$/i,
      slug: "downcast-and-defeated",
      title: "Downcast And Defeated",
    },
  ],
  mira: [
    {
      match: /^Avatar_recording_UGC_video_1080p_.* \(1\)\.mp4$/i,
      slug: "surprised-discovery-at-laptop",
      title: "Surprised Discovery At Laptop",
    },
    {
      match: /^Avatar_recording_UGC_video_1080p_.*\.mp4$/i,
      slug: "sudden-laptop-surprise",
      title: "Sudden Laptop Surprise",
    },
    {
      match: /^Female_avatar_awkward_reaction_.*\.mp4$/i,
      slug: "awkward-reaction",
      title: "Awkward Reaction",
    },
    {
      match: /^UGC_avatar_curiosity_intrigue_.*\.mp4$/i,
      slug: "curiosity-and-intrigue",
      title: "Curiosity And Intrigue",
    },
    {
      match: /^UGC_Human_Face_Texture_Lock_.*\.mp4$/i,
      slug: "surprised-realization",
      title: "Surprised Realization",
    },
    {
      match: /^Woman_laughing_at_phone_.*\.mp4$/i,
      slug: "laughing-at-phone",
      title: "Laughing At Phone",
    },
    {
      match: /^Woman_looking_at_laptop_.*\.mp4$/i,
      slug: "confused-at-laptop",
      title: "Confused At Laptop",
    },
    {
      match: /^Woman_reacting_with_surprise_.*\.mp4$/i,
      slug: "pleasant-surprise",
      title: "Pleasant Surprise",
    },
    {
      match: /^Woman_shocked_reaction_hand_head_.*\.mp4$/i,
      slug: "worried-shock-reaction",
      title: "Worried Shock Reaction",
    },
    {
      match: /^Woman_showing_skepticism_disbelief_.*\.mp4$/i,
      slug: "skepticism-and-disbelief",
      title: "Skepticism And Disbelief",
    },
    {
      match: /^Young_woman_laughing_silently_.*\.mp4$/i,
      slug: "silent-laugh",
      title: "Silent Laugh",
    },
  ],
  riya: [
    {
      match: /^Woman_curious_at_laptop_.*\.mp4$/i,
      slug: "curious-at-laptop",
      title: "Curious At Laptop",
    },
    {
      match: /^Woman_laughing_at_phone_.*\.mp4$/i,
      slug: "laughing-at-phone",
      title: "Laughing At Phone",
    },
    {
      match: /^Woman_shocked_reaction_hand_head_.*\.mp4$/i,
      slug: "worried-shock-reaction",
      title: "Worried Shock Reaction",
    },
    {
      match:
        /^Woman_showing_skepticism_disbelief_1080p_202607021026\.mp4$/i,
      slug: "skeptical-side-eye",
      title: "Skeptical Side Eye",
    },
    {
      match:
        /^Woman_showing_skepticism_disbelief_1080p_202607021027\.mp4$/i,
      slug: "doubtful-disbelief",
      title: "Doubtful Disbelief",
    },
  ],
  reed: [
    {
      match: /^Male_UGC_Prompt_2_202607021013\.mp4$/i,
      reason: "Near-duplicate of the newer 202607021452 clip.",
      skip: true,
    },
    {
      match: /^Male_UGC_Prompt_2_202607021452\.mp4$/i,
      slug: "concerned-reaction",
      title: "Concerned Reaction",
    },
    {
      match: /^Man_reacts_to_embarrassing_content_.*\.mp4$/i,
      slug: "embarrassed-reaction",
      title: "Embarrassed Reaction",
    },
    {
      match: /^Man_with_awkward_side-eye_.*\.mp4$/i,
      slug: "awkward-side-eye",
      title: "Awkward Side Eye",
    },
  ],
  sia: [
    {
      match: /^Female_avatar_shows_embarrassment_.*\.mp4$/i,
      slug: "embarrassed-reaction",
      title: "Embarrassed Reaction",
    },
    {
      match: /^Woman_reacting_with_shock_.*\.mp4$/i,
      slug: "shocked-and-concerned",
      title: "Shocked And Concerned",
    },
    {
      match: /^Woman_shocked_reaction_hand_head_.*\.mp4$/i,
      slug: "worried-shock-reaction",
      title: "Worried Shock Reaction",
    },
    {
      match: /^Woman_shocked_realization_hands_.*\.mp4$/i,
      slug: "shocked-realization",
      title: "Shocked Realization",
    },
    {
      match: /^Woman_with_sad_disappointed_concern_.*\.mp4$/i,
      slug: "sad-disappointment",
      title: "Sad Disappointment",
    },
  ],
  talia: [
    {
      match: /^Woman_covering_mouth_in_disbelief_.*\.mp4$/i,
      slug: "covering-mouth-in-disbelief",
      title: "Covering Mouth In Disbelief",
    },
    {
      match: /^Woman_hand_on_chest_reaction_.*\.mp4$/i,
      slug: "startled-hand-on-chest",
      title: "Startled Hand On Chest",
    },
    {
      match: /^Woman_sitting_on_sofa_shocked_.*\.mp4$/i,
      slug: "worried-on-sofa",
      title: "Worried On Sofa",
    },
    {
      match: /^Woman_stunned_on_sofa_.*\.mp4$/i,
      slug: "stunned-by-phone",
      title: "Stunned By Phone",
    },
  ],
};

loadEnvFile(resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const folder = resolve(args.folder || DEFAULT_EMMA_FOLDER);
const avatarKey = sanitizeSlug(args.avatarKey || DEFAULT_AVATAR_KEY);
const avatarLabel = args.avatarLabel || DEFAULT_AVATAR_LABEL;
const expectedCount = getPositiveInteger(
  args.expectedCount,
  DEFAULT_EXPECTED_COUNT,
);
const durationSeconds = getOptionalPositiveNumber(
  args.durationSeconds,
  DEFAULT_DURATION_SECONDS,
);
const ratio = getAvatarRatio(args.ratio || DEFAULT_RATIO);
const probeMetadata = Boolean(args.probeMetadata);
const execute = Boolean(args.execute);
const dryRun = !execute || Boolean(args.dryRun);

if (execute && !args.yes) {
  throw new Error(
    "Refusing to upload without --yes. Run dry-run first, then use --execute --yes.",
  );
}

assertRequiredEnvVars([
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_S3_BUCKET",
  "CLOUDFRONT_DOMAIN",
  "SUPABASE_SERVICE_ROLE_KEY",
]);
assertOneRequiredEnvVar(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);

const uploadPlan = buildUploadPlan({
  avatarKey,
  avatarLabel,
  durationSeconds,
  expectedCount,
  folder,
  probeMetadata,
  ratio,
});

printPlan(uploadPlan, { dryRun, execute });

if (dryRun) {
  console.log("");
  console.log("Dry run complete. No S3 upload or Supabase write was performed.");
  process.exit(0);
}

const s3 = new S3Client({
  credentials: {
    accessKeyId: getRequiredEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
  },
  region: getRequiredEnv("AWS_REGION"),
});
const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

for (const item of uploadPlan.items) {
  await uploadAvatarAsset(item);
}

console.log("");
console.log(`Uploaded and registered ${uploadPlan.items.length} avatar assets.`);

async function uploadAvatarAsset(item) {
  const existing = await findExistingAvatarAsset(item.s3Key);

  if (existing) {
    console.log(`SKIP existing Supabase row: ${item.s3Key}`);
    return;
  }

  console.log(`Uploading ${item.localFileName}`);
  const thumbnail = createAvatarThumbnail(item);

  try {
    await s3.send(
      new PutObjectCommand({
        Body: createReadStream(item.localPath),
        Bucket: getRequiredEnv("AWS_S3_BUCKET"),
        CacheControl: "public, max-age=31536000, immutable",
        ContentType: "video/mp4",
        Key: item.s3Key,
      }),
    );

    await s3.send(
      new PutObjectCommand({
        Body: thumbnail.buffer,
        Bucket: getRequiredEnv("AWS_S3_BUCKET"),
        CacheControl: "public, max-age=31536000, immutable",
        ContentType: "image/webp",
        Key: item.thumbnailS3Key,
      }),
    );
  } finally {
    rmSync(thumbnail.tempDir, { force: true, recursive: true });
  }

  const { error } = await supabase.from("avatar_assets").insert({
    avatar_type: "global",
    description: item.description,
    duration_seconds: item.durationSeconds,
    height: item.height,
    metadata: item.metadata,
    name: item.name,
    ratio: item.ratio,
    sort_order: item.sortOrder,
    source_s3_key: item.s3Key,
    source_video_url: item.cloudFrontUrl,
    status: "ready",
    thumbnail_url: item.thumbnailCloudFrontUrl,
    width: item.width,
  });

  if (error) {
    throw new Error(`Could not register ${item.s3Key}: ${error.message}`);
  }

  console.log(`Registered ${item.name}`);
}

async function findExistingAvatarAsset(s3Key) {
  const { data, error } = await supabase
    .from("avatar_assets")
    .select("id, source_s3_key")
    .eq("source_s3_key", s3Key)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not check existing avatar asset: ${error.message}`);
  }

  return data;
}

function buildUploadPlan({
  avatarKey,
  avatarLabel,
  durationSeconds,
  expectedCount,
  folder,
  probeMetadata,
  ratio,
}) {
  if (!existsSync(folder)) {
    throw new Error(`Avatar source folder does not exist: ${folder}`);
  }

  const stats = statSync(folder);

  if (!stats.isDirectory()) {
    throw new Error(`Avatar source path is not a folder: ${folder}`);
  }

  const files = readdirSync(folder, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => join(folder, entry.name))
    .filter((filePath) => extname(filePath).toLowerCase() === ".mp4")
    .sort((a, b) => basename(a).localeCompare(basename(b)));

  if (files.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} MP4 files inside ${folder}, found ${files.length}.`,
    );
  }

  const skippedFiles = [];
  const mappedFiles = [];

  for (const filePath of files) {
    const fileName = basename(filePath);
    const mapping = getFileMapping(fileName, avatarKey);

    if (!mapping) {
      throw new Error(
        `No safe filename mapping found for ${fileName}. Add it to the "${avatarKey}" avatar mapping before upload.`,
      );
    }

    if (mapping.skip) {
      skippedFiles.push({
        fileName,
        reason: mapping.reason || "Excluded by the avatar mapping.",
      });
      continue;
    }

    mappedFiles.push({ filePath, mapping });
  }

  const items = mappedFiles.map(({ filePath, mapping }, index) =>
    buildUploadPlanItem({
      avatarKey,
      avatarLabel,
      durationSeconds,
      filePath,
      mapping,
      probeMetadata,
      ratio,
      sortOrder: index,
    }),
  );
  const duplicateSlugs = getDuplicates(items.map((item) => item.slug));

  if (duplicateSlugs.length > 0) {
    throw new Error(`Duplicate avatar slugs: ${duplicateSlugs.join(", ")}`);
  }

  return {
    avatarKey,
    avatarLabel,
    folder,
    items,
    skippedFiles,
  };
}

function buildUploadPlanItem({
  avatarKey,
  avatarLabel,
  durationSeconds,
  filePath,
  mapping,
  probeMetadata,
  ratio,
  sortOrder,
}) {
  const fileName = basename(filePath);
  const fileSize = statSync(filePath).size;
  const videoMetadata = probeMetadata ? probeVideoMetadata(filePath) : null;

  if (fileSize <= 0) {
    throw new Error(`Avatar video is empty: ${fileName}`);
  }

  if (fileSize > MAX_AVATAR_UPLOAD_BYTES) {
    throw new Error(`Avatar video is too large: ${fileName}`);
  }

  const s3Key = `avatars/global/${avatarKey}/${mapping.slug}.mp4`;
  const thumbnailS3Key = `avatars/thumbnails/${avatarKey}/${mapping.slug}.webp`;

  return {
    cloudFrontUrl: buildCloudFrontUrl(s3Key),
    description: `${avatarLabel} avatar clip for ${mapping.title.toLowerCase()}.`,
    durationSeconds: videoMetadata?.durationSeconds ?? durationSeconds,
    height: videoMetadata?.height ?? null,
    localFileName: fileName,
    localPath: filePath,
    metadata: {
      avatar: avatarKey,
      emotion: mapping.slug,
      sourceFileName: fileName,
      uploadSource: "admin-script",
    },
    name: `${avatarLabel} - ${mapping.title}`,
    ratio,
    s3Key,
    sizeBytes: fileSize,
    slug: mapping.slug,
    thumbnailCloudFrontUrl: buildCloudFrontUrl(thumbnailS3Key),
    thumbnailS3Key,
    sortOrder,
    width: videoMetadata?.width ?? null,
  };
}

function createAvatarThumbnail(item) {
  const tempDir = mkdtempSync(join(tmpdir(), "ugc-avatar-thumb-"));
  const outputPath = join(tempDir, `${item.slug}.webp`);
  const ffmpegExecutable = ffmpegPath || "ffmpeg";
  const seekSeconds = getThumbnailSeekSeconds(item.durationSeconds);

  try {
    execFileSync(
      ffmpegExecutable,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        String(seekSeconds),
        "-i",
        item.localPath,
        "-frames:v",
        "1",
        "-vf",
        `scale=${AVATAR_THUMBNAIL_WIDTH}:${AVATAR_THUMBNAIL_HEIGHT}:force_original_aspect_ratio=decrease,pad=${AVATAR_THUMBNAIL_WIDTH}:${AVATAR_THUMBNAIL_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`,
        "-c:v",
        "libwebp",
        "-quality",
        "82",
        "-preset",
        "picture",
        "-y",
        outputPath,
      ],
      { stdio: "pipe" },
    );
  } catch (error) {
    rmSync(tempDir, { force: true, recursive: true });
    throw new Error(
      `Could not create thumbnail for ${item.localFileName}: ${error.message}`,
    );
  }

  return {
    buffer: readFileSync(outputPath),
    tempDir,
  };
}

function getThumbnailSeekSeconds(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0.8;
  }

  return Math.min(1.5, Math.max(0.25, durationSeconds * 0.3));
}

function probeVideoMetadata(filePath) {
  let output;

  try {
    output = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height:format=duration",
        "-of",
        "json",
        filePath,
      ],
      { encoding: "utf8" },
    );
  } catch (error) {
    throw new Error(
      `Could not inspect ${basename(filePath)} with ffprobe: ${error.message}`,
    );
  }

  const result = JSON.parse(output);
  const stream = result.streams?.[0];
  const durationSeconds = Number(result.format?.duration);
  const width = Number(stream?.width);
  const height = Number(stream?.height);

  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0
  ) {
    throw new Error(`ffprobe returned invalid metadata for ${basename(filePath)}.`);
  }

  return { durationSeconds, height, width };
}

function getFileMapping(fileName, avatarKey) {
  return AVATAR_FILE_MAPPINGS[avatarKey]?.find((mapping) =>
    mapping.match.test(fileName),
  );
}

function printPlan(plan, { dryRun, execute }) {
  console.log("Avatar asset upload plan");
  console.log(`Mode: ${dryRun ? "dry-run" : "execute"}`);
  console.log(`Folder: ${plan.folder}`);
  console.log(`Avatar: ${plan.avatarLabel} (${plan.avatarKey})`);
  console.log(`Supabase project: ${getSupabaseProjectRef()}`);
  console.log(`S3 bucket: ${getRequiredEnv("AWS_S3_BUCKET")}`);
  console.log(`Count: ${plan.items.length}`);

  if (plan.skippedFiles.length > 0) {
    console.log(`Skipped duplicates: ${plan.skippedFiles.length}`);

    for (const skipped of plan.skippedFiles) {
      console.log(`   ${skipped.fileName}: ${skipped.reason}`);
    }
  }

  console.log("");

  for (const item of plan.items) {
    console.log(`${item.sortOrder + 1}. ${item.localFileName}`);
    console.log(`   Name: ${item.name}`);
    console.log(`   S3: ${item.s3Key}`);
    console.log(`   Thumbnail: ${item.thumbnailS3Key}`);
    console.log(`   URL: ${item.cloudFrontUrl}`);
    console.log(
      `   Metadata: duration=${item.durationSeconds ?? "null"} dimensions=${
        item.width && item.height ? `${item.width}x${item.height}` : "unknown"
      } ratio=${item.ratio} size=${formatBytes(
        item.sizeBytes,
      )}`,
    );
  }

  if (execute) {
    console.log("");
    console.log("Execution requested with --execute --yes.");
  }
}

function parseArgs(rawArgs) {
  const parsed = {
    avatarKey: "",
    avatarLabel: "",
    dryRun: false,
    durationSeconds: "",
    execute: false,
    expectedCount: "",
    folder: "",
    ratio: "",
    probeMetadata: false,
    yes: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--execute") {
      parsed.execute = true;
      continue;
    }

    if (arg === "--yes") {
      parsed.yes = true;
      continue;
    }

    if (arg === "--probe-metadata") {
      parsed.probeMetadata = true;
      continue;
    }

    if (arg === "--folder") {
      parsed.folder = rawArgs[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--avatar-key") {
      parsed.avatarKey = rawArgs[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--avatar-label") {
      parsed.avatarLabel = rawArgs[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--expected-count") {
      parsed.expectedCount = rawArgs[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--duration-seconds") {
      parsed.durationSeconds = rawArgs[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--ratio") {
      parsed.ratio = rawArgs[index + 1] ?? "";
      index += 1;
    }
  }

  return parsed;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    process.env[key] = cleanEnvValue(rawValue);
  }
}

function cleanEnvValue(rawValue) {
  const value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function assertRequiredEnvVars(names) {
  const missing = names.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

function assertOneRequiredEnvVar(names) {
  if (!names.some((name) => process.env[name]?.trim())) {
    throw new Error(`Missing required env var: ${names.join(" or ")}`);
  }
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required env var: ${names.join(" or ")}`);
}

function getPositiveInteger(value, fallback) {
  const parsed = Number(value || fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }

  return parsed;
}

function getOptionalPositiveNumber(value, fallback) {
  const rawValue = value || fallback;
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive number, got ${rawValue}`);
  }

  return parsed;
}

function getAvatarRatio(value) {
  const allowedRatios = new Set(["9:16", "1:1", "4:5", "16:9", "other"]);

  if (!allowedRatios.has(value)) {
    throw new Error(`Unsupported avatar ratio: ${value}`);
  }

  return value;
}

function sanitizeSlug(value) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Avatar key is required.");
  }

  return slug;
}

function buildCloudFrontUrl(key) {
  const cloudFrontDomain = getRequiredEnv("CLOUDFRONT_DOMAIN");
  const domainWithScheme = /^https?:\/\//i.test(cloudFrontDomain)
    ? cloudFrontDomain
    : `https://${cloudFrontDomain}`;

  return `${domainWithScheme.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

function getSupabaseProjectRef() {
  try {
    return new URL(
      getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    ).host.split(".")[0];
  } catch {
    return "unknown";
  }
}

function getDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return Array.from(duplicates);
}

function formatBytes(bytes) {
  const megabytes = bytes / (1024 * 1024);

  return `${megabytes.toFixed(2)} MB`;
}
