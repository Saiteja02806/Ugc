import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

const DEFAULT_BASE_URL = "http://127.0.0.1:4301";
const DEFAULT_PROJECT_ID = "test-project-001";
const DEFAULT_SOURCE_PATH = "local-run-logs/demo-upload-test.mp4";
const DRAFT_TEXT = "Slice 5 demo draft saved";

loadEnvFile(resolve(".env.local"));

const args = parseArgs(process.argv.slice(2));
const baseUrl = (args.baseUrl || process.env.DEMO_E2E_BASE_URL || DEFAULT_BASE_URL)
  .replace(/\/$/, "");
const sourcePath = resolve(args.file || process.env.DEMO_E2E_SOURCE_FILE || DEFAULT_SOURCE_PATH);
const projectId = args.projectId || process.env.DEMO_E2E_PROJECT_ID || DEFAULT_PROJECT_ID;
const cleanup = Boolean(args.cleanup);
const keepFailed = Boolean(args.keepFailed);
const token = getRequiredEnv("EDIT_RENDER_E2E_TEST_TOKEN");
const userId = process.env.EDIT_RENDER_E2E_USER_ID?.trim() || "edit-render-e2e";
let createdDemoForCleanup = null;

if (!existsSync(sourcePath)) {
  throw new Error(`Demo E2E source video does not exist: ${sourcePath}`);
}

const fileBuffer = readFileSync(sourcePath);
const contentType = getContentTypeForPath(sourcePath);
const fileName = basename(sourcePath);
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

console.log("Starting demo upload + draft E2E test");
console.log(`Base URL: ${baseUrl}`);
console.log(`Source file: ${sourcePath}`);
console.log(`Project ID: ${projectId}`);
console.log(`Cleanup: ${cleanup ? "enabled" : "disabled"}`);

try {
  const createUpload = await postJson("/api/demo/create-upload-url", {
    contentType,
    fileName,
    fileSize: fileBuffer.byteLength,
    projectId,
    title: `Demo E2E ${new Date().toISOString()}`,
  });

  const uploadUrl = assertString(createUpload.uploadUrl, "uploadUrl");
  const demoId = assertString(createUpload.demoId, "demoId");
  const key = assertString(createUpload.key, "key");
  createdDemoForCleanup = { demoId, key };

  console.log(`Created upload row: ${demoId}`);
  console.log(`S3 key: ${key}`);

  const putResponse = await fetch(uploadUrl, {
    body: fileBuffer,
    headers: {
      "Content-Type": contentType,
    },
    method: "PUT",
  });

  if (!putResponse.ok) {
    throw new Error(`S3 upload failed with HTTP ${putResponse.status}`);
  }

  console.log("Uploaded source video to S3");

  const completeUpload = await postJson("/api/demo/complete-upload", {
    demoId,
    durationSeconds: 5,
    height: 1920,
    key,
    projectId,
    ratio: "9:16",
    width: 1080,
  });

  if (completeUpload.ok !== true) {
    throw new Error("Complete upload response did not return ok=true");
  }

  console.log("Completed upload verification");

  const listResponse = await getJson(
    `/api/demo/list?projectId=${encodeURIComponent(projectId)}`,
  );
  const listedDemo = Array.isArray(listResponse.demos)
    ? listResponse.demos.find((demo) => demo.id === demoId)
    : null;

  if (!listedDemo) {
    throw new Error("Uploaded demo was not returned by /api/demo/list");
  }

  console.log("Verified demo appears in library list");

  const detailResponse = await getJson(
    `/api/demo/${encodeURIComponent(demoId)}?projectId=${encodeURIComponent(projectId)}`,
  );

  if (detailResponse.demo?.id !== demoId) {
    throw new Error("Demo detail route did not return the uploaded demo");
  }

  console.log("Verified demo detail route");

  const draft = {
    textOverlay: {
      position: "bottom",
      style: "bubble",
      text: DRAFT_TEXT,
    },
    trimEndSeconds: 4,
    trimStartSeconds: 1,
  };

  const patchResponse = await patchJson(`/api/demo/${encodeURIComponent(demoId)}`, {
    draft,
    projectId,
    status: "draft",
    title: `Draft ${fileName}`,
  });

  if (patchResponse.demo?.status !== "draft") {
    throw new Error("Draft save did not update status to draft");
  }

  console.log("Saved demo draft through PATCH route");

  const databaseRow = await getDemoRow(demoId);

  assertEqual(databaseRow.user_id, userId, "database user_id");
  assertEqual(databaseRow.project_id, projectId, "database project_id");
  assertEqual(databaseRow.status, "draft", "database status");
  assertEqual(databaseRow.source_s3_key, key, "database source_s3_key");
  assertEqual(
    databaseRow.draft_json?.textOverlay?.text,
    DRAFT_TEXT,
    "database draft text",
  );
  assertEqual(databaseRow.draft_json?.trimStartSeconds, 1, "database trim start");
  assertEqual(databaseRow.draft_json?.trimEndSeconds, 4, "database trim end");

  console.log("Verified persisted Supabase draft_json");

  if (cleanup) {
    await cleanupCreatedDemo(createdDemoForCleanup);
    createdDemoForCleanup = null;

    console.log("Cleaned up demo row through delete API");
  }

  console.log(
    JSON.stringify(
      {
        demoEditorUrl: `/demos/${encodeURIComponent(demoId)}`,
        demoId,
        key,
        ok: true,
        projectId,
        userId,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (createdDemoForCleanup && !keepFailed) {
    try {
      await cleanupCreatedDemo(createdDemoForCleanup);
      console.log("Cleaned up partial demo row after failed test");
    } catch (cleanupError) {
      console.error("Could not clean up partial demo row:", cleanupError);
    }
  }

  throw error;
}

async function postJson(path, body) {
  return requestJson(path, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

async function patchJson(path, body) {
  return requestJson(path, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
}

async function deleteJson(path, body) {
  return requestJson(path, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "DELETE",
  });
}

async function cleanupCreatedDemo(createdDemo) {
  await deleteJson("/api/demo/delete", {
    demoId: createdDemo.demoId,
    key: createdDemo.key,
    projectId,
  });
}

async function getJson(path) {
  return requestJson(path, {
    method: "GET",
  });
}

async function requestJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || body?.ok === false) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed with HTTP ${response.status}: ${
        body?.error ?? "No JSON error message"
      }`,
    );
  }

  return body;
}

async function getDemoRow(demoId) {
  const { data, error } = await supabase
    .from("demo_videos")
    .select("*")
    .eq("id", demoId)
    .single();

  if (error) {
    throw new Error(`Could not verify demo row in Supabase: ${error.message}`);
  }

  return data;
}

function getContentTypeForPath(path) {
  const extension = extname(path).toLowerCase();

  if (extension === ".mp4") {
    return "video/mp4";
  }

  if (extension === ".mov") {
    return "video/quicktime";
  }

  if (extension === ".webm") {
    return "video/webm";
  }

  throw new Error("Demo E2E source file must be MP4, MOV, or WebM.");
}

function parseArgs(rawArgs) {
  const parsed = {
    baseUrl: "",
    cleanup: false,
    file: "",
    keepFailed: false,
    projectId: "",
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--cleanup") {
      parsed.cleanup = true;
      continue;
    }

    if (arg === "--keep-failed") {
      parsed.keepFailed = true;
      continue;
    }

    if (arg === "--base-url") {
      parsed.baseUrl = rawArgs[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--file") {
      parsed.file = rawArgs[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--project-id") {
      parsed.projectId = rawArgs[index + 1] ?? "";
      index += 1;
    }
  }

  return parsed;
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

function getRequiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required env var: ${names.join(" or ")}`);
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Expected ${label} to be a non-empty string`);
  }

  return value;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${label} to equal ${JSON.stringify(expected)}, got ${JSON.stringify(
        actual,
      )}`,
    );
  }
}
