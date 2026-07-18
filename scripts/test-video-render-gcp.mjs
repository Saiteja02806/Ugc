import { PubSub } from "@google-cloud/pubsub";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(resolve(".env.local"));

const options = parseArguments(process.argv.slice(2));
const projectId =
  options.projectId ||
  process.env.GCP_PROJECT_ID?.trim() ||
  process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
  "ugcsaas";
const topicName =
  options.topic ||
  process.env.UGC_VIDEO_RENDER_PUBSUB_TOPIC?.trim() ||
  "ugc-video-render";
const queueName = "video-render";
const sourceVideoUrl =
  options.sourceVideoUrl ||
  process.env.GCP_VIDEO_RENDER_TEST_SOURCE_URL?.trim() ||
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const expectedStorageBaseUrl =
  process.env.GCP_STORAGE_PUBLIC_BASE_URL?.trim() ||
  "https://storage.googleapis.com/ugcsaas-media";
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
const pubsub = new PubSub({ projectId });
const renderId = randomUUID();
const sourceVideoId = randomUUID();
const userId =
  options.userId ||
  process.env.GCP_VIDEO_RENDER_TEST_USER_ID?.trim() ||
  "gcp-video-render-canary";
const editProjectId =
  options.editProjectId ||
  process.env.GCP_VIDEO_RENDER_TEST_PROJECT_ID?.trim() ||
  "gcp-video-render-canary";
const draft = {
  textOverlays: [
    {
      id: "gcp-video-render-canary-overlay",
      position: "bottom",
      style: "bubble",
      text: "GCP render canary",
    },
  ],
  trimEndSeconds: 2.5,
  trimStartSeconds: 0,
};

await createEditableVideoRenderRows();
const backgroundJob = await createBackgroundJob();
const messageId = await pubsub.topic(topicName).publishMessage({
  attributes: {
    jobType: "render_edit_video",
    queueName,
    schema: "ugc-background-job-v1",
    source: "gcp-video-render-canary",
  },
  data: Buffer.from(
    JSON.stringify({
      jobId: backgroundJob.id,
      jobType: "render_edit_video",
    }),
    "utf8",
  ),
});

await updateBackgroundJob(backgroundJob.id, {
  aws_message_id: messageId,
});

console.log(`Video render GCP canary render: ${renderId}`);
console.log(`Background job: ${backgroundJob.id}`);
console.log(`Pub/Sub topic: ${topicName}`);
console.log(`Pub/Sub message: ${messageId}`);

const result = await pollRender(backgroundJob.id);
const output = asObject(result.backgroundJob.output_json);
const outputUrl = typeof output.url === "string" ? output.url : "";

if (
  result.backgroundJob.status !== "completed" ||
  result.renderJob.status !== "completed" ||
  result.editableVideo.status !== "rendered" ||
  !outputUrl.startsWith(expectedStorageBaseUrl) ||
  !String(result.renderJob.output_url ?? "").startsWith(expectedStorageBaseUrl)
) {
  console.error(JSON.stringify(result, null, 2));
  throw new Error("GCP video-render worker completed without a ready GCS render.");
}

await verifyRenderedVideo(outputUrl);

console.log("GCP video-render smoke test passed");
console.log(
  JSON.stringify(
    {
      backgroundJob: {
        id: result.backgroundJob.id,
        status: result.backgroundJob.status,
      },
      render: {
        id: renderId,
        key: output.key,
        url: outputUrl,
      },
      sourceVideoId,
    },
    null,
    2,
  ),
);

function parseArguments(args) {
  const parsed = {
    editProjectId: null,
    projectId: null,
    sourceVideoUrl: null,
    topic: null,
    userId: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--edit-project-id") {
      parsed.editProjectId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--project-id") {
      parsed.projectId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--source-video-url") {
      parsed.sourceVideoUrl = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--topic") {
      parsed.topic = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--user-id") {
      parsed.userId = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
  }

  return parsed;
}

function getRequiredArgumentValue(args, index, flag) {
  const value = args[index]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

async function createEditableVideoRenderRows() {
  const now = new Date().toISOString();
  const { error: editableVideoError } = await supabase
    .from("editable_videos")
    .upsert(
      {
        draft_json: draft,
        latest_render_id: renderId,
        project_id: editProjectId,
        ratio: "9:16",
        rendered_video_url: null,
        source: "draft",
        source_video_id: sourceVideoId,
        source_video_url: sourceVideoUrl,
        status: "rendering",
        title: "GCP video-render canary",
        updated_at: now,
        user_id: userId,
      },
      {
        onConflict: "user_id,project_id,source_video_id",
      },
    );

  if (editableVideoError) {
    throw new Error(
      `Could not create editable video canary row: ${editableVideoError.message}`,
    );
  }

  const { error: renderJobError } = await supabase
    .from("video_render_jobs")
    .insert({
      draft_json: draft,
      project_id: editProjectId,
      ratio: "9:16",
      render_id: renderId,
      source_video_id: sourceVideoId,
      source_video_url: sourceVideoUrl,
      status: "queued",
      updated_at: now,
      user_id: userId,
    });

  if (renderJobError) {
    throw new Error(
      `Could not create video render canary row: ${renderJobError.message}`,
    );
  }
}

async function createBackgroundJob() {
  const { data, error } = await supabase
    .from("background_jobs")
    .insert({
      input_json: {
        draft,
        projectId: editProjectId,
        ratio: "9:16",
        renderId,
        sourceVideoId,
        sourceVideoUrl,
        userId,
      },
      job_type: "render_edit_video",
      project_id: editProjectId,
      queue_name: queueName,
      status: "queued",
      updated_at: new Date().toISOString(),
      user_id: userId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create background job: ${error.message}`);
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
    const [backgroundJobResult, renderJobResult, editableVideoResult] =
      await Promise.all([
        supabase
          .from("background_jobs")
          .select("id,status,error_message,output_json")
          .eq("id", backgroundJobId)
          .single(),
        supabase
          .from("video_render_jobs")
          .select("render_id,status,error_message,output_s3_key,output_url")
          .eq("render_id", renderId)
          .single(),
        supabase
          .from("editable_videos")
          .select("source_video_id,status,latest_render_id,rendered_video_url")
          .eq("user_id", userId)
          .eq("project_id", editProjectId)
          .eq("source_video_id", sourceVideoId)
          .single(),
      ]);

    if (backgroundJobResult.error) {
      throw new Error(
        `Could not poll background job: ${backgroundJobResult.error.message}`,
      );
    }

    if (renderJobResult.error) {
      throw new Error(
        `Could not poll video render job: ${renderJobResult.error.message}`,
      );
    }

    if (editableVideoResult.error) {
      throw new Error(
        `Could not poll editable video: ${editableVideoResult.error.message}`,
      );
    }

    console.log(
      `poll background=${backgroundJobResult.data.status} render=${renderJobResult.data.status} video=${editableVideoResult.data.status}`,
    );

    if (
      ["cancelled", "completed", "failed"].includes(
        backgroundJobResult.data.status,
      )
    ) {
      return {
        backgroundJob: backgroundJobResult.data,
        editableVideo: editableVideoResult.data,
        renderJob: renderJobResult.data,
      };
    }

    await sleep(5_000);
  }

  throw new Error("Timed out waiting for GCP video render.");
}

async function verifyRenderedVideo(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not download rendered video: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length < 1_000) {
    throw new Error("Rendered video download was unexpectedly small.");
  }
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
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
