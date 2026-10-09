import assert from "node:assert/strict";
import test from "node:test";

import {
  getProtectedMediaDeliveryUrl,
  isPrivateUserMedia,
  verifyProtectedMediaDeliveryToken,
  withPrivateUserMediaMetadata,
} from "./media-delivery.ts";

const assetId = "a39e12d2-b1f4-43f1-8107-af2bc27643cc";
const now = Date.UTC(2026, 8, 29, 12, 0, 0);

test("private media uses an expiring signed application delivery URL", () => {
  const previous = {
    APP_BASE_URL: process.env.APP_BASE_URL,
    MEDIA_DELIVERY_SIGNING_SECRET: process.env.MEDIA_DELIVERY_SIGNING_SECRET,
  };
  process.env.APP_BASE_URL = "https://www.getugcpilot.com";
  process.env.MEDIA_DELIVERY_SIGNING_SECRET = "a test delivery signing secret that is longer than 32 characters";

  try {
    const url = new URL(getProtectedMediaDeliveryUrl(assetId, now));
    assert.equal(url.origin, "https://www.getugcpilot.com");
    assert.equal(url.pathname, `/api/media/delivery/${assetId}`);
    assert.equal(verifyProtectedMediaDeliveryToken({
      assetId,
      expires: url.searchParams.get("expires"),
      signature: url.searchParams.get("signature"),
      variant: url.searchParams.get("variant"),
      now,
    }), true);
    assert.equal(verifyProtectedMediaDeliveryToken({
      assetId,
      expires: url.searchParams.get("expires"),
      signature: "0".repeat(64),
      variant: url.searchParams.get("variant"),
      now,
    }), false);
  } finally {
    process.env.APP_BASE_URL = previous.APP_BASE_URL;
    process.env.MEDIA_DELIVERY_SIGNING_SECRET = previous.MEDIA_DELIVERY_SIGNING_SECRET;
  }
});

test("thumbnail delivery tokens cannot be replayed for the original media", () => {
  const previous = {
    APP_BASE_URL: process.env.APP_BASE_URL,
    MEDIA_DELIVERY_SIGNING_SECRET: process.env.MEDIA_DELIVERY_SIGNING_SECRET,
  };
  process.env.APP_BASE_URL = "https://www.getugcpilot.com";
  process.env.MEDIA_DELIVERY_SIGNING_SECRET = "a test delivery signing secret that is longer than 32 characters";

  try {
    const url = new URL(getProtectedMediaDeliveryUrl(assetId, now, "thumbnail"));
    assert.equal(url.searchParams.get("variant"), "thumbnail");
    assert.equal(verifyProtectedMediaDeliveryToken({
      assetId,
      expires: url.searchParams.get("expires"),
      signature: url.searchParams.get("signature"),
      variant: "original",
      now,
    }), false);
  } finally {
    process.env.APP_BASE_URL = previous.APP_BASE_URL;
    process.env.MEDIA_DELIVERY_SIGNING_SECRET = previous.MEDIA_DELIVERY_SIGNING_SECRET;
  }
});

test("private media metadata cannot be confused with a legacy public row", () => {
  assert.equal(isPrivateUserMedia({ id: assetId, metadata: {} }), false);
  assert.equal(
    isPrivateUserMedia({
      id: assetId,
      metadata: withPrivateUserMediaMetadata({ mcpUpload: true }),
    }),
    true,
  );
});
