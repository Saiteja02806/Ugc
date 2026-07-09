import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CAROUSEL_VERTICALS,
  VISUAL_BUCKETS,
} from "../lib/carousel/visual-bucket-taxonomy.ts";

loadEnvFile(resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const categorySlug = args.category || "productivity-saas";
const vertical = args.vertical || null;
const jsonOutput = args.json === "true";

if (vertical && !CAROUSEL_VERTICALS.includes(vertical)) {
  throw new Error(
    `Unknown vertical "${vertical}". Expected one of: ${CAROUSEL_VERTICALS.join(
      ", ",
    )}`,
  );
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

const scopedBuckets = vertical
  ? VISUAL_BUCKETS.filter((bucket) => bucket.usableVerticals.includes(vertical))
  : VISUAL_BUCKETS;
const results = [];

for (const bucket of scopedBuckets) {
  const { count, error } = await supabase
    .from("category_image_assets")
    .select("id", { count: "exact", head: true })
    .eq("category_slug", categorySlug)
    .eq("status", "ready")
    .eq("subject_review_status", "approved")
    .eq("image_subject_class", "object-only")
    .eq("has_human", false)
    .eq("face_count", 0)
    .eq("person_count", 0)
    .eq("visual_bucket", bucket.id);

  if (error) {
    throw new Error(
      `Could not check bucket "${bucket.id}". Make sure the visual bucket migration is applied. ${
        error.message || JSON.stringify(error)
      }`,
    );
  }

  const readyCount = count ?? 0;

  results.push({
    bucketId: bucket.id,
    bucketType: bucket.bucketType,
    label: bucket.label,
    readyCount,
    targetCount: bucket.targetCount,
    usableVerticals: [...bucket.usableVerticals],
    isReady: readyCount >= bucket.targetCount,
  });
}

const readyBuckets = results.filter((result) => result.isReady).length;
const missingBuckets = results.length - readyBuckets;

if (jsonOutput) {
  console.log(
    JSON.stringify(
      {
        categorySlug,
        missingBuckets,
        readyBuckets,
        totalBuckets: results.length,
        vertical,
        buckets: results,
      },
      null,
      2,
    ),
  );
} else {
  console.log(
    `Carousel visual bucket readiness for ${categorySlug}${
      vertical ? ` (${vertical})` : ""
    }`,
  );
  console.log(`${readyBuckets}/${results.length} buckets ready`);
  console.log("");

  for (const result of results) {
    const state = result.isReady ? "READY" : "MISSING";

    console.log(
      `${state} ${result.bucketId}: ${result.readyCount}/${result.targetCount}`,
    );
  }
}

if (missingBuckets > 0) {
  process.exitCode = 1;
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

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing ${names.join(" or ")}`);
}
