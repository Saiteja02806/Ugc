import { createClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  buildPublicStorageUrl,
  getMissingStorageEnvVars,
  getStorageProviderName,
  headStorageObject,
  uploadBufferToStorage,
} from "../lib/storage/storage.ts";

const DEFAULT_ROOT = "D:\\new";
const DEFAULT_MANIFEST =
  "scripts/data/wall-instagram-reel-templates-2026-08-14.json";
const RESULT_ROOT = ".tmp/wall-instagram-reel-template-import";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const FORMAT_IDS = new Set([
  "hidden_alternative", "manual_automatic", "secret_advantage",
  "outcome_mystery", "authority_reaction", "personal_obsession",
  "numbered_curiosity", "rule_checklist", "hidden_cause",
  "contrarian_opinion", "niche_pov", "community_question",
  "transformation_timeframe", "method_framework", "emotional_reframe",
  "personal_manifesto", "relatable_situation", "desire_identity_stack",
  "old_way_regret", "retrospective_lesson", "self_audit",
  "warning_alert", "personal_stance", "future_snapshot",
  "metaphor_reframe", "swap_upgrade_stack", "niche_milestones",
  "insider_truths", "aspirational_archetype", "internal_conflict",
]);
const ZONE_BOXES = Object.freeze({
  "upper-middle": {
    height: 480 / 1920,
    width: 660 / 1080,
    x: 210 / 1080,
    y: 560 / 1920,
  },
  middle: {
    height: 480 / 1920,
    width: 660 / 1080,
    x: 210 / 1080,
    y: 660 / 1920,
  },
  "lower-middle": {
    height: 480 / 1920,
    width: 660 / 1080,
    x: 210 / 1080,
    y: 800 / 1920,
  },
});
const NULL_OUTPUT = process.platform === "win32" ? "NUL" : "/dev/null";

loadEnvFile(path.resolve(".env.local"));
const args = parseArgs(process.argv.slice(2));
const execute = Boolean(args.execute);
const prepare = Boolean(args.prepare);
const verify = Boolean(args.verify);
const root = path.resolve(String(args.root || DEFAULT_ROOT));
const manifestPath = path.resolve(String(args.manifest || DEFAULT_MANIFEST));

if ([execute, prepare, verify].filter(Boolean).length > 1) {
  throw new Error("Choose only one mode: --prepare, --execute, or --verify.");
}
if (execute && !args.yes) {
  throw new Error(
    "Refusing to upload without --yes. Run the dry-run first, then use --execute --yes.",
  );
}
if (!ffmpegPath || !ffprobeStatic?.path) {
  throw new Error("Bundled FFmpeg and FFprobe are required.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const plan = buildPlan({ manifest, root });
printPlan({ execute, manifestPath, plan, prepare, root, verify });

if (!execute && !prepare && !verify) {
  console.log("Dry run complete. No GCP object or Supabase row was changed.");
  process.exit(0);
}

if (prepare) {
  const prepared = plan.items.map((item, index) => {
    console.log(`[${index + 1}/${plan.items.length}] Preparing ${item.template.templateKey}`);
    const output = prepareItem(item, manifest.audioNormalization);
    const fitMode = getDirectFitMode(
      output.audio.durationSeconds,
      output.video.durationSeconds,
    );
    return {
      audioFitMode: fitMode,
      approvedAudioFitMode: item.template.audioFitMode,
      audioStreamCount: output.video.audioStreamCount,
      durationSeconds: output.video.durationSeconds,
      measuredIntegratedLufs: output.audio.measuredIntegratedLufs,
      measuredTruePeakDb: output.audio.measuredTruePeakDb,
      templateKey: item.template.templateKey,
    };
  });
  const mismatches = prepared.filter(
    (item) => item.audioFitMode !== item.approvedAudioFitMode,
  );
  writeResult("prepare", {
    completedAt: new Date().toISOString(),
    prepared,
    sourceBatch: manifest.sourceBatch,
  });
  if (mismatches.length > 0) {
    throw new Error(
      `Prepared audio fit differs from the reviewed manifest: ${mismatches
        .map(
          (item) =>
            `${item.templateKey}:${item.approvedAudioFitMode}->${item.audioFitMode ?? "unusable"}`,
        )
        .join(", ")}.`,
    );
  }
  console.log(
    `Prepared ${prepared.length} silent videos and normalized locked audio files. No remote object or database row was changed.`,
  );
  process.exit(0);
}

assertRuntimeReady();
const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);
await assertRemoteSchemaReady();

if (verify) {
  const verified = await verifyRemote(plan.items);
  writeResult("verify", { verified });
  console.log(`Verified ${verified.length} Instagram Reel Wall templates.`);
  process.exit(0);
}

const result = {
  imported: [],
  sourceBatch: manifest.sourceBatch,
  startedAt: new Date().toISOString(),
};

try {
  for (const [index, item] of plan.items.entries()) {
    console.log(`[${index + 1}/${plan.items.length}] ${item.template.templateKey}`);
    const prepared = prepareItem(item, manifest.audioNormalization);
    const fitMode = getDirectFitMode(
      prepared.audio.durationSeconds,
      prepared.video.durationSeconds,
    );
    if (fitMode !== item.template.audioFitMode) {
      throw new Error(
        `${item.template.templateKey} normalized audio fit changed from ${item.template.audioFitMode} to ${fitMode ?? "unusable"}.`,
      );
    }

    await Promise.all([
      uploadBufferToStorage({
        buffer: readFileSync(prepared.video.path),
        cacheControl: CACHE_CONTROL,
        contentType: "video/mp4",
        key: item.videoKey,
      }),
      uploadBufferToStorage({
        buffer: readFileSync(prepared.thumbnailPath),
        cacheControl: CACHE_CONTROL,
        contentType: "image/webp",
        key: item.thumbnailKey,
      }),
      uploadBufferToStorage({
        buffer: readFileSync(prepared.audio.path),
        cacheControl: CACHE_CONTROL,
        contentType: "audio/mpeg",
        key: item.audioKey,
      }),
    ]);
    await verifyStoredObjects(item, prepared);

    const overlayId = await ensureOverlayAsset(item, prepared.video);
    await ensureLockedAudioAsset(item, prepared.audio);
    const templateId = await ensureTemplate(item, overlayId);
    result.imported.push({
      audioAssetId: item.template.audioAssetId,
      overlayMediaAssetId: overlayId,
      templateId,
      templateKey: item.template.templateKey,
    });
  }

  result.completedAt = new Date().toISOString();
  result.verification = await verifyRemote(plan.items);
  writeResult("execute", result);
  console.log(`Imported and verified ${result.imported.length} templates.`);
} catch (error) {
  writeResult("failed", {
    ...result,
    failedAt: new Date().toISOString(),
    failure: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

function buildPlan({ manifest: value, root: sourceRoot }) {
  assertManifest(value);
  if (!existsSync(sourceRoot)) {
    throw new Error(`Instagram Reel bundle root does not exist: ${sourceRoot}`);
  }
  const actualFolders = readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(numericCompare);
  const expectedFolders = value.templates
    .map((template) => template.folder)
    .sort(numericCompare);
  if (JSON.stringify(actualFolders) !== JSON.stringify(expectedFolders)) {
    throw new Error("Instagram Reel bundle folders do not match the manifest.");
  }

  const items = value.templates.map((template) => {
    const folderPath = path.resolve(sourceRoot, template.folder);
    assertPathWithin(sourceRoot, folderPath);
    const expectedFiles = [
      template.videoFile,
      template.audioFile,
      template.referenceFile,
      template.linkFile,
    ].sort();
    const actualFiles = readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      throw new Error(`${template.templateKey} does not contain its exact four reviewed files.`);
    }

    const videoPath = path.join(folderPath, template.videoFile);
    const audioPath = path.join(folderPath, template.audioFile);
    const referencePath = path.join(folderPath, template.referenceFile);
    const linkPath = path.join(folderPath, template.linkFile);
    assertHash(videoPath, template.videoSha256, `${template.templateKey} video`);
    assertHash(audioPath, template.audioSha256, `${template.templateKey} audio`);
    const referenceText = normalizeText(readFileSync(referencePath, "utf8"));
    if (sha256(referenceText) !== template.referenceTextHash) {
      throw new Error(`${template.templateKey} reference text changed.`);
    }
    const instagramReferenceUrl = readFileSync(linkPath, "utf8").trim();
    if (canonicalizeInstagramUrl(instagramReferenceUrl) !== template.canonicalReferenceUrl) {
      throw new Error(`${template.templateKey} Instagram URL changed.`);
    }

    const video = probeMedia(videoPath);
    const audio = probeMedia(audioPath);
    if (
      video.width * 16 !== video.height * 9 ||
      video.durationSeconds < 6 ||
      video.durationSeconds > 60 ||
      video.videoStreamCount !== 1 ||
      video.audioStreamCount < 1
    ) {
      throw new Error(`${template.templateKey} source video is not an audio-bearing 9:16 clip.`);
    }
    if (audio.audioStreamCount !== 1 || audio.videoStreamCount !== 0) {
      throw new Error(`${template.templateKey} MP3 is invalid.`);
    }
    const rawFitMode = getDirectFitMode(
      audio.durationSeconds,
      video.durationSeconds,
    );
    if (
      rawFitMode === null ||
      (template.audioFitMode === "exact" && rawFitMode !== "exact")
    ) {
      throw new Error(`${template.templateKey} reviewed duration fit no longer matches.`);
    }

    const keyRoot = `overlay-media/wall-text/${value.sourceBatch}`;
    const audioKey = `audio/wall-text/instagram-reel/${template.templateKey}-${template.audioSha256.slice(0, 12)}.mp3`;
    const thumbnailKey = `${keyRoot}/thumbnails/${template.templateKey}-${template.videoSha256.slice(0, 12)}.webp`;
    const videoKey = `${keyRoot}/videos/${template.templateKey}-${template.videoSha256.slice(0, 12)}.mp4`;
    return {
      audioKey,
      audioPath,
      audioUrl: buildPublicStorageUrl(audioKey),
      instagramReferenceUrl,
      referenceText,
      safeTextBox: ZONE_BOXES[template.placement],
      template,
      thumbnailKey,
      thumbnailUrl: buildPublicStorageUrl(thumbnailKey),
      video,
      videoKey,
      videoPath,
      videoUrl: buildPublicStorageUrl(videoKey),
    };
  });

  assertUnique(items.map((item) => item.template.templateKey), "template key");
  assertUnique(items.map((item) => item.template.audioAssetId), "audio asset ID");
  assertUnique(items.map((item) => item.template.videoSha256), "video hash");
  assertUnique(items.map((item) => item.template.audioSha256), "audio source hash");
  assertUnique(items.map((item) => item.template.canonicalReferenceUrl), "Instagram URL");
  return { items };
}

function assertManifest(value) {
  if (
    value.schemaVersion !== "wall-instagram-reel-template-manifest-v1" ||
    value.sourceVideoAudioPolicy !== "required-and-stripped-before-upload" ||
    !value.sourceBatch?.trim() ||
    !value.reviewedAt ||
    !Array.isArray(value.templates) ||
    value.templates.length !== 15
  ) {
    throw new Error("Instagram Reel Wall manifest is invalid.");
  }
  if (
    value.audioNormalization?.integratedLufs !== -14 ||
    value.audioNormalization?.truePeakDb !== -2.2 ||
    value.audioNormalization?.maximumMeasuredTruePeakDb !== -1.5 ||
    value.audioNormalization?.sampleRateHz !== 48000 ||
    value.audioNormalization?.channels !== 2 ||
    value.audioNormalization?.bitrate !== "192k"
  ) {
    throw new Error("Instagram Reel audio normalization policy is invalid.");
  }
  for (const template of value.templates) {
    if (
      !/^instagram_reel_[0-9]{3}$/u.test(template.templateKey) ||
      !/^audio_[0-9]{3}$/u.test(template.audioAssetId) ||
      !/^\d+$/u.test(template.folder) ||
      !/^[a-f0-9]{64}$/u.test(template.videoSha256) ||
      !/^[a-f0-9]{64}$/u.test(template.audioSha256) ||
      !/^[a-f0-9]{64}$/u.test(template.referenceTextHash) ||
      !FORMAT_IDS.has(template.writerFormatId) ||
      !(template.placement in ZONE_BOXES) ||
      !["exact", "trim"].includes(template.audioFitMode)
    ) {
      throw new Error(`Invalid template manifest entry: ${template.templateKey ?? "unknown"}.`);
    }
  }
}

function prepareItem(item, normalization) {
  const outputDirectory = path.resolve(RESULT_ROOT, item.template.templateKey);
  mkdirSync(outputDirectory, { recursive: true });
  const silentVideoPath = path.join(outputDirectory, "silent-video.mp4");
  const thumbnailPath = path.join(outputDirectory, "thumbnail.webp");
  const normalizedAudioPath = path.join(outputDirectory, "normalized-audio.mp3");

  run(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-i", item.videoPath, "-map", "0:v:0", "-c:v", "copy", "-an",
    "-movflags", "+faststart", silentVideoPath,
  ]);
  run(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-ss", String(Math.min(2, item.video.durationSeconds * 0.35)),
    "-i", silentVideoPath, "-frames:v", "1",
    "-vf", "scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1",
    "-c:v", "libwebp", "-quality", "82", thumbnailPath,
  ]);
  const audio = normalizeAudio({
    inputPath: item.audioPath,
    normalization,
    outputPath: normalizedAudioPath,
  });
  const video = probeMedia(silentVideoPath);
  if (video.audioStreamCount !== 0 || video.videoStreamCount !== 1) {
    throw new Error(`${item.template.templateKey} prepared video is not silent.`);
  }
  return { audio, thumbnailPath, video: { ...video, path: silentVideoPath } };
}

function normalizeAudio({ inputPath, normalization, outputPath }) {
  const firstPass = measureLoudness(inputPath, normalization);
  const loudnorm = [
    `loudnorm=I=${normalization.integratedLufs}`,
    `TP=${normalization.truePeakDb}`,
    "LRA=11",
    `measured_I=${firstPass.input_i}`,
    `measured_TP=${firstPass.input_tp}`,
    `measured_LRA=${firstPass.input_lra}`,
    `measured_thresh=${firstPass.input_thresh}`,
    `offset=${firstPass.target_offset}`,
    "linear=true",
    "print_format=summary",
  ].join(":");
  const filters = `${loudnorm},aresample=${normalization.sampleRateHz}`;
  run(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-i", inputPath, "-vn", "-af", filters,
    "-ar", String(normalization.sampleRateHz),
    "-ac", String(normalization.channels),
    "-c:a", "libmp3lame", "-b:a", normalization.bitrate, outputPath,
  ]);
  const probe = probeMedia(outputPath);
  const measured = measureLoudness(outputPath, normalization);
  if (
    Math.abs(Number(measured.input_i) - normalization.integratedLufs) >
      normalization.maximumIntegratedLufsError ||
    Number(measured.input_tp) > normalization.maximumMeasuredTruePeakDb
  ) {
    throw new Error(`Normalized audio missed the production loudness standard: ${inputPath}`);
  }
  return {
    durationSeconds: probe.durationSeconds,
    measuredIntegratedLufs: Number(measured.input_i),
    measuredTruePeakDb: Number(measured.input_tp),
    path: outputPath,
    sha256: hashFile(outputPath),
    sizeBytes: statSync(outputPath).size,
  };
}

function measureLoudness(inputPath, normalization) {
  const result = run(ffmpegPath, [
    "-hide_banner", "-nostats", "-nostdin", "-i", inputPath, "-vn",
    "-af", `loudnorm=I=${normalization.integratedLufs}:TP=${normalization.truePeakDb}:LRA=11:print_format=json`,
    "-f", "null", NULL_OUTPUT,
  ]);
  const matches = result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/gu);
  if (!matches?.length) throw new Error(`Could not measure loudness: ${inputPath}`);
  return JSON.parse(matches.at(-1));
}

async function ensureOverlayAsset(item, video) {
  const { data: existing, error: lookupError } = await supabase
    .from("overlay_media_assets")
    .select("id,s3_key,thumbnail_s3_key,wall_text_source_kind")
    .eq("source_file_sha256", item.template.videoSha256)
    .maybeSingle();
  if (lookupError) throw new Error(`Could not check ${item.template.templateKey} video: ${lookupError.message}`);
  if (existing) {
    if (
      existing.s3_key !== item.videoKey ||
      existing.thumbnail_s3_key !== item.thumbnailKey ||
      existing.wall_text_source_kind !== "instagram_reel"
    ) {
      throw new Error(`${item.template.templateKey} video conflicts with an existing asset.`);
    }
    return existing.id;
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("overlay_media_assets").insert({
    analysis_model: "manual-reviewed-instagram-template-v1",
    analysis_status: "succeeded",
    analyzed_at: now,
    aspect_ratio: "9:16",
    asset_type: "video",
    content_type: "video/mp4",
    duration_seconds: video.durationSeconds,
    file_size_bytes: statSync(video.path).size,
    format_family: "wall_text_overlay",
    generic_profiles: [],
    height: video.height,
    metadata_schema_version: "overlay_asset_metadata_v1",
    motion_level: "low",
    placement_analysis: {
      contrastScore: 0.5,
      faceBoxes: [],
      faceOverlap: 0,
      importantRegions: [],
      selectedZone: item.template.placement,
      version: "wall-text-placement-v2",
    },
    preview_url: item.videoUrl,
    primary_profiles: [],
    readability_score: 1,
    recommended_position: "center",
    s3_key: item.videoKey,
    source_batch: manifest.sourceBatch,
    source_file_name: item.template.videoFile,
    source_file_sha256: item.template.videoSha256,
    source_type: "owned",
    status: "active",
    text_capacity: "high",
    thumbnail_s3_key: item.thumbnailKey,
    thumbnail_url: item.thumbnailUrl,
    updated_at: now,
    use_case_tags: [],
    visual_group: item.template.templateKey,
    wall_text_source_kind: "instagram_reel",
    width: video.width,
  }).select("id").single();
  if (error || !data) throw new Error(`Could not save ${item.template.templateKey} video: ${error?.message ?? "no row"}`);
  return data.id;
}

async function ensureLockedAudioAsset(item, audio) {
  const { data: existing, error: lookupError } = await supabase
    .from("wall_audio_assets")
    .select("id,sha256,storage_key,selection_scope")
    .eq("id", item.template.audioAssetId)
    .maybeSingle();
  if (lookupError) throw new Error(`Could not check ${item.template.audioAssetId}: ${lookupError.message}`);
  if (existing) {
    if (
      existing.sha256 !== audio.sha256 ||
      existing.storage_key !== item.audioKey ||
      existing.selection_scope !== "instagram_reel_locked"
    ) {
      throw new Error(`${item.template.audioAssetId} conflicts with existing audio.`);
    }
    return;
  }
  const { error } = await supabase.from("wall_audio_assets").insert({
    audio_url: item.audioUrl,
    cue_start_seconds: 0,
    duration_seconds: audio.durationSeconds,
    energy: null,
    file_size_bytes: audio.sizeBytes,
    id: item.template.audioAssetId,
    loopable: false,
    measured_integrated_lufs: audio.measuredIntegratedLufs,
    measured_true_peak_db: audio.measuredTruePeakDb,
    message_types: [],
    moods: [],
    preparation_version: "wall-instagram-reel-audio-v1",
    review_notes: `Locked to ${item.template.templateKey}; not eligible for dynamic matching.`,
    review_status: "approved",
    reviewed_at: manifest.reviewedAt,
    schema_version: "wall-audio-library-v2",
    selection_scope: "instagram_reel_locked",
    sha256: audio.sha256,
    source_audio_id: item.template.audioAssetId,
    source_end_seconds: audio.durationSeconds,
    source_start_seconds: 0,
    status: "active",
    storage_key: item.audioKey,
    storage_provider: "gcp",
    tagging_version: "not-applicable-locked-template-v1",
  });
  if (error) throw new Error(`Could not save ${item.template.audioAssetId}: ${error.message}`);
}

async function ensureTemplate(item, overlayId) {
  const row = {
    audio_fit_mode: item.template.audioFitMode,
    canonical_reference_url: item.template.canonicalReferenceUrl,
    import_batch: manifest.sourceBatch,
    instagram_reference_url: item.instagramReferenceUrl,
    locked_audio_asset_id: item.template.audioAssetId,
    overlay_media_asset_id: overlayId,
    reference_text: item.referenceText,
    reference_text_hash: item.template.referenceTextHash,
    safe_text_box: item.safeTextBox,
    status: "active",
    template_key: item.template.templateKey,
    template_version: 1,
    writer_format_id: item.template.writerFormatId,
  };
  const { data: existing, error: lookupError } = await supabase
    .from("wall_text_instagram_reel_templates")
    .select("*")
    .eq("template_key", item.template.templateKey)
    .maybeSingle();
  if (lookupError) throw new Error(`Could not check ${item.template.templateKey}: ${lookupError.message}`);
  if (existing) {
    for (const [key, value] of Object.entries(row)) {
      if (JSON.stringify(existing[key]) !== JSON.stringify(value)) {
        throw new Error(`${item.template.templateKey} conflicts on ${key}.`);
      }
    }
    return existing.id;
  }
  const { data, error } = await supabase
    .from("wall_text_instagram_reel_templates")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not save ${item.template.templateKey}: ${error?.message ?? "no row"}`);
  return data.id;
}

async function assertRemoteSchemaReady() {
  const [templates, audio, videos] = await Promise.all([
    supabase.from("wall_text_instagram_reel_templates").select("id,writer_format_id").limit(1),
    supabase.from("wall_audio_assets").select("id,selection_scope").limit(1),
    supabase.from("overlay_media_assets").select("id,wall_text_source_kind").limit(1),
  ]);
  const failure = [templates.error, audio.error, videos.error].find(Boolean);
  if (failure) throw new Error(`Remote Instagram Reel Wall schema is not ready: ${failure.message}`);
}

async function verifyRemote(items) {
  const verified = [];
  for (const item of items) {
    const [{ data, error }, { data: audio, error: audioError }] = await Promise.all([
      supabase
        .from("wall_text_instagram_reel_templates")
        .select("id,status,template_version,writer_format_id,reference_text_hash,audio_fit_mode,locked_audio_asset_id,overlay_media_asset_id")
        .eq("template_key", item.template.templateKey)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("wall_audio_assets")
        .select("id,status,review_status,selection_scope,loopable,duration_seconds,cue_start_seconds")
        .eq("id", item.template.audioAssetId)
        .maybeSingle(),
    ]);
    if (
      error ||
      !data ||
      data.template_version !== 1 ||
      data.writer_format_id !== item.template.writerFormatId ||
      data.reference_text_hash !== item.template.referenceTextHash ||
      data.audio_fit_mode !== item.template.audioFitMode ||
      data.locked_audio_asset_id !== item.template.audioAssetId
    ) {
      throw new Error(`Remote verification failed for ${item.template.templateKey}.`);
    }
    if (
      audioError ||
      !audio ||
      audio.status !== "active" ||
      audio.review_status !== "approved" ||
      audio.selection_scope !== "instagram_reel_locked" ||
      audio.loopable !== false
    ) {
      throw new Error(`Remote locked audio verification failed for ${item.template.templateKey}.`);
    }
    const { data: video, error: videoError } = await supabase
      .from("overlay_media_assets")
      .select("id,status,analysis_status,aspect_ratio,wall_text_source_kind,duration_seconds")
      .eq("id", data.overlay_media_asset_id)
      .maybeSingle();
    if (
      videoError ||
      !video ||
      video.status !== "active" ||
      video.analysis_status !== "succeeded" ||
      video.aspect_ratio !== "9:16" ||
      video.wall_text_source_kind !== "instagram_reel" ||
      getDirectFitMode(
        Number(audio.duration_seconds) - Number(audio.cue_start_seconds),
        Number(video.duration_seconds),
      ) !== item.template.audioFitMode
    ) {
      throw new Error(`Remote video/audio fit verification failed for ${item.template.templateKey}.`);
    }
    await Promise.all([
      headStorageObject({ key: item.videoKey }),
      headStorageObject({ key: item.thumbnailKey }),
      headStorageObject({ key: item.audioKey }),
    ]);
    verified.push(item.template.templateKey);
  }
  return verified;
}

async function verifyStoredObjects(item, prepared) {
  const [video, thumbnail, audio] = await Promise.all([
    headStorageObject({ key: item.videoKey }),
    headStorageObject({ key: item.thumbnailKey }),
    headStorageObject({ key: item.audioKey }),
  ]);
  if (video.ContentLength !== statSync(prepared.video.path).size || video.ContentType !== "video/mp4") {
    throw new Error(`Stored video verification failed for ${item.template.templateKey}.`);
  }
  if (!thumbnail.ContentLength || thumbnail.ContentType !== "image/webp") {
    throw new Error(`Stored thumbnail verification failed for ${item.template.templateKey}.`);
  }
  if (audio.ContentLength !== prepared.audio.sizeBytes || audio.ContentType !== "audio/mpeg") {
    throw new Error(`Stored audio verification failed for ${item.template.templateKey}.`);
  }
}

function probeMedia(filePath) {
  const result = run(ffprobeStatic.path, [
    "-v", "error", "-show_entries",
    "format=duration:stream=codec_type,codec_name,width,height,sample_rate,channels",
    "-of", "json", filePath,
  ]);
  const parsed = JSON.parse(result.stdout);
  const videoStreams = (parsed.streams ?? []).filter((stream) => stream.codec_type === "video");
  const audioStreams = (parsed.streams ?? []).filter((stream) => stream.codec_type === "audio");
  const durationSeconds = round(Number(parsed.format?.duration), 3);
  return {
    audioStreamCount: audioStreams.length,
    durationSeconds,
    height: Number(videoStreams[0]?.height ?? 0),
    videoStreamCount: videoStreams.length,
    width: Number(videoStreams[0]?.width ?? 0),
  };
}

function getDirectFitMode(audioDuration, videoDuration) {
  const difference = audioDuration - videoDuration;
  if (Math.abs(difference) <= 0.08) return "exact";
  return difference > 0.08 ? "trim" : null;
}

function canonicalizeInstagramUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/(^|\.)instagram\.com$/iu.test(url.hostname)) {
    throw new Error("Reference URL is not an Instagram HTTPS URL.");
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/u, "");
}

function printPlan({ execute: isExecute, manifestPath: file, plan: value, prepare: isPrepare, root: sourceRoot, verify: isVerify }) {
  console.log("Instagram Reel Wall template import plan");
  console.log(
    `Mode: ${isVerify ? "verify" : isExecute ? "execute" : isPrepare ? "prepare" : "dry-run"}`,
  );
  console.log(`Root: ${sourceRoot}`);
  console.log(`Manifest: ${file}`);
  console.log(`Locked bundles: ${value.items.length}`);
  console.log(`Source videos with embedded audio to strip: ${value.items.filter((item) => item.video.audioStreamCount > 0).length}`);
  console.log(`Audio fit: exact=${value.items.filter((item) => item.template.audioFitMode === "exact").length}, trim=${value.items.filter((item) => item.template.audioFitMode === "trim").length}, loop=0`);
}

function assertRuntimeReady() {
  if (getStorageProviderName() !== "gcp") throw new Error("Template import requires STORAGE_PROVIDER=gcp.");
  const missing = [
    ...getMissingStorageEnvVars(),
    ...(!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ...(!(process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) ? ["SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"] : []),
  ];
  if (missing.length > 0) throw new Error(`Missing import configuration: ${missing.join(", ")}.`);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${result.stderr || result.error?.message || command}`);
  }
  return { stderr: result.stderr ?? "", stdout: result.stdout ?? "" };
}

function assertHash(filePath, expected, label) {
  if (!existsSync(filePath) || hashFile(filePath) !== expected) {
    throw new Error(`${label} changed or is missing.`);
  }
}

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeText(value) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function assertUnique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label} in manifest.`);
}

function assertPathWithin(rootPath, candidatePath) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escaped source root: ${candidatePath}`);
  }
}

function numericCompare(left, right) {
  return Number(left) - Number(right);
}

function round(value, places) {
  if (!Number.isFinite(value)) throw new Error("Media duration is invalid.");
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function writeResult(mode, value) {
  const directory = path.resolve(RESULT_ROOT);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, `${mode}-result.json`),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index];
    if (!argument.startsWith("--")) continue;
    const key = argument.slice(2);
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match || process.env[match[1]]) continue;
    const raw = match[2].trim();
    process.env[match[1]] =
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1)
        : raw;
  }
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(" or ")}.`);
}
