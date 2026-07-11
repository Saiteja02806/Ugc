import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..");

loadEnvFile(path.join(workspaceRoot, ".env.local"));

const bucket = process.env.AWS_S3_BUCKET?.trim() || "postpilot-media-dev";
const region = process.env.AWS_REGION?.trim() || "us-east-2";
const configuration = JSON.parse(
  readFileSync(path.join(workspaceRoot, "infra", "s3-demo-upload-cors.json"), "utf8"),
);
const credentials = getCredentials();
const client = new S3Client({
  region,
  ...(credentials ? { credentials } : {}),
});

try {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: configuration,
    }),
  );
} catch (error) {
  if (isAccessDenied(error)) {
    console.error(
      [
        `Could not apply S3 CORS to bucket ${bucket}: the selected AWS identity lacks s3:PutBucketCORS.`,
        "Use AWS_DEPLOY_ACCESS_KEY_ID/AWS_DEPLOY_SECRET_ACCESS_KEY with bucket admin permissions,",
        "or apply infra/s3-demo-upload-cors.json in the AWS console.",
      ].join(" "),
    );
    process.exit(1);
  }

  throw error;
}

const applied = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
const expectedOrigins = configuration.CORSRules.flatMap(
  (rule) => rule.AllowedOrigins ?? [],
).sort();
const appliedOrigins = (applied.CORSRules ?? [])
  .flatMap((rule) => rule.AllowedOrigins ?? [])
  .sort();

if (JSON.stringify(appliedOrigins) !== JSON.stringify(expectedOrigins)) {
  throw new Error("S3 returned a CORS configuration that does not match the release file.");
}

console.log(
  JSON.stringify(
    {
      appliedOrigins,
      bucket,
      region,
      ruleCount: applied.CORSRules?.length ?? 0,
    },
    null,
    2,
  ),
);

function getCredentials() {
  const accessKeyId =
    process.env.AWS_DEPLOY_ACCESS_KEY_ID?.trim() ||
    process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey =
    process.env.AWS_DEPLOY_SECRET_ACCESS_KEY?.trim() ||
    process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  const sessionToken =
    process.env.AWS_DEPLOY_SESSION_TOKEN?.trim() ||
    process.env.AWS_SESSION_TOKEN?.trim();

  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
}

function isAccessDenied(error) {
  return (
    error &&
    typeof error === "object" &&
    ("name" in error || "Code" in error) &&
    (error.name === "AccessDenied" || error.Code === "AccessDenied")
  );
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
