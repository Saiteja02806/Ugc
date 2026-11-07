#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filename) {
  const fullPath = resolve(process.cwd(), filename);
  if (!existsSync(fullPath)) return;
  const content = readFileSync(fullPath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function parseArgs(argv) {
  let count = 1;
  let label = null;
  let baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://vidmake.io";
  let createdBy = "cli-admin";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--count" || arg === "-n") {
      count = Number.parseInt(argv[i + 1] ?? "1", 10);
      i += 1;
    } else if (arg.startsWith("--count=")) {
      count = Number.parseInt(arg.slice("--count=".length), 10);
    } else if (arg === "--label" || arg === "-l") {
      label = argv[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith("--label=")) {
      label = arg.slice("--label=".length);
    } else if (arg === "--base-url") {
      baseUrl = argv[i + 1] ?? baseUrl;
      i += 1;
    } else if (arg.startsWith("--base-url=")) {
      baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--created-by") {
      createdBy = argv[i + 1] ?? createdBy;
      i += 1;
    }
  }

  const normalizedCount = Math.min(Math.max(Number.isFinite(count) ? count : 1, 1), 50);
  const cleanBaseUrl = baseUrl.replace(/\/+$/u, "");
  return {
    baseUrl: cleanBaseUrl,
    count: normalizedCount,
    createdBy,
    label: label?.trim() ? label.trim().slice(0, 160) : null,
  };
}

async function main() {
  const { baseUrl, count, createdBy, label } = parseArgs(process.argv.slice(2));
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Error: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows = Array.from({ length: count }, () => ({
    code: `fv_${randomBytes(12).toString("base64url")}`,
    created_by_user_id: createdBy,
    label,
    pass_status: "unclaimed",
  }));

  let createdCodes = [];
  const { data, error } = await supabase
    .from("free_video_pass_links")
    .insert(rows)
    .select("id,code,label,pass_status,created_at");

  if (
    error &&
    (error.code === "PGRST205" ||
      error.code === "42P01" ||
      (error.message ?? "").toLowerCase().includes("free_video_pass_links"))
  ) {
    const nowIso = new Date().toISOString();
    const fallbackRows = rows.map((r) => ({
      credit_limit: 1,
      granted_at: nowIso,
      reserved_credits: 0,
      updated_at: nowIso,
      used_credits: 0,
      user_id: `fv_link:${r.code}`,
    }));
    const { data: fbData, error: fbError } = await supabase
      .from("free_generation_credit_balances")
      .insert(fallbackRows)
      .select("user_id,granted_at");

    if (fbError || !Array.isArray(fbData)) {
      console.error(
        `Failed to create free video pass link(s): ${fbError?.message ?? "unknown error"}`,
      );
      process.exitCode = 1;
      return;
    }
    createdCodes = fbData.map((row) => ({
      code: String(row.user_id).slice("fv_link:".length),
      label,
    }));
  } else if (error || !Array.isArray(data)) {
    console.error(
      `Failed to create free video pass link(s): ${error?.message ?? "unknown error"}`,
    );
    process.exitCode = 1;
    return;
  } else {
    createdCodes = data.map((row) => ({
      code: row.code,
      label: row.label,
    }));
  }

  console.log(
    `Created ${createdCodes.length} single-use Free Video Pass link${createdCodes.length === 1 ? "" : "s"} (Hook Video, Text on Screen, or Complete Slideshow — Talking Head excluded):`,
  );
  for (const row of createdCodes) {
    const url = `${baseUrl}/freevideo/${encodeURIComponent(row.code)}`;
    console.log(`- ${url}${row.label ? ` (${row.label})` : ""}`);
  }
}

await main();
