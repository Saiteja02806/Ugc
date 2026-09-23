import assert from "node:assert/strict";
import test from "node:test";

import type { ScheduledPost } from "@/lib/scheduling/types";
import {
  getTikTokPrivatePublishingRecords,
} from "./tiktok-private-publishing.ts";

test("keeps Only me TikTok publishing records visible without inventing metrics", () => {
  const schedules = [
    createSchedule({
      id: "older-private",
      publishedAt: "2026-09-22T09:00:00.000Z",
      privacyLevel: "SELF_ONLY",
      title: "Private TikTok video",
    }),
    createSchedule({
      id: "public-post",
      publishedAt: "2026-09-23T09:00:00.000Z",
      privacyLevel: "PUBLIC_TO_EVERYONE",
      title: "Public TikTok video",
    }),
    createSchedule({
      id: "newer-private",
      publishedAt: "2026-09-24T09:00:00.000Z",
      privacyLevel: "SELF_ONLY",
      title: "Newest private TikTok video",
    }),
  ];

  assert.deepEqual(getTikTokPrivatePublishingRecords(schedules), [
    {
      connectionId: "tiktok-connection",
      id: "newer-private",
      publishedAt: "2026-09-24T09:00:00.000Z",
      title: "Newest private TikTok video",
    },
    {
      connectionId: "tiktok-connection",
      id: "older-private",
      publishedAt: "2026-09-22T09:00:00.000Z",
      title: "Private TikTok video",
    },
  ]);
});

function createSchedule(params: {
  id: string;
  privacyLevel: string;
  publishedAt: string;
  title: string;
}): ScheduledPost {
  return {
    cancelledAt: null,
    caption: "",
    createdAt: params.publishedAt,
    id: `schedule-${params.id}`,
    idempotencyKey: null,
    lastErrorCode: null,
    libraryItemId: null,
    mediaAssetId: null,
    metadata: {},
    projectId: null,
    publishedAt: params.publishedAt,
    scheduledFor: params.publishedAt,
    sourceKind: "media_asset",
    status: "published",
    targets: [{
      attemptCount: 1,
      cancelledAt: null,
      createdAt: params.publishedAt,
      id: params.id,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastReconciledAt: params.publishedAt,
      nextRetryAt: null,
      platform: "tiktok",
      platformPostId: null,
      platformPostUrl: null,
      publishJobId: null,
      publishedAt: params.publishedAt,
      scheduledFor: params.publishedAt,
      schedulerDeletedAt: null,
      schedulerScheduleArn: null,
      schedulerScheduleName: null,
      settings: { privacyLevel: params.privacyLevel },
      socialConnectionId: "tiktok-connection",
      status: "published",
      updatedAt: params.publishedAt,
    }],
    timezone: "UTC",
    title: params.title,
    updatedAt: params.publishedAt,
  };
}
