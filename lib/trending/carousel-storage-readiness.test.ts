import assert from "node:assert/strict";
import test from "node:test";

import type {
  CarouselGenerationRecord,
  CarouselSlideRecord,
} from "../carousel/db.ts";
import {
  getReadySlidesForCurrentStorage,
  isCompleteReadyCarouselForCurrentStorage,
} from "./carousel-storage-readiness.ts";

const STORAGE_ENV_KEYS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_REGION",
  "AWS_S3_BUCKET",
  "AWS_SECRET_ACCESS_KEY",
  "CLOUDFRONT_DOMAIN",
  "GCP_PROJECT_ID",
  "GCP_STORAGE_BUCKET",
  "GCP_STORAGE_PUBLIC_BASE_URL",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_STORAGE_BUCKET",
  "STORAGE_PROVIDER",
  "UGC_STORAGE_PROVIDER",
] as const;

test("accepts AWS-rendered carousel slides before storage cutover", () => {
  withStorageEnv(
    {
      AWS_ACCESS_KEY_ID: "aws-access-key",
      AWS_REGION: "us-east-1",
      AWS_S3_BUCKET: "ugc-aws-media",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
      CLOUDFRONT_DOMAIN: "cdn.example.com",
    },
    () => {
      const slides = [
        slide(1, "https://cdn.example.com/carousels/slide-01.webp"),
        slide(2, "https://cdn.example.com/carousels/slide-02.webp"),
      ];

      assert.equal(
        isCompleteReadyCarouselForCurrentStorage({
          generation: generation(2),
          slides,
        }),
        true,
      );
    },
  );
});

test("rejects AWS-rendered carousel slides after GCP storage cutover", () => {
  withStorageEnv(
    {
      GCP_PROJECT_ID: "ugcsaas",
      GCP_STORAGE_BUCKET: "ugcsaas-media",
      GCP_STORAGE_PUBLIC_BASE_URL: "https://storage.googleapis.com/ugcsaas-media",
      STORAGE_PROVIDER: "gcp",
    },
    () => {
      const slides = [
        slide(1, "https://cdn.example.com/carousels/slide-01.webp"),
        slide(2, "https://cdn.example.com/carousels/slide-02.webp"),
      ];

      assert.equal(
        isCompleteReadyCarouselForCurrentStorage({
          generation: generation(2),
          slides,
        }),
        false,
      );
      assert.deepEqual(getReadySlidesForCurrentStorage(slides), []);
    },
  );
});

test("accepts GCS-rendered carousel slides after GCP storage cutover", () => {
  withStorageEnv(
    {
      GCP_PROJECT_ID: "ugcsaas",
      GCP_STORAGE_BUCKET: "ugcsaas-media",
      GCP_STORAGE_PUBLIC_BASE_URL: "https://storage.googleapis.com/ugcsaas-media",
      STORAGE_PROVIDER: "gcp",
    },
    () => {
      const slides = [
        slide(
          2,
          "https://storage.googleapis.com/ugcsaas-media/carousels/slide-02.webp",
        ),
        slide(
          1,
          "https://storage.googleapis.com/ugcsaas-media/carousels/slide-01.webp",
        ),
      ];

      assert.equal(
        isCompleteReadyCarouselForCurrentStorage({
          generation: generation(2),
          slides,
        }),
        true,
      );
      assert.deepEqual(
        getReadySlidesForCurrentStorage(slides).map((readySlide) => readySlide.slideNumber),
        [1, 2],
      );
    },
  );
});

function generation(slideCount: number) {
  return {
    slideCount,
    status: "completed",
  } as CarouselGenerationRecord;
}

function slide(slideNumber: number, renderedUrl: string) {
  return {
    renderedUrl,
    slideNumber,
    status: "ready",
  } as CarouselSlideRecord;
}

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
