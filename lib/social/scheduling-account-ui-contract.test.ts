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

test("scheduling account rows render the returned profile picture with fallback", () => {
  assert.match(avatar, /connection\.profilePictureUrl/);
  assert.match(avatar, /<AvatarImage/);
  assert.match(avatar, /<AvatarFallback>/);
  assert.match(avatar, /<SocialPlatformIcon/);
  assert.match(carouselModal, /<SocialAccountAvatar connection=\{connection\}/);
  assert.match(reelDrawer, /<SocialAccountAvatar connection=\{connection\}/);
});

test("Carousel scheduling reserves a visible footer row at short heights", () => {
  assert.match(
    carouselModal,
    /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/,
  );
  assert.match(carouselModal, /overflow-y-auto overscroll-contain/);
  assert.doesNotMatch(carouselModal, /sm:min-h-\[360px\]/);
  assert.match(carouselModal, /<DialogFooter className="[^"]*shrink-0/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
