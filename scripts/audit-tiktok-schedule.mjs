import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

loadEnvFile(resolve(".env.local"));

main().catch((error) => {
  console.error(
    `TikTok schedule audit failed: ${error instanceof Error ? error.message : "Unknown error"}`,
  );
  process.exitCode = 1;
});

async function main() {
  const connectionId = getArgument("connection");

  if (!connectionId || !isUuid(connectionId)) {
    throw new Error(
      "Use npm run audit:tiktok -- --connection=<connection-id>.",
    );
  }

  const client = createClient(
    getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const targets = await selectOrThrow(
    client
      .from("scheduled_post_targets")
      .select(
        "id,user_id,scheduled_post_id,status,scheduled_for,created_at,updated_at,settings,metadata,last_error_code,last_error_message,publish_job_id,attempt_count,platform_post_id,platform_post_url",
      )
      .eq("social_connection_id", connectionId)
      .order("created_at", { ascending: false })
      .limit(20),
    "TikTok schedule targets",
  );
  const targetIds = targets.map((target) => target.id);
  const userId = targets[0]?.user_id ?? null;
  const postIds = targets.map((target) => target.scheduled_post_id);
  const jobIds = targets
    .map((target) => target.publish_job_id)
    .filter((jobId) => typeof jobId === "string");
  const [posts, jobs, events, attempts, operations, userTikTokTargets] =
    await Promise.all([
    postIds.length > 0
      ? selectOrThrow(
          client
            .from("scheduled_posts")
            .select(
              "id,title,caption,status,scheduled_for,created_at,updated_at,last_error_code,metadata",
            )
            .in("id", postIds),
          "scheduled posts",
        )
      : [],
    jobIds.length > 0
      ? selectOrThrow(
          client
            .from("background_jobs")
            .select(
              "id,status,stage,created_at,started_at,completed_at,failed_at,attempt_count,error_code,error_message,input_json,output_json",
            )
            .in("id", jobIds),
          "publish jobs",
        )
      : [],
    jobIds.length > 0
      ? selectOrThrow(
          client
            .from("background_job_events")
            .select("job_id,event_type,metadata,created_at")
            .in("job_id", jobIds)
            .order("created_at", { ascending: true }),
          "publish-job events",
        )
      : [],
    targetIds.length > 0
      ? selectOrThrow(
          client
            .from("social_publish_attempts")
            .select(
              "scheduled_post_target_id,attempt_number,status,stage,error_code,error_message,metadata,created_at",
            )
            .in("scheduled_post_target_id", targetIds)
            .order("created_at", { ascending: true }),
          "social publish attempts",
        )
      : [],
    targetIds.length > 0
      ? selectOrThrow(
          client
            .from("social_publish_operations")
            .select(
              "scheduled_post_target_id,status,provider_operation_kind,provider_operation_id,platform_post_id,platform_post_url,last_error_code,last_error_message,metadata,created_at,updated_at",
            )
            .in("scheduled_post_target_id", targetIds),
          "social publish operations",
        )
      : [],
    userId
      ? selectOrThrow(
          client
            .from("scheduled_post_targets")
            .select(
              "id,scheduled_post_id,status,scheduled_for,created_at,updated_at,last_error_code,last_error_message,publish_job_id,attempt_count",
            )
            .eq("user_id", userId)
            .eq("platform", "tiktok")
            .order("created_at", { ascending: false })
            .limit(20),
          "TikTok targets for the connection owner",
        )
      : [],
  ]);
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  console.log(
    JSON.stringify(
      {
        connectionTargets: targets.map(({ user_id, ...target }) => ({
        attempts: attempts.filter(
          (attempt) => attempt.scheduled_post_target_id === target.id,
        ),
        job: target.publish_job_id
          ? jobsById.get(target.publish_job_id) ?? null
          : null,
        jobEvents: target.publish_job_id
          ? events.filter((event) => event.job_id === target.publish_job_id)
          : [],
        operation:
          operations.find(
            (operation) => operation.scheduled_post_target_id === target.id,
          ) ?? null,
        post: postsById.get(target.scheduled_post_id) ?? null,
        target,
        })),
        ownerTikTokTargets: userTikTokTargets,
      },
      null,
      2,
    ),
  );
}

async function selectOrThrow(query, subject) {
  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not load ${subject}: ${error.message}`);
  }

  return data ?? [];
}

function getArgument(name) {
  const prefix = `--${name}=`;

  return process.argv.find((value) => value.startsWith(prefix))?.slice(
    prefix.length,
  );
}

function getRequiredEnv(...names) {
  const value = names
    .map((name) => process.env[name]?.trim())
    .find(Boolean);

  if (!value) {
    throw new Error(`${names.join(" or ")} is not configured.`);
  }

  return value;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    const rawValue = match[2].trim();
    process.env[match[1]] =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
}
