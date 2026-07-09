import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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
  result.slides.some(
    (slide) => slide.status !== "ready" || !slide.rendered_url,
  )
) {
  console.error(JSON.stringify(result, null, 2));
  throw new Error("Carousel worker completed without a full ready slide set.");
} else {
  console.log(
    `Carousel AWS smoke test passed with ${result.slides.length} rendered slides.`,
  );
  console.log(`First slide: ${result.slides[0].rendered_url}`);
}

async function findCanaryTemplate() {
  const { data, error } = await supabase
    .from("carousel_generations")
    .select(
      "website_analysis_id,category_slug,slide_count,format,goal,selected_angle,user_id,created_at",
    )
    .like("user_id", "test-%")
    .eq("status", "completed")
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
          .select("id,status,error_message")
          .eq("id", carouselId)
          .single(),
        supabase
          .from("carousel_slides")
          .select("slide_number,status,rendered_url")
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
