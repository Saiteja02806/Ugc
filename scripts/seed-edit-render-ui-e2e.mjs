import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

loadEnvFile(resolve(".env.local"));

const sourcePath = resolve(
  process.argv[2] || "C:\\Users\\chund\\Downloads\\dd.mp4",
);

if (!existsSync(sourcePath)) {
  throw new Error(`Source video does not exist: ${sourcePath}`);
}

const id = `ui-e2e-${randomUUID()}`;
const projectId = "ui-e2e";
const extension = extname(sourcePath) || ".mp4";
const sourceKey = ["videos", "source", "ui-e2e", `${id}${extension}`].join("/");
const sourceVideoUrl = buildCloudFrontUrl(sourceKey);
const video = {
  createdAt: new Date().toISOString(),
  draft: null,
  durationSeconds: null,
  id,
  projectId,
  ratio: "9:16",
  renderedVideoUrl: null,
  source: "demo",
  status: "ready",
  thumbnailUrl: null,
  title: `UI E2E ${basename(sourcePath)}`,
  videoUrl: sourceVideoUrl,
};

const s3 = new S3Client({
  credentials: {
    accessKeyId:
      process.env.AWS_ACCESS_KEY_ID?.trim() ||
      getRequiredEnv("AWS_DEPLOY_ACCESS_KEY_ID"),
    secretAccessKey:
      process.env.AWS_SECRET_ACCESS_KEY?.trim() ||
      getRequiredEnv("AWS_DEPLOY_SECRET_ACCESS_KEY"),
  },
  region: getRequiredEnv("AWS_REGION"),
});

await s3.send(
  new PutObjectCommand({
    Body: readFileSync(sourcePath),
    Bucket: getRequiredEnv("AWS_S3_BUCKET"),
    CacheControl: "public, max-age=31536000, immutable",
    ContentType: "video/mp4",
    Key: sourceKey,
  }),
);

console.log(
  JSON.stringify(
    {
      editUrl: `/edit/${encodeURIComponent(id)}`,
      editableVideoStorageKey: "ugc-studio.editable-videos.v1",
      sourceKey,
      sourceVideoUrl,
      tokenStorageKey: "ugc-studio.edit-render-e2e-token",
      video,
    },
    null,
    2,
  ),
);

function buildCloudFrontUrl(key) {
  const domain = getRequiredEnv("CLOUDFRONT_DOMAIN");
  const domainWithScheme = /^https?:\/\//i.test(domain)
    ? domain
    : `https://${domain}`;

  return `${domainWithScheme.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
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

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
