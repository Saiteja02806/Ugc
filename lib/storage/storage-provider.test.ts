import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import {
  buildDirectStorageUrl,
  buildPublicStorageUrl,
  createSignedPutUrl,
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

test("MCP signed PUT binds the size and first-write headers only when requested", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const previous = {
    GCP_STORAGE_BUCKET: process.env.GCP_STORAGE_BUCKET,
    GCP_STORAGE_PUBLIC_BASE_URL: process.env.GCP_STORAGE_PUBLIC_BASE_URL,
    GOOGLE_CLOUD_CREDENTIALS_JSON: process.env.GOOGLE_CLOUD_CREDENTIALS_JSON,
  };
  process.env.GCP_STORAGE_BUCKET = "test-mcp-bucket";
  process.env.GCP_STORAGE_PUBLIC_BASE_URL = "https://storage.googleapis.com/test-mcp-bucket";
  process.env.GOOGLE_CLOUD_CREDENTIALS_JSON = JSON.stringify({
    client_email: "local-signer@example.test",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  });
  try {
    const guarded = new URL(await createSignedPutUrl({
      key: "media/test.png", contentType: "image/png", maxBytes: 1024, createOnly: true,
    }));
    const guardedHeaders = guarded.searchParams.get("X-Goog-SignedHeaders")?.split(";") ?? [];
    assert.ok(guardedHeaders.includes("x-goog-content-length-range"));
    assert.ok(guardedHeaders.includes("x-goog-if-generation-match"));

    const ordinary = new URL(await createSignedPutUrl({
      key: "media/website.png", contentType: "image/png",
    }));
    const ordinaryHeaders = ordinary.searchParams.get("X-Goog-SignedHeaders")?.split(";") ?? [];
    assert.ok(!ordinaryHeaders.includes("x-goog-content-length-range"));
    assert.ok(!ordinaryHeaders.includes("x-goog-if-generation-match"));
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
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
