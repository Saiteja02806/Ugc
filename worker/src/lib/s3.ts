import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type UploadBufferToS3Params = {
  buffer: Buffer;
  cacheControl?: string;
  contentType: string;
  key: string;
};

let s3Client: S3Client | null = null;

export async function uploadBufferToS3(params: UploadBufferToS3Params) {
  const bucket = getRequiredEnv("AWS_S3_BUCKET");
  const cleanKey = cleanS3Key(params.key);

  await getS3Client().send(
    new PutObjectCommand({
      Body: params.buffer,
      Bucket: bucket,
      CacheControl:
        params.cacheControl ?? "public, max-age=31536000, immutable",
      ContentType: params.contentType,
      Key: cleanKey,
    }),
  );

  return {
    key: cleanKey,
    url: buildCloudFrontUrl(cleanKey),
  };
}

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: getRequiredEnv("AWS_REGION"),
    });
  }

  return s3Client;
}

function buildCloudFrontUrl(key: string) {
  const domain = getRequiredEnv("CLOUDFRONT_DOMAIN");
  const domainWithScheme = /^https?:\/\//i.test(domain)
    ? domain
    : `https://${domain}`;
  const cleanDomain = domainWithScheme.replace(/\/$/, "");

  return `${cleanDomain}/${cleanS3Key(key)}`;
}

function cleanS3Key(key: string) {
  return key.replace(/^\//, "");
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
