import assert from "node:assert/strict";
import test from "node:test";

import {
  isStoreProductUrl,
  parseStoreProductUrl,
  resolveStoreProductMetadata,
} from "./store-product-metadata.ts";

test("recognizes only supported Apple and Google app-store URLs", () => {
  assert.deepEqual(
    parseStoreProductUrl("https://apps.apple.com/in/app/duolingo-language-chess/id570060128"),
    { appId: "570060128", kind: "app-store" },
  );
  assert.deepEqual(
    parseStoreProductUrl("https://play.google.com/store/apps/details?id=com.brainyscreenblocker"),
    { kind: "play-store", packageId: "com.brainyscreenblocker" },
  );
  assert.equal(isStoreProductUrl("https://duolingo.com"), false);
  assert.equal(isStoreProductUrl("https://play.google.com/store/apps/details?id=../../etc/passwd"), false);
});

test("uses Apple lookup artwork rather than the App Store favicon", async () => {
  const requests: string[] = [];
  const product = await resolveStoreProductMetadata(
    "https://apps.apple.com/in/app/duolingo-language-chess/id570060128",
    async (input) => {
      requests.push(input);
      return {
        json: async () => ({
          results: [{
            artworkUrl512: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/icon.png/512x512bb.jpg",
            trackName: "Duolingo",
          }],
        }),
        ok: true,
        text: async () => "",
      };
    },
  );

  assert.deepEqual(product, {
    iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/icon.png/512x512bb.jpg",
    name: "Duolingo",
    sourceLabel: "App Store",
  });
  assert.match(requests[0], /itunes\.apple\.com\/lookup\?id=570060128/);
});

test("extracts Google Play artwork only from trusted store image hosts", async () => {
  const product = await resolveStoreProductMetadata(
    "https://play.google.com/store/apps/details?id=com.brainyscreenblocker",
    async () => ({
      json: async () => null,
      ok: true,
      text: async () => [
        '<meta content="Focus Shield - Apps on Google Play" property="og:title">',
        '<meta property="og:image" content="https://play-lh.googleusercontent.com/app-icon.png">',
      ].join("\n"),
    }),
  );

  assert.deepEqual(product, {
    iconUrl: "https://play-lh.googleusercontent.com/app-icon.png",
    name: "Focus Shield",
    sourceLabel: "Google Play",
  });
});
