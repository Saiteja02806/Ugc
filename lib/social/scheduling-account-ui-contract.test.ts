import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const avatar = readProjectFile(
  "components/social/social-account-avatar.tsx",
);
const carouselModal = readProjectFile(
  "components/social/platform-selection-modal.tsx",
);
const reelDrawer = readProjectFile(
  "components/trending/hook-video-schedule-drawer.tsx",
);
const carouselHeader = carouselModal.slice(
  carouselModal.indexOf("<DialogHeader"),
  carouselModal.indexOf("</DialogHeader>") + "</DialogHeader>".length,
);

test("scheduling account rows render the returned profile picture with fallback", () => {
  assert.match(avatar, /connection\.profilePictureUrl/);
  assert.match(avatar, /<AvatarImage/);
  assert.match(avatar, /<AvatarFallback>/);
  assert.match(avatar, /<SocialPlatformIcon/);
  assert.match(carouselModal, /<SocialAccountAvatar connection=\{connection\}/);
  assert.match(reelDrawer, /<SocialAccountAvatar connection=\{connection\}/);
});

test("Post scheduling reserves a visible footer row at short heights", () => {
  assert.match(
    carouselModal,
    /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/,
  );
  assert.match(carouselModal, /overflow-y-auto overscroll-contain/);
  assert.doesNotMatch(carouselModal, /sm:min-h-\[360px\]/);
  assert.match(carouselModal, /<DialogFooter className="[^"]*shrink-0/);
});

test("Post scheduling keeps the header text-only without a redundant Instagram logo", () => {
  assert.match(carouselHeader, /Instagram post/);
  assert.match(carouselHeader, /\{currentStep\.title\}/);
  assert.doesNotMatch(carouselHeader, /<SocialPlatformIcon/);
  assert.match(carouselModal, /<SocialAccountAvatar connection=\{connection\}/);
});

test("Text Reels use the shared post scheduler without repeating their on-screen copy", () => {
  assert.match(carouselModal, /contentType: "wall_text"/);
  assert.match(carouselModal, /Text Reel is ready to prepare/);
  assert.match(carouselModal, /Its message already appears on screen/);
  assert.match(carouselModal, /Add context to accompany this Text Reel/);
  assert.doesNotMatch(carouselModal, /Overlay copy/);
});

test("the Instagram empty-state icon remains white over its gradient tile", () => {
  assert.match(
    carouselModal,
    /<SocialPlatformIcon\s+platform="instagram"\s+className="size-6 !text-white"/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
