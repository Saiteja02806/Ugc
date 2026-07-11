import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

loadEnvFile(path.join(workspaceRoot, ".env.local"));

const bucket = process.env.AWS_S3_BUCKET?.trim() || "postpilot-media-dev";
const region = process.env.AWS_REGION?.trim() || "us-east-2";
const origins = [
  "https://getugcpilot.com",
  "https://www.getugcpilot.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

let failed = false;

console.log(`Checking S3 CORS preflight for bucket ${bucket} in ${region}`);

for (const origin of origins) {
  const response = await fetch(
    `https://${bucket}.s3.${region}.amazonaws.com/demos/raw/cors-check`,
    {
      headers: {
        "Access-Control-Request-Headers": "content-type",
        "Access-Control-Request-Method": "PUT",
        Origin: origin,
      },
      method: "OPTIONS",
    },
  );
  const allowedOrigin = response.headers.get("access-control-allow-origin");
  const allowedMethods = response.headers.get("access-control-allow-methods");
  const allowedHeaders = response.headers.get("access-control-allow-headers");
  const allowsPut = headerListIncludes(allowedMethods, "PUT");
  const allowsContentType =
    headerListIncludes(allowedHeaders, "*") ||
    headerListIncludes(allowedHeaders, "content-type");
  const passed =
    response.ok && allowedOrigin === origin && allowsPut && allowsContentType;

  console.log(
    `${passed ? "PASS" : "FAIL"} ${origin} -> ${response.status} ${allowedOrigin ?? "no allow-origin header"}; methods=${allowedMethods ?? "none"}; headers=${allowedHeaders ?? "none"}`,
  );
  failed ||= !passed;
}

if (failed) {
  process.exitCode = 1;
}

function headerListIncludes(value, expected) {
  if (!value) {
    return false;
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .includes(expected.toLowerCase());
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
