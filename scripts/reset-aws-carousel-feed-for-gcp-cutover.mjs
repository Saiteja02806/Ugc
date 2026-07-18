import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

loadEnvFile(".env.local");

const args = parseArgs(process.argv.slice(2));
const userId = getArgValue(args, "user-id") || process.env.CAROUSEL_CUTOVER_USER_ID;
const localDate =
  getArgValue(args, "local-date") ||
  getLocalDateForTimezone(getArgValue(args, "timezone") || "Asia/Calcutta");
const execute = args.has("execute");
const yes = args.has("yes");

if (!userId) {
  throw new Error(
    "Missing --user-id. Pass the Firebase user ID whose Trending feed should be reset.",
  );
}

if (execute && !yes) {
  throw new Error("Pass --yes with --execute to mutate production feed rows.");
}

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

const feed = await loadFeed({ localDate, userId });

if (!feed) {
  console.log(
    JSON.stringify(
      {
        execute,
        localDate,
        message: "No daily carousel feed exists for this user/date.",
        resetFeedItemCount: 0,
        userId,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const feedItems = await loadFeedItems(feed.id);
const assignments = await loadAssignments(
  feedItems.map((item) => item.assignment_id),
);
const assignmentById = new Map(
  assignments.map((assignment) => [assignment.id, assignment]),
);
const carouselIds = assignments.map((assignment) => assignment.carousel_id);
const [generations, slides] = await Promise.all([
  loadGenerations(carouselIds),
  loadSlides(carouselIds),
]);
const generationById = new Map(
  generations.map((generation) => [generation.id, generation]),
);
const slidesByCarouselId = groupBy(slides, (slide) => slide.carousel_generation_id);
const rows = feedItems.map((item) => {
  const assignment = assignmentById.get(item.assignment_id) ?? null;
  const generation = assignment
    ? generationById.get(assignment.carousel_id) ?? null
    : null;
  const generationSlides = assignment
    ? slidesByCarouselId.get(assignment.carousel_id) ?? []
    : [];
  const providerSummary = summarize(
    generationSlides.map((slide) => getStorageProviderFromUrl(slide.rendered_url)),
  );
  const hasOnlyGcpSlides =
    generationSlides.length > 0 &&
    Object.keys(providerSummary).length === 1 &&
    providerSummary.gcp === generationSlides.length;

  return {
    assignment,
    feedItem: item,
    generation,
    hasOnlyGcpSlides,
    providerSummary,
    slideCount: generationSlides.length,
  };
});
const rowsToReset = rows.filter((row) => !row.hasOnlyGcpSlides);
const feedItemIdsToDelete = rowsToReset.map((row) => row.feedItem.id);
const activeAssignmentIdsToFail = rowsToReset
  .map((row) => row.assignment)
  .filter(
    (assignment) =>
      assignment &&
      (assignment.state === "pending" || assignment.state === "in_progress"),
  )
  .map((assignment) => assignment.id);

if (execute && rowsToReset.length > 0) {
  await deleteFeedItems(feedItemIdsToDelete);
  await failActiveAssignments(activeAssignmentIdsToFail);
}

console.log(
  JSON.stringify(
    {
      execute,
      feed: {
        id: feed.id,
        localDate: feed.local_date,
        status: feed.status,
        timezone: feed.timezone,
      },
      inspectedFeedItemCount: feedItems.length,
      resetActiveAssignmentCount: activeAssignmentIdsToFail.length,
      resetFeedItemCount: rowsToReset.length,
      resetRows: rowsToReset.map((row) => ({
        assignmentId: row.assignment?.id ?? null,
        assignmentState: row.assignment?.state ?? null,
        carouselId: row.assignment?.carousel_id ?? null,
        feedItemId: row.feedItem.id,
        generationCreatedAt: row.generation?.created_at ?? null,
        position: row.feedItem.position,
        providerSummary: row.providerSummary,
        slideCount: row.slideCount,
      })),
      userId,
    },
    null,
    2,
  ),
);

async function loadFeed(params) {
  const { data, error } = await supabase
    .from("daily_carousel_feeds")
    .select("*")
    .eq("user_id", params.userId)
    .eq("local_date", params.localDate)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load daily carousel feed: ${error.message}`);
  }

  return data ?? null;
}

async function loadFeedItems(feedId) {
  const { data, error } = await supabase
    .from("daily_carousel_feed_items")
    .select("*")
    .eq("feed_id", feedId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(`Could not load daily carousel feed items: ${error.message}`);
  }

  return data ?? [];
}

async function loadAssignments(assignmentIds) {
  const uniqueAssignmentIds = unique(assignmentIds);

  if (uniqueAssignmentIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_carousel_assignments")
    .select("*")
    .in("id", uniqueAssignmentIds);

  if (error) {
    throw new Error(`Could not load carousel assignments: ${error.message}`);
  }

  return data ?? [];
}

async function loadGenerations(carouselIds) {
  const uniqueCarouselIds = unique(carouselIds);

  if (uniqueCarouselIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("carousel_generations")
    .select("*")
    .in("id", uniqueCarouselIds);

  if (error) {
    throw new Error(`Could not load carousel generations: ${error.message}`);
  }

  return data ?? [];
}

async function loadSlides(carouselIds) {
  const uniqueCarouselIds = unique(carouselIds);

  if (uniqueCarouselIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("carousel_slides")
    .select("carousel_generation_id,rendered_url,status")
    .in("carousel_generation_id", uniqueCarouselIds);

  if (error) {
    throw new Error(`Could not load carousel slides: ${error.message}`);
  }

  return data ?? [];
}

async function deleteFeedItems(feedItemIds) {
  if (feedItemIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("daily_carousel_feed_items")
    .delete()
    .in("id", feedItemIds);

  if (error) {
    throw new Error(`Could not delete AWS feed items: ${error.message}`);
  }
}

async function failActiveAssignments(assignmentIds) {
  const uniqueAssignmentIds = unique(assignmentIds);

  if (uniqueAssignmentIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("user_carousel_assignments")
    .update({
      state: "failed",
      updated_at: new Date().toISOString(),
    })
    .in("id", uniqueAssignmentIds)
    .in("state", ["pending", "in_progress"]);

  if (error) {
    throw new Error(`Could not fail active AWS assignments: ${error.message}`);
  }
}

function getStorageProviderFromUrl(url) {
  if (!url) {
    return "missing";
  }

  if (url.includes("storage.googleapis.com/ugcsaas-media")) {
    return "gcp";
  }

  if (url.includes("cloudfront.net") || url.includes("amazonaws.com")) {
    return "aws";
  }

  return "unknown";
}

function summarize(values) {
  const summary = {};

  for (const value of values) {
    summary[value] = (summary[value] ?? 0) + 1;
  }

  return summary;
}

function groupBy(values, getKey) {
  const groups = new Map();

  for (const value of values) {
    const key = getKey(value);
    const group = groups.get(key) ?? [];

    group.push(value);
    groups.set(key, group);
  }

  return groups;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseArgs(rawArgs) {
  const parsed = new Map();

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const name = arg.slice(2);
    const next = rawArgs[index + 1];

    if (!next || next.startsWith("--")) {
      parsed.set(name, true);
    } else {
      parsed.set(name, next);
      index += 1;
    }
  }

  return parsed;
}

function getArgValue(argsMap, name) {
  const value = argsMap.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function getLocalDateForTimezone(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(trimmed);

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

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${names[0]}`);
}
