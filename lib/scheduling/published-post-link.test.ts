import assert from "node:assert/strict";
import test from "node:test";
import { getPublishedPostLink, getPostLinkUnavailableReason, shouldShowExportPreview } from "./published-post-link.ts";
import type { ScheduledPostTarget } from "./types.ts";

const privateTikTok = {
  platform: "tiktok",
  status: "published",
  platformPostUrl: null,
  settings: { privacyLevel: "SELF_ONLY" },
} satisfies Pick<ScheduledPostTarget, "platform" | "status" | "platformPostUrl" | "settings">;

test("private TikTok posts without a URL never open the homepage", () => {
  const link = getPublishedPostLink(privateTikTok);
  assert.equal(link, null);
  assert.match(getPostLinkUnavailableReason(privateTikTok), /private TikTok post.*no direct link/);
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
  const target = { ...privateTikTok, settings: { privacyLevel: "PUBLIC_TO_EVERYONE" } };
  assert.equal(getPublishedPostLink(target), null);
  assert.doesNotMatch(getPostLinkUnavailableReason(target), /private/);
});

test("homepages, profiles and feeds cannot be passed off as exact post links", () => {
  for (const [platform, platformPostUrl] of [
    ["instagram", "https://www.instagram.com/"],
    ["instagram", "https://www.instagram.com/clara__talks/"],
    ["youtube", "https://www.youtube.com/"],
    ["youtube", "https://www.youtube.com/@creator"],
    ["youtube", "https://www.youtube.com/watch"],
    ["tiktok", "https://www.tiktok.com/"],
    ["tiktok", "https://www.tiktok.com/@creator"],
    ["tiktok", "https://www.tiktok.com/foryou"],
    ["tiktok", "https://www.tiktok.com/@creator/video/v_pub_file~v2-1.123"],
  ] as const) {
    assert.equal(getPublishedPostLink({ ...privateTikTok, platform, platformPostUrl }), null);
  }
});

test("platform-specific photo, Shorts and share links stay supported", () => {
  for (const [platform, platformPostUrl] of [
    ["instagram", "https://www.instagram.com/p/DdlABI8kfG6/"],
    ["youtube", "https://www.youtube.com/shorts/BR5XC5Cm11M"],
    ["youtube", "https://youtu.be/BR5XC5Cm11M"],
    ["tiktok", "https://www.tiktok.com/@creator/photo/123456789"],
    ["tiktok", "https://vm.tiktok.com/ZMexample/"],
  ] as const) {
    assert.equal(getPublishedPostLink({ ...privateTikTok, platform, platformPostUrl })?.href, platformPostUrl);
  }
});
