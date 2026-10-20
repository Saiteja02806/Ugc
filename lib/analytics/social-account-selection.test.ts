import assert from "node:assert/strict";
import test from "node:test";

import {
  getConnectionsForAnalyticsPlatform,
  getEffectiveAnalyticsConnectionId,
  getSocialConnectionAnalyticsLabel,
} from "./social-account-selection.ts";
import type { SocialConnection } from "@/lib/social/types";

const connections: SocialConnection[] = [
  {
    connectedAt: "2026-09-20T10:00:00.000Z",
    expiresAt: null,
    id: "instagram-1",
    platform: "instagram",
    platformAccountId: "instagram-account-1",
    platformAccountName: "Brand Instagram",
    platformAccountUsername: "brand_ig",
    profilePictureUrl: null,
    provider: "meta",
    refreshExpiresAt: null,
    scopes: [],
    status: "connected",
    supportsBackgroundRefresh: false,
    tokenRefreshedAt: null,
    updatedAt: "2026-09-20T10:00:00.000Z",
  },
  {
    connectedAt: "2026-09-20T10:00:00.000Z",
    expiresAt: null,
    id: "youtube-1",
    platform: "youtube",
    platformAccountId: "youtube-channel-1",
    platformAccountName: "Brand YouTube",
    platformAccountUsername: null,
    profilePictureUrl: null,
    provider: "google",
    refreshExpiresAt: null,
    scopes: [],
    status: "connected",
    supportsBackgroundRefresh: true,
    tokenRefreshedAt: null,
    updatedAt: "2026-09-20T10:00:00.000Z",
  },
];

test("keeps account choices within the selected social platform", () => {
  assert.deepEqual(
    getConnectionsForAnalyticsPlatform(connections, "youtube").map(
      (connection) => connection.id,
    ),
    ["youtube-1"],
  );
});

test("resets stale account selections and produces readable labels", () => {
  const instagramConnections = getConnectionsForAnalyticsPlatform(
    connections,
    "instagram",
  );

  assert.equal(
    getEffectiveAnalyticsConnectionId(instagramConnections, "instagram-1"),
    "instagram-1",
  );
  assert.equal(
    getEffectiveAnalyticsConnectionId(instagramConnections, "youtube-1"),
    "all",
  );
  assert.equal(getSocialConnectionAnalyticsLabel(connections[0]), "@brand_ig");
  assert.equal(
    getSocialConnectionAnalyticsLabel(connections[1]),
    "Brand YouTube",
  );
});
