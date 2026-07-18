import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCloudFrontUrl,
  buildDirectS3Url,
  getMissingStorageEnvVars,
  getStorageProviderName,
  isTrustedStorageUrl,
} from "./s3.ts";

const STORAGE_ENV_KEYS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_REGION",
  "AWS_S3_BUCKET",
  "AWS_SECRET_ACCESS_KEY",
  "CLOUDFRONT_DOMAIN",
  "GCP_PROJECT_ID",
  "GCP_STORAGE_BUCKET",
  "GCP_STORAGE_PUBLIC_BASE_URL",
  "GCS_PUBLIC_BASE_URL",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_STORAGE_BUCKET",
  "STORAGE_PROVIDER",
  "UGC_STORAGE_PROVIDER",
] as const;

test("uses AWS storage by default", () => {
  withStorageEnv(
    {
      AWS_ACCESS_KEY_ID: "aws-access-key",
      AWS_REGION: "us-east-1",
      AWS_S3_BUCKET: "ugc-aws-media",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
      CLOUDFRONT_DOMAIN: "cdn.example.com",
    },
    () => {
      assert.equal(getStorageProviderName(), "aws");
      assert.deepEqual(getMissingStorageEnvVars(), []);
      assert.equal(
        buildDirectS3Url("/media/video.mp4"),
        "https://ugc-aws-media.s3.us-east-1.amazonaws.com/media/video.mp4",
      );
      assert.equal(
        buildCloudFrontUrl("media/video.mp4"),
        "https://cdn.example.com/media/video.mp4",
      );
      assert.equal(
        isTrustedStorageUrl("https://cdn.example.com/media/video.mp4"),
        true,
      );
      assert.equal(
        isTrustedStorageUrl(
          "https://ugc-aws-media.s3.us-east-1.amazonaws.com/media/video.mp4",
        ),
        true,
      );
      assert.equal(
        isTrustedStorageUrl("https://other.example.com/media/video.mp4"),
        false,
      );
    },
  );
});

test("uses GCP storage when configured", () => {
  withStorageEnv(
    {
      GCP_PROJECT_ID: "ugcsaas",
      GCP_STORAGE_BUCKET: "ugcsaas-media",
      GCP_STORAGE_PUBLIC_BASE_URL: "https://media.getugcpilot.com",
      STORAGE_PROVIDER: "gcp",
    },
    () => {
      assert.equal(getStorageProviderName(), "gcp");
      assert.deepEqual(getMissingStorageEnvVars(), []);
      assert.equal(
        buildDirectS3Url("/media/video.mp4"),
        "https://storage.googleapis.com/ugcsaas-media/media/video.mp4",
      );
      assert.equal(
        buildCloudFrontUrl("media/video.mp4"),
        "https://media.getugcpilot.com/media/video.mp4",
      );
      assert.equal(
        isTrustedStorageUrl("https://media.getugcpilot.com/media/video.mp4"),
        true,
      );
      assert.equal(
        isTrustedStorageUrl(
          "https://storage.googleapis.com/ugcsaas-media/media/video.mp4",
        ),
        true,
      );
      assert.equal(
        isTrustedStorageUrl(
          "https://other-bucket.storage.googleapis.com/media/video.mp4",
        ),
        false,
      );
    },
  );
});

test("trusts only the configured GCS bucket when public base is storage.googleapis.com", () => {
  withStorageEnv(
    {
      GCP_PROJECT_ID: "ugcsaas",
      GCP_STORAGE_BUCKET: "ugcsaas-media",
      GCP_STORAGE_PUBLIC_BASE_URL: "https://storage.googleapis.com/ugcsaas-media",
      STORAGE_PROVIDER: "gcp",
    },
    () => {
      assert.equal(
        isTrustedStorageUrl(
          "https://storage.googleapis.com/ugcsaas-media/media/video.mp4",
        ),
        true,
      );
      assert.equal(
        isTrustedStorageUrl(
          "https://storage.googleapis.com/other-bucket/media/video.mp4",
        ),
        false,
      );
      assert.equal(
        isTrustedStorageUrl(
          "https://other-bucket.storage.googleapis.com/media/video.mp4",
        ),
        false,
      );
    },
  );
});

function withStorageEnv(
  env: Partial<Record<(typeof STORAGE_ENV_KEYS)[number], string>>,
  fn: () => void,
) {
  const originalEnv = new Map<string, string | undefined>();

  for (const key of STORAGE_ENV_KEYS) {
    originalEnv.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }

    fn();
  } finally {
    for (const [key, value] of originalEnv) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
