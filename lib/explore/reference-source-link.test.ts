import assert from "node:assert/strict";
import test from "node:test";
import { canonicalSlideshowSource, getReferenceSource, referenceSourceLabel } from "./reference-source-link.ts";

test("slideshow post and creator URLs retain their distinct supplied destinations", () => {
  assert.deepEqual(canonicalSlideshowSource("https://www.tiktok.com/@strongermobile/photo/7499087255420636438?image_index=2"), { url: "https://www.tiktok.com/@strongermobile/photo/7499087255420636438", platform: "tiktok", kind: "post" });
  const profile = canonicalSlideshowSource("https://www.tiktok.com/@jessicas_tt?referer_video_id=7689565654764031245");
  assert.deepEqual(profile, { url: "https://www.tiktok.com/@jessicas_tt", platform: "tiktok", kind: "profile" });
  assert.equal(referenceSourceLabel(profile!), "View creator on TikTok");
  assert.equal(canonicalSlideshowSource("https://tiktok.com/@creator/video/123")?.kind, "post");
});

test("untrusted URLs never become source links and Hook/Wall policies stay distinct", () => {
  for (const url of ["javascript:alert(1)", "http://www.tiktok.com/@person", "https://www.tiktok.com.evil.test/@person", "https://evil.test/@person", "https://user:password@www.tiktok.com/@person", "https://www.tiktok.com:123/@person", "https://www.tiktok.com/@person/likes", "https://www.tiktok.com/@person/photo/not-an-id"]) assert.equal(canonicalSlideshowSource(url), null, url);
  assert.equal(getReferenceSource({ format: "hook", sourceUrl: "https://www.tiktok.com/@person" }), null);
  assert.equal(getReferenceSource({ format: "wall_text", sourceUrl: "https://www.tiktok.com/@person/photo/123" }), null);
  assert.equal(getReferenceSource({ format: "hook", sourceUrl: "https://www.tiktok.com/@person/video/123" })?.kind, "post");
});
