import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

loadEnvFile(resolve(".env.local"));

const sourcePath = resolve(
  process.argv[2] || "C:\\Users\\chund\\Downloads\\dd.mp4",
);

if (!existsSync(sourcePath)) {
  throw new Error(`Source video does not exist: ${sourcePath}`);
}

const renderId = randomUUID();
const sourceVideoId = `canary-${renderId.slice(0, 8)}`;
const userId = "aws-render-canary";
const projectId = "aws-render-canary";
const ratio = "9:16";
const overlayText =
  process.env.AWS_RENDER_CANARY_TEXT?.replace(/\\n/g, "\n") ||
  "This text was rendered by AWS";
const sourceKey = [
  "videos",
  "source",
  "canary",
  `${sourceVideoId}${extname(sourcePath) || ".mp4"}`,
].join("/");
const sourceVideoUrl = buildCloudFrontUrl(sourceKey);
const draft = {
  trimStartSeconds: 0,
  trimEndSeconds: null,
  textOverlays: [
    {
      id: `overlay-${renderId.slice(0, 8)}`,
      position: "bottom",
      style: "bubble",
      text: overlayText,
    },
  ],
};
const renderPayload = {
  draft,
  projectId,
  ratio,
  renderId,
  sourceVideoId,
  sourceVideoUrl,
  userId,
};

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
const s3 = new S3Client({
  credentials: getS3Credentials(),
  region: getRequiredEnv("AWS_REGION"),
});
const sqs = new SQSClient({
  credentials: getSqsCredentials(),
  region: getRequiredEnv("AWS_REGION"),
});

console.log(`Uploading source video: ${sourcePath}`);
await s3.send(
  new PutObjectCommand({
    Body: readFileSync(sourcePath),
    Bucket: getRequiredEnv("AWS_S3_BUCKET"),
    CacheControl: "public, max-age=31536000, immutable",
    ContentType: "video/mp4",
    Key: sourceKey,
  }),
);

console.log(`Source URL: ${sourceVideoUrl}`);
await upsertEditableVideo();
await insertVideoRenderJob();
const backgroundJob = await insertBackgroundJob();
const message = await sqs.send(
  new SendMessageCommand({
    MessageBody: JSON.stringify({
      jobId: backgroundJob.id,
      jobType: "render_edit_video",
    }),
    QueueUrl: getRequiredEnv("UGC_VIDEO_RENDER_QUEUE_URL"),
  }),
);

if (!message.MessageId) {
  throw new Error("SQS did not return a message id.");
}

await updateBackgroundJob(backgroundJob.id, {
  aws_message_id: message.MessageId,
});

console.log(`Queued render job: ${backgroundJob.id}`);
console.log(`Render id: ${renderId}`);
console.log(`SQS message id: ${message.MessageId}`);

const result = await pollRender(backgroundJob.id);

console.log("Final status:");
console.log(JSON.stringify(result, null, 2));

if (result.backgroundJob.status !== "completed") {
  process.exitCode = 1;
}

async function upsertEditableVideo() {
  const { error } = await supabase.from("editable_videos").upsert(
    {
      draft_json: draft,
      latest_render_id: renderId,
      project_id: projectId,
      ratio,
      source: "demo",
      source_video_id: sourceVideoId,
      source_video_url: sourceVideoUrl,
      status: "rendering",
      title: `AWS render canary - ${basename(sourcePath)}`,
      updated_at: new Date().toISOString(),
      user_id: userId,
    },
    {
      onConflict: "user_id,project_id,source_video_id",
    },
  );

  if (error) {
    throw new Error(`Could not upsert editable video: ${error.message}`);
  }
}

async function insertVideoRenderJob() {
  const { error } = await supabase.from("video_render_jobs").insert({
    draft_json: draft,
    project_id: projectId,
    ratio,
    render_id: renderId,
    source_video_id: sourceVideoId,
    source_video_url: sourceVideoUrl,
    status: "queued",
    updated_at: new Date().toISOString(),
    user_id: userId,
  });

  if (error) {
    throw new Error(`Could not insert video render job: ${error.message}`);
  }
}

async function insertBackgroundJob() {
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      input_json: renderPayload,
      job_type: "render_edit_video",
      project_id: projectId,
      queue_name: "video-render",
      status: "queued",
      updated_at: new Date().toISOString(),
      user_id: userId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not insert background job: ${error.message}`);
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
    throw new Error(`Could not update background job: ${error.message}`);
  }
}

async function pollRender(backgroundJobId) {
  const deadline = Date.now() + 10 * 60 * 1000;

  while (Date.now() < deadline) {
    const backgroundJob = await getBackgroundJob(backgroundJobId);
    const renderJob = await getRenderJob(renderId);

    console.log(
      `poll background=${backgroundJob.status} render=${renderJob?.status ?? "missing"}`,
    );

    if (["cancelled", "completed", "failed"].includes(backgroundJob.status)) {
      return {
        backgroundJob: {
          errorMessage: backgroundJob.error_message,
          id: backgroundJob.id,
          output: backgroundJob.output_json,
          status: backgroundJob.status,
        },
        renderJob: renderJob
          ? {
              errorMessage: renderJob.error_message,
              outputS3Key: renderJob.output_s3_key,
              outputUrl: renderJob.output_url,
              status: renderJob.status,
            }
          : null,
      };
    }

    await sleep(5_000);
  }

  throw new Error("Timed out waiting for render job to complete.");
}

async function getBackgroundJob(jobId) {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) {
    throw new Error(`Could not read background job: ${error.message}`);
  }

  return data;
}

async function getRenderJob(id) {
  const { data, error } = await supabase
    .from("video_render_jobs")
    .select("*")
    .eq("render_id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read render job: ${error.message}`);
  }

  return data;
}

function buildCloudFrontUrl(key) {
  const domain = getRequiredEnv("CLOUDFRONT_DOMAIN");
  const domainWithScheme = /^https?:\/\//i.test(domain)
    ? domain
    : `https://${domain}`;

  return `${domainWithScheme.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

function getS3Credentials() {
  return {
    accessKeyId:
      process.env.AWS_ACCESS_KEY_ID?.trim() ||
      getRequiredEnv("AWS_DEPLOY_ACCESS_KEY_ID"),
    secretAccessKey:
      process.env.AWS_SECRET_ACCESS_KEY?.trim() ||
      getRequiredEnv("AWS_DEPLOY_SECRET_ACCESS_KEY"),
  };
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

    if (process.env[key] !== undefined) {
      continue;
    }

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

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
