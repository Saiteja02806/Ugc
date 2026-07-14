import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import sharp from "sharp";

loadEnvFile(resolve(".env.local"));

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
const template = await findCanaryTemplate();
const carouselId = await createCanaryGeneration(template);
const backgroundJob = await createBackgroundJob(carouselId);
const message = await sqs.send(
  new SendMessageCommand({
    MessageBody: JSON.stringify({
      jobId: backgroundJob.id,
      jobType: "generate_carousel",
    }),
    QueueUrl: getRequiredEnv("UGC_CAROUSEL_QUEUE_URL"),
  }),
);
sqs.destroy();

if (!message.MessageId) {
  throw new Error("SQS did not return a message id.");
}

await updateBackgroundJob(backgroundJob.id, {
  aws_message_id: message.MessageId,
});

console.log(`Carousel canary: ${carouselId}`);
console.log(`Background job: ${backgroundJob.id}`);
console.log(`SQS message: ${message.MessageId}`);

const result = await pollCarousel(backgroundJob.id, carouselId);

if (result.backgroundJob.status !== "completed") {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else if (
  result.carousel.status !== "completed" ||
  result.slides.length !== template.slide_count ||
  result.carousel.content_planner_version !==
    "llm-carousel-planner-v16-solution-story-guard" ||
  !["deterministic-fallback", "llm"].includes(
    result.carousel.content_plan_source,
  ) ||
  (result.carousel.content_plan_source === "llm" &&
    result.carousel.content_plan_fallback_reason !== null) ||
  (result.carousel.content_plan_source === "deterministic-fallback" &&
    !result.carousel.content_plan_fallback_reason) ||
  result.carousel.renderer_version !==
    "social-bubble-renderer-v11-hybrid-soft-union" ||
  result.carousel.content_plan_validation?.ok !== true ||
  result.carousel.content_plan_normalized?.slides?.length !== 5 ||
  result.slides.some(
    (slide) =>
      slide.status !== "ready" ||
      !slide.rendered_url ||
      !slide.rendered_url.includes(
        "/social-bubble-renderer-v11-hybrid-soft-union/",
      ),
  )
) {
  console.error(JSON.stringify(result, null, 2));
  throw new Error("Carousel worker completed without a full ready slide set.");
} else {
  const artifact = await saveFreshCarouselArtifact(result);

  console.log(
    `Carousel AWS smoke test passed with ${result.slides.length} rendered slides.`,
  );
  console.log(JSON.stringify({ artifact, generation: result.carousel }, null, 2));
}

async function findCanaryTemplate() {
  const { data, error } = await supabase
    .from("carousel_generations")
    .select(
      "website_analysis_id,category_slug,slide_count,format,goal,selected_angle,user_id,created_at",
    )
    .like("user_id", "test-%")
    .eq("status", "completed")
    .eq("slide_count", 5)
    .not("website_analysis_id", "is", null)
    .not("category_slug", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Could not list carousel canary templates: ${error.message}`);
  }

  for (const candidate of data ?? []) {
    const { count, error: countError } = await supabase
      .from("category_image_assets")
      .select("id", { count: "exact", head: true })
      .eq("category_slug", candidate.category_slug)
      .eq("status", "ready");

    if (countError) {
      throw new Error(
        `Could not count carousel category assets: ${countError.message}`,
      );
    }

    if ((count ?? 0) >= candidate.slide_count) {
      return candidate;
    }
  }

  throw new Error(
    "No completed test carousel has enough ready category assets for an AWS smoke test.",
  );
}

async function createCanaryGeneration(template) {
  const { data, error } = await supabase
    .from("carousel_generations")
    .insert({
      candidate_count: 1,
      candidate_index: 0,
      category_slug: template.category_slug,
      format: template.format,
      generation_batch_id: randomUUID(),
      goal: template.goal,
      project_id: "aws-carousel-canary",
      selected_angle: template.selected_angle,
      slide_count: template.slide_count,
      status: "processing",
      user_id: "aws-carousel-canary",
      website_analysis_id: template.website_analysis_id,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Could not create carousel canary: ${error?.message ?? "missing id"}`,
    );
  }

  return data.id;
}

async function createBackgroundJob(carouselId) {
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      input_json: {
        candidateCount: 1,
        candidateIndex: 0,
        carouselId,
      },
      job_type: "generate_carousel",
      project_id: "aws-carousel-canary",
      queue_name: "carousel",
      status: "queued",
      updated_at: new Date().toISOString(),
      user_id: "aws-carousel-canary",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create carousel background job: ${error.message}`);
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
    throw new Error(`Could not update carousel background job: ${error.message}`);
  }
}

async function pollCarousel(backgroundJobId, carouselId) {
  const deadline = Date.now() + 10 * 60 * 1000;

  while (Date.now() < deadline) {
    const [backgroundJobResult, carouselResult, slidesResult] =
      await Promise.all([
        supabase
          .from("background_jobs")
          .select("id,status,error_message,output_json")
          .eq("id", backgroundJobId)
          .single(),
        supabase
          .from("carousel_generations")
          .select(
            "id,status,error_message,created_at,content_plan_raw_response,content_plan_normalized,content_planner_version,content_planner_model,content_plan_source,content_plan_fallback_reason,content_plan_validation,renderer_version",
          )
          .eq("id", carouselId)
          .single(),
        supabase
          .from("carousel_slides")
          .select("slide_number,status,headline,subtext,cta_text,rendered_url")
          .eq("carousel_generation_id", carouselId)
          .order("slide_number", { ascending: true }),
      ]);

    if (backgroundJobResult.error) {
      throw new Error(
        `Could not poll background job: ${backgroundJobResult.error.message}`,
      );
    }

    if (carouselResult.error) {
      throw new Error(
        `Could not poll carousel: ${carouselResult.error.message}`,
      );
    }

    if (slidesResult.error) {
      throw new Error(
        `Could not poll carousel slides: ${slidesResult.error.message}`,
      );
    }

    console.log(
      `poll background=${backgroundJobResult.data.status} carousel=${carouselResult.data.status} slides=${slidesResult.data.length}`,
    );

    if (
      ["cancelled", "completed", "failed"].includes(
        backgroundJobResult.data.status,
      )
    ) {
      return {
        backgroundJob: backgroundJobResult.data,
        carousel: carouselResult.data,
        slides: slidesResult.data,
      };
    }

    await sleep(5_000);
  }

  throw new Error("Timed out waiting for carousel generation.");
}

async function saveFreshCarouselArtifact(result) {
  const outputDir = resolve(".tmp", "carousel-aws-e2e", result.carousel.id);
  const files = [];

  await mkdir(outputDir, { recursive: true });

  for (const slide of result.slides) {
    const response = await fetch(slide.rendered_url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(
        `Could not download fresh slide ${slide.slide_number}: ${response.status}`,
      );
    }

    const outputPath = join(
      outputDir,
      `slide-${String(slide.slide_number).padStart(2, "0")}.webp`,
    );

    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    files.push(outputPath);
  }

  const contactSheet = join(outputDir, "contact-sheet.webp");
  const tileWidth = 324;
  const tileHeight = 405;
  const gap = 20;
  const labelHeight = 38;
  const composites = [];

  for (const [index, file] of files.entries()) {
    const image = await sharp(file)
      .resize(tileWidth, tileHeight, { fit: "contain", background: "#f5f5f5" })
      .webp()
      .toBuffer();
    const left = gap + index * (tileWidth + gap);
    const label = Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><text x="${tileWidth / 2}" y="25" text-anchor="middle" font-family="Arial" font-size="16" fill="#111111">${basename(file)}</text></svg>`);

    composites.push({ input: image, left, top: gap });
    composites.push({ input: label, left, top: gap + tileHeight });
  }

  await sharp({
    create: {
      background: "#ffffff",
      channels: 4,
      height: tileHeight + labelHeight + gap * 2,
      width: files.length * tileWidth + (files.length + 1) * gap,
    },
  })
    .composite(composites)
    .webp({ quality: 92 })
    .toFile(contactSheet);

  const auditPath = join(outputDir, "generation-audit.json");

  await writeFile(
    auditPath,
    `${JSON.stringify({ generation: result.carousel, slides: result.slides }, null, 2)}\n`,
    "utf8",
  );

  return { auditPath, contactSheet, files, outputDir };
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
