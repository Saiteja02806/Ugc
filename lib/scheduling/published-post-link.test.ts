import assert from "node:assert/strict";
import test from "node:test";
import { getPublishedPostLink, shouldShowExportPreview } from "./published-post-link.ts";
import type { ScheduledPostTarget } from "./types.ts";

const privateTikTok = {
  platform: "tiktok",
  status: "published",
  platformPostUrl: null,
  settings: { privacyLevel: "SELF_ONLY" },
} satisfies Pick<ScheduledPostTarget, "platform" | "status" | "platformPostUrl" | "settings">;

test("the account's private TikTok posts open TikTok with honest instructions", () => {
  const link = getPublishedPostLink(privateTikTok);
  assert.equal(link?.href, "https://www.tiktok.com/");
  assert.equal(link?.label, "Open TikTok");
  assert.match(link?.help ?? "", /Only me.*private posts/);
  assert.equal(shouldShowExportPreview([privateTikTok]), false);
});

test("published platform links preserve the exact post destination", () => {
  for (const [platform, platformPostUrl, label] of [
    ["instagram", "https://www.instagram.com/reel/Ddn4fqEAft0/", "Open on Instagram"],
    ["youtube", "https://www.youtube.com/watch?v=BR5XC5Cm11M", "Open on YouTube"],
    ["tiktok", "https://www.tiktok.com/@creator/video/123456789", "Open on TikTok"],
  ] as const) {
    assert.deepEqual(getPublishedPostLink({ ...privateTikTok, platform, platformPostUrl }), {
      href: platformPostUrl, label, help: null,
    });
  }
});

test("untrusted and file destinations cannot appear as social-post links", () => {
  for (const platformPostUrl of [
    "https://storage.googleapis.com/bucket/export.mp4",
    "https://instagram.com.attacker.example/reel/123",
    "https://www.tiktok.com/@creator/video/123",
    "javascript:alert(1)",
    "http://www.instagram.com/reel/123",
    "https://user:password@www.instagram.com/reel/123",
  ]) {
    assert.equal(getPublishedPostLink({ ...privateTikTok, platform: "instagram", platformPostUrl }), null);
  }
});

test("an unpublished target never gains a platform action from stale URL data", () => {
  const target = { ...privateTikTok, status: "failed" as const, platformPostUrl: "https://www.tiktok.com/@creator/video/123" };
  assert.equal(getPublishedPostLink(target), null);
  assert.equal(shouldShowExportPreview([target]), true);
  assert.equal(shouldShowExportPreview(), true);
});

test("a mixed-platform post retains its successful platform actions without a file action", () => {
  assert.equal(shouldShowExportPreview([{ status: "failed" }, { status: "published" }]), false);
});

test("TikTok without a public link does not falsely claim the post is private", () => {
  const link = getPublishedPostLink({ ...privateTikTok, settings: { privacyLevel: "PUBLIC_TO_EVERYONE" } });
  assert.equal(link?.href, "https://www.tiktok.com/");
  assert.doesNotMatch(link?.help ?? "", /Only me|private posts/);
});
