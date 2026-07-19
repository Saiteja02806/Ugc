import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  auditAwsMediaForGcpBackfill,
  printAwsMediaBackfillAuditReport,
} from "../lib/internal/aws-media-backfill-audit.ts";

const defaultEnvFilePath = resolve(".env.local");
const options = parseArguments(process.argv.slice(2));
const loadedEnvFilePath = resolve(options.envFile ?? defaultEnvFilePath);

loadEnvFile(loadedEnvFilePath);

const report = await auditAwsMediaForGcpBackfill({
  envFile: loadedEnvFilePath,
  pageSize: options.pageSize,
  sampleLimit: options.sampleLimit,
});

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printAwsMediaBackfillAuditReport(report);
}

if (options.strict && report.totals.awsMediaReferences > 0) {
  process.exitCode = 1;
}

function parseArguments(args) {
  const parsed = {
    envFile: null,
    json: false,
    pageSize: null,
    sampleLimit: null,
    strict: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--json") {
      parsed.json = true;
      continue;
    }

    if (argument === "--strict") {
      parsed.strict = true;
      continue;
    }

    if (argument === "--env-file") {
      parsed.envFile = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--page-size") {
      parsed.pageSize = Number(getRequiredArgumentValue(args, (index += 1), argument));
      continue;
    }

    if (argument === "--sample-limit") {
      parsed.sampleLimit = Number(
        getRequiredArgumentValue(args, (index += 1), argument),
      );
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
