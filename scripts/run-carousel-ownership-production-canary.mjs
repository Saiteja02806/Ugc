import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(resolve(".env.local"));

const options = parseArguments(process.argv.slice(2));

if (options.mode === "dry-run") {
  printDryRun();
  process.exit(0);
}

if (!options.yes) {
  throw new Error("Refusing to run the production Carousel canary without --yes.");
}

const required = [
  ["userId", options.userId],
  ["projectId", options.projectId],
  ["experimentBatchId", options.experimentBatchId],
];
for (const [name, value] of required) {
  if (!value) throw new Error(`--${toKebabCase(name)} is required for --execute.`);
}

if (options.carouselIds.length !== 5 || new Set(options.carouselIds).size !== 5) {
  throw new Error("--execute requires exactly five distinct --carousel-id values.");
}

const supabase = createClient(
  getRequiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const batch = await getSingle(
  supabase
    .from("carousel_experiment_batches")
    .select("id,status,planner_job_id,business_profile_id,business_profile_version")
    .eq("id", options.experimentBatchId),
  "controlled Carousel experiment batch",
);

if (batch.status !== "reserved" || batch.planner_job_id !== null) {
  throw new Error(
    "The canary batch must be a fresh reserved batch with no planner job. " +
      "Create a new isolated five-item test batch and retry.",
  );
}

const { data: generationRows, error: generationError } = await supabase
  .from("carousel_generations")
  .select(
    "id,candidate_index,carousel_experiment_batch_id,content_plan_item_id,content_plan_reservation_id,trigger_run_id,user_id,project_id",
  )
  .in("id", options.carouselIds)
  .order("candidate_index", { ascending: true });
if (generationError) {
  throw new Error(`Could not read Carousel canary generations: ${generationError.message}`);
}

if (generationRows.length !== 5) {
  throw new Error("The supplied Carousel IDs do not resolve to exactly five rows.");
}

const orderedCarouselIds = generationRows.map((row) => row.id);
const ownershipMismatch = generationRows.some(
  (row) =>
    row.carousel_experiment_batch_id !== options.experimentBatchId ||
    row.user_id !== options.userId ||
    row.project_id !== options.projectId ||
    !row.content_plan_item_id ||
    !row.content_plan_reservation_id ||
    row.trigger_run_id !== null,
);
if (ownershipMismatch) {
  throw new Error(
    "The supplied rows are not five unclaimed candidates owned by this exact test batch.",
  );
}

const { data: planItems, error: planItemError } = await supabase
  .from("carousel_content_plan_items")
  .select("id,status,reserved_by_job_id,reservation_token")
  .in(
    "id",
    generationRows.map((row) => row.content_plan_item_id),
  );
if (planItemError) {
  throw new Error(`Could not read Carousel canary content-plan items: ${planItemError.message}`);
}
if (
  planItems.length !== 5 ||
  planItems.some((item) => item.status !== "reserved" || item.reserved_by_job_id !== null)
) {
  throw new Error("The test batch's five content-plan items are not fresh reservations.");
}

const requests = Array.from({ length: 10 }, () =>
  supabase.rpc("create_or_get_carousel_experiment_batch_job", {
    p_carousel_ids: orderedCarouselIds,
    p_experiment_batch_id: options.experimentBatchId,
    p_project_id: options.projectId,
    p_text_style: options.textStyle,
    p_user_id: options.userId,
  }),
);
const responses = await Promise.all(requests);
const failures = responses.filter((response) => response.error);
if (failures.length > 0) {
  throw new Error(
    `The 10-way ownership race had ${failures.length} database errors: ${failures
      .map((response) => response.error.message)
      .join("; ")}`,
  );
}

const results = responses.map((response) => response.data?.[0]).filter(Boolean);
const jobIds = new Set(results.map((result) => result.job_id));
const createdCount = results.filter((result) => result.created === true).length;
if (results.length !== 10 || jobIds.size !== 1 || createdCount !== 1) {
  throw new Error(
    `Ownership proof failed: ${results.length} results, ${jobIds.size} job IDs, ${createdCount} creators.`,
  );
}

const [jobId] = jobIds;
const [job, finalBatch, finalGenerations, finalPlanItems, assignments] = await Promise.all([
  getSingle(
    supabase
      .from("background_jobs")
      .select("id,status,stage,queue_message_id,idempotency_key,input_json")
      .eq("id", jobId),
    "Carousel canary background job",
  ),
  getSingle(
    supabase
      .from("carousel_experiment_batches")
      .select("id,status,planner_job_id")
      .eq("id", options.experimentBatchId),
    "Carousel canary batch after race",
  ),
  getRows(
    supabase
      .from("carousel_generations")
      .select("id,trigger_run_id")
      .in("id", orderedCarouselIds),
    "Carousel canary generations after race",
  ),
  getRows(
    supabase
      .from("carousel_content_plan_items")
      .select("id,reserved_by_job_id")
      .in(
        "id",
        generationRows.map((row) => row.content_plan_item_id),
      ),
    "Carousel canary content-plan items after race",
  ),
  getRows(
    supabase
      .from("carousel_experiment_assignments")
      .select("carousel_generation_id,status")
      .eq("experiment_batch_id", options.experimentBatchId),
    "Carousel canary assignments after race",
  ),
]);

const expectedIdempotencyKey = `carousel-experiment-batch:${options.experimentBatchId}`;
const proofFailed =
  job.status !== "queued" ||
  job.stage !== "queued" ||
  job.queue_message_id !== null ||
  job.idempotency_key !== expectedIdempotencyKey ||
  finalBatch.planner_job_id !== jobId ||
  finalBatch.status !== "queued" ||
  finalGenerations.length !== 5 ||
  finalGenerations.some((row) => row.trigger_run_id !== jobId) ||
  finalPlanItems.length !== 5 ||
  finalPlanItems.some((item) => item.reserved_by_job_id !== jobId) ||
  assignments.length !== 5 ||
  assignments.some((assignment) => assignment.status !== "queued");

if (proofFailed) {
  throw new Error(
    "The database did not retain one complete, undelivered Carousel ownership record. " +
      "The test job was deliberately left queued for investigation.",
  );
}

if (!options.keepTestBatch) {
  const now = new Date().toISOString();
  const [{ error: cancelJobError }, { error: failBatchError }, { error: failAssignmentError }] =
    await Promise.all([
      supabase
        .from("background_jobs")
        .update({
          completed_at: now,
          error_code: "CANARY_CANCELLED",
          error_message: "Controlled ten-way Carousel database ownership canary completed.",
          stage: "cancelled",
          status: "cancelled",
          updated_at: now,
        })
        .eq("id", jobId)
        .eq("status", "queued"),
      supabase
        .from("carousel_experiment_batches")
        .update({ status: "failed", updated_at: now })
        .eq("id", options.experimentBatchId)
        .eq("planner_job_id", jobId),
      supabase
        .from("carousel_experiment_assignments")
        .update({ status: "failed", updated_at: now })
        .eq("experiment_batch_id", options.experimentBatchId)
        .eq("status", "queued"),
    ]);

  const cleanupError = cancelJobError ?? failBatchError ?? failAssignmentError;
  if (cleanupError) {
    throw new Error(
      `The ownership proof passed, but isolated canary cleanup failed: ${cleanupError.message}`,
    );
  }
}

console.log(
  JSON.stringify(
    {
      createdCount,
      jobId,
      keptTestBatch: options.keepTestBatch,
      proof: {
        assignmentsOwned: 5,
        calls: 10,
        contentPlanItemsOwned: 5,
        distinctJobIds: 1,
        generationRowsOwned: 5,
        queueMessageAttached: false,
      },
      result: "passed",
    },
    null,
    2,
  ),
);

function parseArguments(args) {
  const parsed = {
    carouselIds: [],
    experimentBatchId: null,
    keepTestBatch: false,
    mode: "dry-run",
    projectId: null,
    textStyle: "highlight",
    userId: null,
    yes: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      parsed.mode = "dry-run";
    } else if (argument === "--execute") {
      parsed.mode = "execute";
    } else if (argument === "--yes") {
      parsed.yes = true;
    } else if (argument === "--keep-test-batch") {
      parsed.keepTestBatch = true;
    } else if (argument === "--carousel-id") {
      parsed.carouselIds.push(getValue(args, (index += 1), argument));
    } else if (argument === "--user-id") {
      parsed.userId = getValue(args, (index += 1), argument);
    } else if (argument === "--project-id") {
      parsed.projectId = getValue(args, (index += 1), argument);
    } else if (argument === "--experiment-batch-id") {
      parsed.experimentBatchId = getValue(args, (index += 1), argument);
    } else if (argument === "--text-style") {
      parsed.textStyle = getValue(args, (index += 1), argument);
    } else {
      throw new Error(`Unknown option ${argument}.`);
    }
  }

  if (!["highlight", "plain", "soft-gradient"].includes(parsed.textStyle)) {
    throw new Error("--text-style must be highlight, plain, or soft-gradient.");
  }
  return parsed;
}

function getValue(args, index, flag) {
  const value = args[index]?.trim();
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    process.env[match[1]] = value;
  }
}

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing required environment variable: ${names.join(" or ")}.`);
}

async function getSingle(query, label) {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not read ${label}: ${error.message}`);
  if (!data) throw new Error(`Could not find ${label}.`);
  return data;
}

async function getRows(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`Could not read ${label}: ${error.message}`);
  return data ?? [];
}

function printDryRun() {
  console.log("Carousel ownership production canary dry run");
  console.log(
    "This accepts one freshly reserved, isolated five-item Carousel batch, races its ownership RPC ten times, verifies one durable writer job owns every record, then cancels only that controlled test job.",
  );
  console.log(
    "Run with --execute --yes --user-id <test-user> --project-id <test-project> --experiment-batch-id <batch> followed by five --carousel-id values.",
  );
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
