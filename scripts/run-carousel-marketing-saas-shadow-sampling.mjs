import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

loadEnvFile(path.resolve(workspaceRoot, ".env.local"));

const args = parseArgs(process.argv.slice(2));
const profileId = args.profile || args.profileId || "marketing-saas";
const profileConfig = getShadowProfile(profileId);
const categorySlug = args.category || args.categorySlug || profileConfig.categorySlug;
const sampleCount = getIntegerArg("count", 20, { min: 1, max: 50 });
const slideCount = getIntegerArg("slides", 5, { min: 1, max: 10 });
const pollIntervalMs = getIntegerArg("poll-ms", 5_000, {
  min: 1_000,
  max: 60_000,
});
const maxWaitMs = getIntegerArg("max-wait-ms", Math.max(900_000, sampleCount * 90_000), {
  min: 60_000,
  max: 3_600_000,
});
const outputRoot = path.resolve(
  workspaceRoot,
  args["output-dir"] ?? `.tmp/carousel-shadow-sampling/${profileConfig.id}`,
);
const runId = args["run-id"] ?? new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const outputDir = path.join(outputRoot, runId);
const imageDir = path.join(outputDir, "assets");
const shouldEnqueue = args["report-only"] !== "true";

mkdirSync(imageDir, { recursive: true });

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
const sqs = new SQSClient({
  credentials: getSqsCredentials(),
  region: getRequiredEnv("AWS_REGION"),
});

const logStartTime = Date.now() - 60_000;
const analysisId = await ensureShadowAnalysis(profileConfig);
const batchId = randomUUID();
const createdJobs = shouldEnqueue
  ? await createAndEnqueueJobs({
      analysisId,
      batchId,
      profileConfig,
      sampleCount,
      slideCount,
    })
  : [];

if (shouldEnqueue) {
  console.log(
    `Queued ${createdJobs.length} ${profileConfig.label} shadow sample jobs in batch ${batchId}.`,
  );
  await pollJobs(createdJobs, maxWaitMs);
}

const logEndTime = Date.now() + 60_000;
const comparisonLogs = await waitForBroadMatcherComparisonLogs({
  carouselIds: createdJobs.map((job) => job.carouselId),
  startTime: logStartTime,
  endTime: logEndTime,
  expectedCount: createdJobs.length,
});
const report = await buildReport({
  batchId,
  comparisonLogs,
  profileConfig,
  jobs: createdJobs,
  outputDir,
  runId,
});

await writeArtifacts(report);

console.log(
  JSON.stringify(
    {
      outputDir,
      reportPath: path.join(outputDir, "report.json"),
      markdownPath: path.join(outputDir, "report.md"),
      contactSheetPath: report.contactSheetPath,
      summary: report.summary,
    },
    null,
    2,
  ),
);

if (
  report.summary.failedJobCount > 0 ||
  report.summary.missingLogJobCount > 0 ||
  report.summary.missingBroadSelectionCount > 0 ||
  report.summary.safetyViolationCount > 0
) {
  process.exitCode = 1;
}

async function ensureShadowAnalysis(profile) {
  const normalizedDomain = `shadow-${profile.id}.local`;
  const projectId = `carousel-shadow-sampling-${profile.id}`;
  const userId = `test-${profile.id}-shadow`;

  const existing = await supabase
    .from("website_analyses")
    .select("id")
    .eq("normalized_domain", normalizedDomain)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(
      `Could not query ${profile.label} shadow analysis: ${existing.error.message}`,
    );
  }

  if (existing.data?.id) {
    return existing.data.id;
  }

  const analysis = profile.analysis;
  const inserted = await supabase
    .from("website_analyses")
    .insert({
      analysis_json: analysis,
      brand_tone: analysis.brandTone,
      business_name: analysis.businessName,
      carousel_angles: analysis.carouselAngles,
      category: analysis.category,
      claims_to_avoid: analysis.claimsToAvoid,
      confidence: analysis.confidence,
      confidence_reason: analysis.confidenceReason,
      cta_ideas: analysis.ctaIdeas,
      differentiators: analysis.differentiators,
      main_problem: analysis.mainProblem,
      main_promise: analysis.mainPromise,
      missing_info: analysis.missingInfo,
      normalized_domain: normalizedDomain,
      pain_points: analysis.painPoints,
      pexels_image_queries: analysis.pexelsImageQueries,
      product_summary: analysis.productSummary,
      project_id: projectId,
      recommended_carousel_structure: analysis.recommendedCarouselStructure,
      target_audience: analysis.targetAudience,
      user_id: userId,
      value_props: analysis.valueProps,
      visual_keywords: analysis.visualKeywords,
      website_url: `https://${normalizedDomain}`,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data?.id) {
    throw new Error(
      `Could not create ${profile.label} shadow analysis: ${
        inserted.error?.message ?? "missing id"
      }`,
    );
  }

  return inserted.data.id;
}

async function createAndEnqueueJobs({
  analysisId,
  batchId,
  profileConfig: profile,
  sampleCount,
  slideCount,
}) {
  const candidateAngles = repeatAngles(profile.analysis.carouselAngles, sampleCount);
  const jobs = [];

  for (let candidateIndex = 0; candidateIndex < sampleCount; candidateIndex += 1) {
    const carouselId = await createCarouselGeneration({
      analysisId,
      batchId,
      candidateCount: sampleCount,
      candidateIndex,
      profileConfig: profile,
      selectedAngle: candidateAngles[candidateIndex],
      slideCount,
    });
    const backgroundJob = await createBackgroundJob({
      batchId,
      candidateCount: sampleCount,
      candidateIndex,
      carouselId,
    });
    const message = await sqs.send(
      new SendMessageCommand({
        MessageBody: JSON.stringify({
          jobId: backgroundJob.id,
          jobType: "generate_carousel",
        }),
        QueueUrl: getRequiredEnv("UGC_CAROUSEL_QUEUE_URL"),
      }),
    );

    if (!message.MessageId) {
      throw new Error(`SQS did not return a message id for ${carouselId}.`);
    }

    await updateBackgroundJob(backgroundJob.id, {
      aws_message_id: message.MessageId,
    });
    jobs.push({
      backgroundJobId: backgroundJob.id,
      carouselId,
      candidateIndex,
      messageId: message.MessageId,
    });
  }

  return jobs;
}

async function createCarouselGeneration({
  analysisId,
  batchId,
  candidateCount,
  candidateIndex,
  profileConfig: profile,
  selectedAngle,
  slideCount,
}) {
  const { data, error } = await supabase
    .from("carousel_generations")
    .insert({
      candidate_count: candidateCount,
      candidate_index: candidateIndex,
      category_slug: categorySlug,
      format: "4:5",
      generation_batch_id: batchId,
      goal: profile.goal,
      project_id: `carousel-shadow-sampling-${profile.id}`,
      selected_angle: selectedAngle,
      slide_count: slideCount,
      status: "processing",
      user_id: `test-${profile.id}-shadow`,
      website_analysis_id: analysisId,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Could not create carousel generation: ${error?.message ?? "missing id"}`,
    );
  }

  return data.id;
}

async function createBackgroundJob({ batchId, candidateCount, candidateIndex, carouselId }) {
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      input_json: {
        candidateCount,
        candidateIndex,
        carouselId,
        generationBatchId: batchId,
      },
      job_type: "generate_carousel",
      project_id: `carousel-shadow-sampling-${profileConfig.id}`,
      queue_name: "carousel",
      status: "queued",
      updated_at: new Date().toISOString(),
      user_id: `test-${profileConfig.id}-shadow`,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Could not create background job: ${error?.message ?? "missing id"}`,
    );
  }

  return data;
}

async function updateBackgroundJob(jobId, patch) {
  const { error } = await supabase
    .from("background_jobs")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Could not update background job ${jobId}: ${error.message}`);
  }
}

async function pollJobs(jobs, maxWaitMs) {
  const deadline = Date.now() + maxWaitMs;
  const jobIds = jobs.map((job) => job.backgroundJobId);
  const carouselIds = jobs.map((job) => job.carouselId);

  while (Date.now() < deadline) {
    const [backgroundJobs, carousels, slides] = await Promise.all([
      supabase
        .from("background_jobs")
        .select("id,status,error_message,output_json")
        .in("id", jobIds),
      supabase
        .from("carousel_generations")
        .select("id,status,error_message")
        .in("id", carouselIds),
      supabase
        .from("carousel_slides")
        .select("carousel_generation_id,status,rendered_url")
        .in("carousel_generation_id", carouselIds),
    ]);

    if (backgroundJobs.error) {
      throw new Error(`Could not poll background jobs: ${backgroundJobs.error.message}`);
    }

    if (carousels.error) {
      throw new Error(`Could not poll carousels: ${carousels.error.message}`);
    }

    if (slides.error) {
      throw new Error(`Could not poll slides: ${slides.error.message}`);
    }

    const terminalJobs = (backgroundJobs.data ?? []).filter((job) =>
      ["cancelled", "completed", "failed"].includes(job.status),
    );
    const completedJobs = (backgroundJobs.data ?? []).filter(
      (job) => job.status === "completed",
    );
    const failedJobs = (backgroundJobs.data ?? []).filter((job) =>
      ["cancelled", "failed"].includes(job.status),
    );

    console.log(
      `poll completed=${completedJobs.length}/${jobs.length} failed=${failedJobs.length} slides=${slides.data?.length ?? 0}`,
    );

    if (terminalJobs.length === jobs.length) {
      for (const job of jobs) {
        job.backgroundJob =
          (backgroundJobs.data ?? []).find((row) => row.id === job.backgroundJobId) ??
          null;
        job.carousel =
          (carousels.data ?? []).find((row) => row.id === job.carouselId) ?? null;
        job.slides = (slides.data ?? []).filter(
          (row) => row.carousel_generation_id === job.carouselId,
        );
      }
      return;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for ${jobs.length} shadow sample jobs.`);
}

async function getBroadMatcherComparisonLogs({ carouselIds, startTime, endTime }) {
  if (carouselIds.length === 0) {
    return [];
  }

  const logGroupName = getRequiredEnv("CLOUDWATCH_LOG_GROUP");
  const response = awsJson([
    "logs",
    "filter-log-events",
    "--log-group-name",
    logGroupName,
    "--region",
    getRequiredEnv("AWS_REGION"),
    "--start-time",
    String(startTime),
    "--end-time",
    String(endTime),
    "--filter-pattern",
    '"Carousel broad matcher comparison completed"',
    "--no-paginate",
  ]);
  const carouselIdSet = new Set(carouselIds);

  return (response.events ?? [])
    .map((event) => {
      try {
        return JSON.parse(event.message);
      } catch {
        return null;
      }
    })
    .filter(
      (entry) =>
        entry?.message === "Carousel broad matcher comparison completed" &&
        carouselIdSet.has(entry.metadata?.carouselId),
    )
    .map((entry) => ({
      carouselId: entry.metadata.carouselId,
      categorySlug: entry.metadata.categorySlug,
      comparisons: entry.metadata.comparisons ?? [],
      profileId: entry.metadata.profileId,
      timestamp: entry.timestamp,
      version: entry.metadata.broadMatcherVersion,
    }));
}

async function waitForBroadMatcherComparisonLogs({
  carouselIds,
  endTime,
  expectedCount,
  startTime,
}) {
  let latestLogs = [];

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    latestLogs = await getBroadMatcherComparisonLogs({
      carouselIds,
      endTime: Math.max(endTime, Date.now() + 60_000),
      startTime,
    });

    console.log(
      `cloudwatch broadMatcherLogs=${latestLogs.length}/${expectedCount} attempt=${attempt}/8`,
    );

    if (latestLogs.length >= expectedCount) {
      return latestLogs;
    }

    await sleep(5_000);
  }

  return latestLogs;
}

async function buildReport({
  batchId,
  comparisonLogs,
  profileConfig: profile,
  jobs,
  outputDir,
  runId,
}) {
  const comparisons = comparisonLogs.flatMap((log) =>
    log.comparisons.map((comparison) => ({
      ...comparison,
      carouselId: log.carouselId,
    })),
  );
  const broadAssetIds = Array.from(
    new Set(
      comparisons
        .map((comparison) => comparison.broadAssetId)
        .filter((value) => typeof value === "string" && value),
    ),
  );
  const assetRows = await getAssetRows(broadAssetIds);
  const assetById = new Map(assetRows.map((asset) => [asset.id, asset]));
  const selectedAssets = comparisons
    .filter((comparison) => comparison.broadAssetId)
    .map((comparison) => ({
      asset: assetById.get(comparison.broadAssetId) ?? null,
      comparison,
    }));
  const safetyViolations = selectedAssets.filter(({ asset }) => !isStrictSafeAsset(asset));
  const sameCarouselDuplicates = getSameCarouselDuplicateSelections(comparisons);
  const repeatedAssets = getRepeatedAssets(comparisons, assetById);
  const fallbackCounts = countBy(comparisons, (comparison) => comparison.fallbackReason);
  const completedJobs = jobs.filter(
    (job) =>
      job.backgroundJob?.status === "completed" &&
      job.carousel?.status === "completed" &&
      (job.slides ?? []).every((slide) => slide.status === "ready" && slide.rendered_url),
  );
  const failedJobs = jobs.filter(
    (job) =>
      job.backgroundJob?.status !== "completed" || job.carousel?.status !== "completed",
  );
  const logCarouselIds = new Set(comparisonLogs.map((log) => log.carouselId));
  const missingLogJobs = jobs.filter((job) => !logCarouselIds.has(job.carouselId));
  const contactSheetPath = await createContactSheet({
    assetRows,
    comparisons,
    outputPath: path.join(outputDir, "broad-shadow-contact-sheet.png"),
  });

  return {
    batchId,
    categorySlug,
    contactSheetPath,
    generatedAt: new Date().toISOString(),
    jobs: jobs.map((job) => ({
      backgroundJobId: job.backgroundJobId,
      backgroundStatus: job.backgroundJob?.status ?? null,
      carouselId: job.carouselId,
      carouselStatus: job.carousel?.status ?? null,
      candidateIndex: job.candidateIndex,
      error:
        job.backgroundJob?.error_message ??
        job.carousel?.error_message ??
        null,
      renderedSlideCount: (job.slides ?? []).filter(
        (slide) => slide.status === "ready" && slide.rendered_url,
      ).length,
    })),
    logs: comparisonLogs,
    outputDir,
    profileId: profile.id,
    profileLabel: profile.label,
    repeatedAssets,
    runId,
    selectedAssets: selectedAssets.map(({ asset, comparison }) => ({
      asset,
      carouselId: comparison.carouselId,
      fallbackReason: comparison.fallbackReason,
      slideNumber: comparison.slideNumber,
      targetBroadBucketId: comparison.targetBroadBucketId,
    })),
    summary: {
      broadMatcherLogCount: comparisonLogs.length,
      completedJobCount: completedJobs.length,
      duplicateReuseCount: comparisons.filter(
        (comparison) => comparison.fallbackReason === "duplicate_safe_reuse",
      ).length,
      exactOrPartialCount: comparisons.filter((comparison) =>
        ["exact_match", "partial_tag_match"].includes(comparison.fallbackReason),
      ).length,
      failedJobCount: failedJobs.length,
      fallbackCounts,
      fallbackSelectionCount: comparisons.filter((comparison) =>
        ["broad_bucket_fallback", "profile_fallback"].includes(
          comparison.fallbackReason,
        ),
      ).length,
      expectedComparisonCount:
        completedJobs.reduce(
          (total, job) => total + (job.slides?.length ?? 0),
          0,
        ) || jobs.length * slideCount,
      missingBroadSelectionCount: comparisons.filter(
        (comparison) =>
          !comparison.broadAssetId ||
          comparison.fallbackReason === "no_safe_asset_available",
      ).length,
      missingLogJobCount: missingLogJobs.length,
      sampleCount: jobs.length,
      safetyViolationCount: safetyViolations.length,
      sameCarouselDuplicateCount: sameCarouselDuplicates.length,
      selectedUniqueAssetCount: broadAssetIds.length,
      totalBroadComparisons: comparisons.length,
    },
    safetyViolations: safetyViolations.map(({ asset, comparison }) => ({
      asset,
      carouselId: comparison.carouselId,
      slideNumber: comparison.slideNumber,
    })),
    sameCarouselDuplicates,
  };
}

async function getAssetRows(assetIds) {
  if (assetIds.length === 0) {
    return [];
  }

  const rows = [];

  for (const chunk of chunkArray(assetIds, 100)) {
    const { data, error } = await supabase
      .from("category_image_assets")
      .select(
        "id,pexels_photo_id,base_url,thumb_url,status,subject_review_status,image_subject_class,has_human,face_count,person_count,runtime_exclusion_reason,broad_visual_bucket,visual_bucket,source_query,content_tags,object_tags,mood_tags,near_duplicate_group,usage_count",
      )
      .in("id", chunk);

    if (error) {
      throw new Error(`Could not fetch selected asset metadata: ${error.message}`);
    }

    rows.push(...(data ?? []));
  }

  return rows;
}

async function writeArtifacts(report) {
  mkdirSync(report.outputDir, { recursive: true });
  const reportPath = path.join(report.outputDir, "report.json");
  const markdownPath = path.join(report.outputDir, "report.md");
  const manifestPath = path.join(report.outputDir, "review-manifest.json");

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, buildMarkdownReport(report), "utf8");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      report.selectedAssets.map((selection) => ({
        assetId: selection.asset?.id ?? null,
        broadVisualBucket: selection.asset?.broad_visual_bucket ?? null,
        carouselId: selection.carouselId,
        fallbackReason: selection.fallbackReason,
        imageUrl: selection.asset?.base_url ?? null,
        pexelsPhotoId: selection.asset?.pexels_photo_id ?? null,
        slideNumber: selection.slideNumber,
        targetBroadBucketId: selection.targetBroadBucketId,
      })),
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function buildMarkdownReport(report) {
  const lines = [
    `# ${report.profileLabel} Broad Matcher Shadow Sample`,
    "",
    `Generated: ${report.generatedAt}`,
    `Batch: ${report.batchId}`,
    `Profile: ${report.profileId}`,
    `Category: ${report.categorySlug}`,
    "",
    "## Summary",
    "",
    `- Sample jobs: ${report.summary.sampleCount}`,
    `- Completed jobs: ${report.summary.completedJobCount}`,
    `- Failed jobs: ${report.summary.failedJobCount}`,
    `- Broad matcher logs found: ${report.summary.broadMatcherLogCount}`,
    `- Missing log jobs: ${report.summary.missingLogJobCount}`,
    `- Total broad comparisons: ${report.summary.totalBroadComparisons}`,
    `- Missing broad selections: ${report.summary.missingBroadSelectionCount}`,
    `- Safety violations: ${report.summary.safetyViolationCount}`,
    `- Same-carousel duplicate selections: ${report.summary.sameCarouselDuplicateCount}`,
    `- Unique selected broad assets: ${report.summary.selectedUniqueAssetCount}`,
    `- Fallback selections: ${report.summary.fallbackSelectionCount}`,
    `- Duplicate safe reuse selections: ${report.summary.duplicateReuseCount}`,
    "",
    "## Fallback Reasons",
    "",
    ...Object.entries(report.summary.fallbackCounts).map(
      ([reason, count]) => `- ${reason}: ${count}`,
    ),
    "",
    "## Contact Sheet",
    "",
    `![Broad shadow contact sheet](${report.contactSheetPath})`,
    "",
    "## Repeated Assets",
    "",
    ...(report.repeatedAssets.length
      ? report.repeatedAssets.map(
          (item) =>
            `- ${item.assetId} / Pexels ${item.pexelsPhotoId ?? "unknown"}: ${item.count} selections (${item.broadVisualBucket ?? "unmapped"})`,
        )
      : ["- None"]),
    "",
    "## Safety Violations",
    "",
    ...(report.safetyViolations.length
      ? report.safetyViolations.map(
          (item) =>
            `- ${item.asset?.id ?? "missing asset"} on carousel ${item.carouselId} slide ${item.slideNumber}`,
        )
      : ["- None"]),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

async function createContactSheet({ assetRows, comparisons, outputPath }) {
  if (assetRows.length === 0) {
    return null;
  }

  const firstSelectionByAssetId = new Map();

  for (const comparison of comparisons) {
    if (!comparison.broadAssetId || firstSelectionByAssetId.has(comparison.broadAssetId)) {
      continue;
    }

    firstSelectionByAssetId.set(comparison.broadAssetId, comparison);
  }

  const cellWidth = 270;
  const imageHeight = 338;
  const labelHeight = 120;
  const gap = 18;
  const columns = 4;
  const rows = Math.ceil(assetRows.length / columns);
  const width = columns * cellWidth + (columns + 1) * gap;
  const height = rows * (imageHeight + labelHeight + gap) + gap;
  const composites = [];

  for (const [index, asset] of assetRows.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = gap + column * (cellWidth + gap);
    const top = gap + row * (imageHeight + labelHeight + gap);
    const imagePath = path.join(
      imageDir,
      `${String(index + 1).padStart(3, "0")}-${safeFileName(asset.pexels_photo_id ?? asset.id)}.webp`,
    );
    await downloadFile(asset.base_url, imagePath);
    const image = await sharp(imagePath)
      .resize(cellWidth, imageHeight, { fit: "cover" })
      .webp()
      .toBuffer();
    const selection = firstSelectionByAssetId.get(asset.id);
    const label = await sharp(
      Buffer.from(
        `<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#ffffff"/>
          <text x="10" y="23" font-family="Arial" font-size="16" font-weight="700" fill="#111827">${escapeXml(`${index + 1}. Pexels ${asset.pexels_photo_id ?? "unknown"}`)}</text>
          <text x="10" y="47" font-family="Arial" font-size="12" fill="#374151">${escapeXml(`Broad: ${asset.broad_visual_bucket ?? "unmapped"}`)}</text>
          <text x="10" y="67" font-family="Arial" font-size="12" fill="#6b7280">${escapeXml(`Legacy: ${asset.visual_bucket ?? "none"} | ${selection?.fallbackReason ?? "n/a"}`)}</text>
          <text x="10" y="87" font-family="Arial" font-size="12" fill="#6b7280">${escapeXml(`Target: ${selection?.targetBroadBucketId ?? "n/a"} | uses ${asset.usage_count ?? 0}`)}</text>
          <text x="10" y="107" font-family="Arial" font-size="12" fill="#9ca3af">${escapeXml(truncate(asset.source_query ?? "", 38))}</text>
        </svg>`,
      ),
    )
      .png()
      .toBuffer();

    composites.push({ input: image, left, top });
    composites.push({ input: label, left, top: top + imageHeight });
  }

  await sharp({
    create: {
      background: "#f3f4f6",
      channels: 4,
      height,
      width,
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  return outputPath;
}

function getSameCarouselDuplicateSelections(comparisons) {
  const duplicates = [];
  const byCarousel = groupBy(comparisons, (comparison) => comparison.carouselId);

  for (const [carouselId, items] of byCarousel.entries()) {
    const byAsset = groupBy(
      items.filter((item) => item.broadAssetId),
      (item) => item.broadAssetId,
    );

    for (const [assetId, assetItems] of byAsset.entries()) {
      if (assetItems.length > 1) {
        duplicates.push({
          assetId,
          carouselId,
          count: assetItems.length,
          slideNumbers: assetItems.map((item) => item.slideNumber),
        });
      }
    }
  }

  return duplicates;
}

function getRepeatedAssets(comparisons, assetById) {
  return Object.entries(
    countBy(
      comparisons.filter((comparison) => comparison.broadAssetId),
      (comparison) => comparison.broadAssetId,
    ),
  )
    .filter(([, count]) => count > 1)
    .map(([assetId, count]) => {
      const asset = assetById.get(assetId);

      return {
        assetId,
        broadVisualBucket: asset?.broad_visual_bucket ?? null,
        count,
        pexelsPhotoId: asset?.pexels_photo_id ?? null,
      };
    })
    .sort((left, right) => right.count - left.count);
}

function isStrictSafeAsset(asset) {
  return (
    asset &&
    asset.status === "ready" &&
    asset.subject_review_status === "approved" &&
    asset.image_subject_class === "object-only" &&
    asset.has_human === false &&
    asset.face_count === 0 &&
    asset.person_count === 0 &&
    asset.runtime_exclusion_reason === null
  );
}

function getShadowProfile(value) {
  const shadowProfiles = getShadowProfiles();
  const profile = shadowProfiles[value];

  if (!profile) {
    throw new Error(
      `Unknown --profile "${value}". Use one of: ${Object.keys(shadowProfiles).join(", ")}.`,
    );
  }

  return profile;
}

function getShadowProfiles() {
  return {
  "beauty-skincare": {
    id: "beauty-skincare",
    label: "Beauty Skincare",
    categorySlug: "beauty-skincare",
    goal: "Drive skincare routine trials",
    analysis: {
      businessName: "GlowKind",
      brandTone: "calm, premium, practical",
      carouselAngles: [
        "Your skincare routine is doing too much",
        "The glow problem starts with inconsistent steps",
        "Stop guessing what your skin needs tonight",
        "A simpler routine makes products easier to trust",
        "Turn skincare clutter into one clean ritual",
        "The product shelf is not the strategy",
        "Make every routine feel easier to repeat",
        "Build a skincare habit that does not feel heavy",
        "Your routine should be clear before it is expensive",
        "Small skincare steps compound when they are simple",
      ],
      category: "Beauty Skincare",
      claimsToAvoid: ["medical cure", "guaranteed acne removal"],
      confidence: "high",
      confidenceReason:
        "Synthetic controlled Beauty Skincare analysis for carousel shadow sampling.",
      ctaIdeas: ["Build your routine", "Start with one step", "Create a cleaner ritual"],
      differentiators: [
        "simple routine planning",
        "product-led skincare guidance",
        "calm habit reminders",
      ],
      mainProblem:
        "Skincare buyers get overwhelmed by too many products, unclear steps, and inconsistent routines.",
      mainPromise:
        "Turn scattered skincare products into a simple repeatable routine.",
      missingInfo: [],
      painPoints: [
        "too many products on the shelf",
        "unclear routine order",
        "inconsistent night routine",
        "guessing what product to use",
      ],
      pexelsImageQueries: [
        "skincare bottles still life no people",
        "cosmetic jars neutral background",
        "bathroom shelf skincare products no people",
        "minimal product still life",
        "soft abstract skincare background",
      ],
      productSummary:
        "GlowKind helps people simplify skincare routines, choose the next step, and build a calmer personal-care habit.",
      recommendedCarouselStructure: [
        "hook",
        "problem",
        "mistake",
        "solution",
        "benefit",
        "cta",
      ],
      targetAudience: [
        "skincare shoppers",
        "beauty routine beginners",
        "personal-care buyers",
        "wellness-minded consumers",
      ],
      valueProps: [
        "simple routine builder",
        "product step clarity",
        "calm habit reminders",
        "clean personal-care guidance",
      ],
      visualKeywords: [
        "beauty",
        "skincare",
        "cosmetic bottles",
        "product still life",
        "clean texture",
        "routine",
      ],
    },
  },
  "generic-business": {
    id: "generic-business",
    label: "Generic Business",
    categorySlug: "generic-business",
    goal: "Drive business consultation requests",
    analysis: {
      businessName: "OpsBridge",
      brandTone: "direct, credible, practical",
      carouselAngles: [
        "Your business process is leaking time",
        "Most teams do not need more tools",
        "The handoff is where work gets lost",
        "Make the next business step obvious",
        "A cleaner process beats another meeting",
        "Turn scattered operations into one workflow",
        "The problem is not effort, it is visibility",
        "Stop rebuilding the same status update",
        "Your process needs fewer blind spots",
        "Better operations start with cleaner signals",
      ],
      category: "Business Services",
      claimsToAvoid: ["guaranteed revenue", "instant scale"],
      confidence: "high",
      confidenceReason:
        "Synthetic controlled Generic Business analysis for carousel shadow sampling.",
      ctaIdeas: ["Review your workflow", "Start with one process", "Book a process audit"],
      differentiators: [
        "workflow clarity",
        "process simplification",
        "reporting and planning support",
      ],
      mainProblem:
        "Business teams lose momentum when work is scattered across updates, dashboards, and manual handoffs.",
      mainPromise:
        "Make operations easier to see, plan, and improve.",
      missingInfo: [],
      painPoints: [
        "unclear process ownership",
        "manual status updates",
        "scattered business reporting",
        "slow team handoffs",
      ],
      pexelsImageQueries: [
        "business desk no people",
        "workspace objects no people",
        "analytics dashboard no people",
        "notebook planner desk no people",
        "clean office still life",
      ],
      productSummary:
        "OpsBridge helps businesses simplify workflows, clarify handoffs, and make operations easier to manage.",
      recommendedCarouselStructure: ["hook", "problem", "solution", "benefit", "cta"],
      targetAudience: ["business owners", "operators", "service teams", "consultants"],
      valueProps: [
        "workflow clarity",
        "clean reporting",
        "better process visibility",
        "simpler operating rhythm",
      ],
      visualKeywords: [
        "workspace",
        "business planning",
        "dashboard",
        "notebook",
        "clean texture",
      ],
    },
  },
  "marketing-saas": {
    id: "marketing-saas",
    label: "Marketing SaaS",
    categorySlug: "marketing-saas",
    goal: "Drive signups",
    analysis: {
      businessName: "CampaignFlow",
      brandTone: "clear, confident, practical",
      carouselAngles: [
        "Your campaign dashboard is hiding the next action",
        "Manual reporting is slowing every launch",
        "Content calendars should not live in five tools",
        "Missed lead notifications cost momentum",
        "Turn campaign chaos into one workflow",
        "Stop rebuilding the same campaign report",
        "Make every launch easier to review",
        "Your growth team needs a cleaner operating system",
        "See the campaign bottleneck before it becomes urgent",
        "One workspace for campaigns, content, and follow-up",
      ],
      category: "Marketing SaaS",
      claimsToAvoid: ["guaranteed revenue", "instant growth"],
      confidence: "high",
      confidenceReason:
        "Synthetic controlled Marketing SaaS analysis for carousel shadow sampling.",
      ctaIdeas: [
        "Start with one campaign",
        "Create a cleaner launch",
        "Plan the next workflow",
      ],
      differentiators: [
        "unified campaign planning",
        "automated reporting",
        "lead notification workflow",
      ],
      mainProblem:
        "Campaign teams lose time across calendars, dashboards, spreadsheets, and notifications.",
      mainPromise: "Turn scattered campaign work into a clear automated workflow.",
      missingInfo: [],
      painPoints: [
        "manual campaign reporting",
        "scattered content calendars",
        "missed lead notifications",
        "too many spreadsheet updates",
      ],
      pexelsImageQueries: [
        "marketing dashboard laptop no people",
        "content calendar desk no people",
        "smartphone notification desk no people",
        "analytics screen no people",
        "workspace objects no people",
      ],
      productSummary:
        "CampaignFlow helps marketing teams plan campaigns, centralize reporting, automate workflow steps, and catch lead follow-ups in one place.",
      recommendedCarouselStructure: [
        "hook",
        "problem",
        "mistake",
        "solution",
        "benefit",
        "cta",
      ],
      targetAudience: [
        "marketing teams",
        "growth teams",
        "SaaS founders",
        "content operators",
      ],
      valueProps: [
        "centralized campaign dashboard",
        "content calendar automation",
        "lead notification workflow",
        "reporting without spreadsheet cleanup",
      ],
      visualKeywords: [
        "marketing analytics",
        "campaign dashboard",
        "content calendar",
        "workflow automation",
        "lead notifications",
        "spreadsheet reporting",
      ],
    },
  },
  "productivity-saas": {
    id: "productivity-saas",
    label: "Productivity SaaS",
    categorySlug: "productivity-saas",
    goal: "Drive productivity tool signups",
    analysis: {
      businessName: "AgentDesk",
      brandTone: "focused, simple, modern",
      carouselAngles: [
        "Your AI agent workflow is still too manual",
        "The task list is not the source of truth",
        "Stop copying the same update across tools",
        "Make every project handoff easier to see",
        "A cleaner workspace makes AI useful faster",
        "Your team needs fewer status tabs",
        "Turn daily admin into one automated flow",
        "The problem is not work, it is context switching",
        "Build a workspace that remembers the next step",
        "Stop letting routine updates break focus",
      ],
      category: "Productivity SaaS",
      claimsToAvoid: ["fully autonomous guarantee", "replaces all staff"],
      confidence: "high",
      confidenceReason:
        "Synthetic controlled Productivity SaaS analysis for carousel shadow sampling.",
      ctaIdeas: ["Start with one workflow", "Clean up your next project", "Build an agent workspace"],
      differentiators: [
        "AI-assisted workflow automation",
        "centralized project context",
        "fewer manual status updates",
      ],
      mainProblem:
        "Teams lose focus when project work is split across tasks, docs, messages, and manual updates.",
      mainPromise:
        "Turn repeated project admin into a cleaner AI-assisted workspace.",
      missingInfo: [],
      painPoints: [
        "context switching",
        "manual project updates",
        "scattered workspaces",
        "unclear next action",
      ],
      pexelsImageQueries: [
        "workspace laptop no people",
        "project dashboard screen no people",
        "notebook desk no people",
        "smartphone desk notification no people",
        "clean workspace objects",
      ],
      productSummary:
        "AgentDesk helps teams automate routine project work, centralize context, and move faster with AI-assisted workflows.",
      recommendedCarouselStructure: ["hook", "problem", "mistake", "solution", "benefit", "cta"],
      targetAudience: ["operators", "project teams", "AI-first teams", "SaaS founders"],
      valueProps: [
        "centralized workspace",
        "AI workflow automation",
        "less manual reporting",
        "clearer project handoffs",
      ],
      visualKeywords: [
        "AI workflow",
        "workspace",
        "project dashboard",
        "automation",
        "notebook",
        "clean texture",
      ],
    },
  },
  wellness: {
    id: "wellness",
    label: "Wellness",
    categorySlug: "wellness",
    goal: "Drive wellness routine trials",
    analysis: {
      businessName: "CalmLoop",
      brandTone: "soft, grounded, clear",
      carouselAngles: [
        "Your wellness routine is too hard to repeat",
        "A habit fails when it asks for too much",
        "The reset should fit your real evening",
        "Stop turning calm into another task",
        "Make wellness easier before making it perfect",
        "Your routine needs fewer decisions",
        "Build a softer reset for busy days",
        "A calmer habit starts with one visible cue",
        "The best routine survives low-energy days",
        "Turn scattered self-care into one small loop",
      ],
      category: "Wellness",
      claimsToAvoid: ["medical treatment", "guaranteed mental health outcomes"],
      confidence: "high",
      confidenceReason:
        "Synthetic controlled Wellness analysis for carousel shadow sampling.",
      ctaIdeas: ["Start a calmer reset", "Build one small habit", "Plan tonight's routine"],
      differentiators: [
        "small habit loops",
        "calm routine planning",
        "soft reminders",
      ],
      mainProblem:
        "Wellness routines fail when they feel too large, too vague, or too difficult to repeat on busy days.",
      mainPromise:
        "Turn self-care into a small repeatable routine that fits real life.",
      missingInfo: [],
      painPoints: [
        "inconsistent routines",
        "too many wellness steps",
        "low evening energy",
        "unclear reset habits",
      ],
      pexelsImageQueries: [
        "home routine still life no people",
        "water glass table minimal",
        "calm abstract paper texture",
        "wellness product bottles still life",
        "clean surface still life",
      ],
      productSummary:
        "CalmLoop helps people build small wellness routines, reduce decision fatigue, and repeat calming habits.",
      recommendedCarouselStructure: ["hook", "problem", "mistake", "solution", "benefit", "cta"],
      targetAudience: ["wellness app users", "habit builders", "busy professionals", "self-care buyers"],
      valueProps: [
        "small habit planning",
        "routine reminders",
        "calm reset structure",
        "less decision fatigue",
      ],
      visualKeywords: [
        "wellness",
        "calm",
        "routine",
        "home lifestyle",
        "water",
        "clean texture",
      ],
    },
  },
  };
}

function repeatAngles(baseAngles, count) {
  const angles = [];

  for (let index = 0; index < count; index += 1) {
    angles.push(baseAngles[index % baseAngles.length]);
  }

  return angles;
}

function getSqsCredentials() {
  return {
    accessKeyId:
      process.env.AWS_APP_ENQUEUE_ACCESS_KEY_ID?.trim() ||
      getRequiredEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey:
      process.env.AWS_APP_ENQUEUE_SECRET_ACCESS_KEY?.trim() ||
      getRequiredEnv("AWS_SECRET_ACCESS_KEY"),
  };
}

function getIntegerArg(name, defaultValue, { min, max }) {
  const rawValue = args[name];
  const value = rawValue === undefined ? defaultValue : Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`--${name} must be a number.`);
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = values[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}

function awsJson(args) {
  return JSON.parse(awsText([...args, "--output", "json"]));
}

function awsText(args) {
  const result = spawnSync("aws", args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: commandEnv(),
    stdio: "pipe",
    timeout: 180_000,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `aws ${args.join(" ")} exited with code ${result.status}: ${result.stderr?.trim()}`,
    );
  }

  return result.stdout ?? "";
}

function commandEnv() {
  const environment = {
    ...process.env,
    AWS_ACCESS_KEY_ID:
      process.env.AWS_DEPLOY_ACCESS_KEY_ID?.trim() ||
      process.env.AWS_ACCESS_KEY_ID?.trim(),
    AWS_SECRET_ACCESS_KEY:
      process.env.AWS_DEPLOY_SECRET_ACCESS_KEY?.trim() ||
      process.env.AWS_SECRET_ACCESS_KEY?.trim(),
    AWS_REGION: getRequiredEnv("AWS_REGION"),
    AWS_PAGER: "",
  };
  const sessionToken = process.env.AWS_DEPLOY_SESSION_TOKEN?.trim();

  if (sessionToken) {
    environment.AWS_SESSION_TOKEN = sessionToken;
  } else {
    delete environment.AWS_SESSION_TOKEN;
  }

  return environment;
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function groupBy(items, getKey) {
  const groups = new Map();

  for (const item of items) {
    const key = getKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return groups;
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function downloadFile(url, outputPath) {
  if (existsSync(outputPath)) {
    return;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not download ${url}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  writeFileSync(outputPath, Buffer.from(arrayBuffer));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeFileName(value) {
  return String(value).replace(/[^a-z0-9_.-]+/gi, "-").slice(0, 80);
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] === undefined) {
      process.env[key] = cleanEnvValue(rawValue);
    }
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

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
