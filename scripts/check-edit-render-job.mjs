import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(resolve(".env.local"));

const jobId = process.argv[2]?.trim();

if (!jobId) {
  throw new Error("Usage: node scripts/check-edit-render-job.mjs <background-job-id>");
}

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

const { data: backgroundJob, error: backgroundJobError } = await supabase
  .from("background_jobs")
  .select("id,job_type,queue_name,status,error_message,output_json,user_id,project_id")
  .eq("id", jobId)
  .single();

if (backgroundJobError) {
  throw new Error(`Could not read background job: ${backgroundJobError.message}`);
}

const output = backgroundJob.output_json ?? {};
const renderId =
  output && typeof output === "object" && "renderId" in output
    ? output.renderId
    : null;

if (typeof renderId !== "string") {
  throw new Error("Background job output does not include a renderId.");
}

const { data: renderJob, error: renderJobError } = await supabase
  .from("video_render_jobs")
  .select("render_id,status,error_message,output_url,output_s3_key,user_id,project_id")
  .eq("render_id", renderId)
  .single();

if (renderJobError) {
  throw new Error(`Could not read render job: ${renderJobError.message}`);
}

console.log(
  JSON.stringify(
    {
      backgroundJob: {
        errorMessage: backgroundJob.error_message,
        id: backgroundJob.id,
        jobType: backgroundJob.job_type,
        outputUrl:
          output && typeof output === "object" && "url" in output
            ? output.url
            : null,
        projectId: backgroundJob.project_id,
        queueName: backgroundJob.queue_name,
        status: backgroundJob.status,
        userId: backgroundJob.user_id,
      },
      renderJob: {
        errorMessage: renderJob.error_message,
        outputS3Key: renderJob.output_s3_key,
        outputUrl: renderJob.output_url,
        projectId: renderJob.project_id,
        renderId: renderJob.render_id,
        status: renderJob.status,
        userId: renderJob.user_id,
      },
    },
    null,
    2,
  ),
);

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
