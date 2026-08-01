import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDirectStorageUrl,
  buildPublicStorageUrl,
  getMissingStorageEnvVars,
  getStorageProviderName,
  isTrustedStorageUrl,
} from "./storage.ts";

const STORAGE_ENV_KEYS = [
  "GCP_PROJECT_ID",
  "GCP_STORAGE_BUCKET",
  "GCP_STORAGE_PUBLIC_BASE_URL",
  "GCS_PUBLIC_BASE_URL",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_STORAGE_BUCKET",
] as const;

test("uses GCP storage", () => {
  withStorageEnv(
    {
      GCP_PROJECT_ID: "ugcsaas",
      GCP_STORAGE_BUCKET: "ugcsaas-media",
      GCP_STORAGE_PUBLIC_BASE_URL: "https://media.getugcpilot.com",
    },
    () => {
      assert.equal(getStorageProviderName(), "gcp");
      assert.deepEqual(getMissingStorageEnvVars(), []);
      assert.equal(
        buildDirectStorageUrl("/media/video.mp4"),
        "https://storage.googleapis.com/ugcsaas-media/media/video.mp4",
      );
      assert.equal(
        buildPublicStorageUrl("media/video.mp4"),
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
