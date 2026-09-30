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

test("Hook scheduling uses the wide, compact platform-details layout", () => {
  const detailsStart = reelDrawer.indexOf('{stage === "details" ?');
  const detailsEnd = reelDrawer.indexOf(") : (\n            <ScheduleReview", detailsStart);
  const detailsStep = reelDrawer.slice(detailsStart, detailsEnd);

  assert.match(reelDrawer, /sm:max-w-\[960px\]/);
  assert.match(reelDrawer, /xl:grid-cols-\[minmax\(0,1\.1fr\)_minmax\(20rem,0\.9fr\)\]/);
  assert.match(detailsStep, /Publishing details/);
  assert.match(reelDrawer, /Content disclosure/);
  assert.doesNotMatch(detailsStep, /Music Usage Confirmation/);
  assert.doesNotMatch(detailsStep, /Contains AI-generated content/);
  assert.match(reelDrawer, /Confirm TikTok publishing/);
  assert.match(reelDrawer, /requireTikTokMusicConfirmation: false/);
});

test("Post scheduling keeps the header text-only without a redundant Instagram logo", () => {
  assert.match(carouselHeader, /Instagram post/);
  assert.match(carouselHeader, /\{currentStep\.title\}/);
  assert.doesNotMatch(carouselHeader, /<SocialPlatformIcon/);
  assert.match(carouselModal, /<SocialAccountAvatar connection=\{connection\}/);
});

test("Text Reels use the shared post scheduler without a redundant preparation card", () => {
  assert.match(carouselModal, /contentType: "wall_text"/);
  assert.match(carouselModal, /Review the destination and optionally add a caption for this Text Reel\./);
  assert.match(carouselModal, /Add context to accompany this Text Reel/);
  assert.doesNotMatch(carouselModal, /Text Reel is ready to prepare/);
  assert.doesNotMatch(carouselModal, /Its message already appears on screen/);
  assert.doesNotMatch(carouselModal, /Overlay copy/);
});

test("the Instagram empty-state icon remains white over its gradient tile", () => {
  assert.match(
    carouselModal,
    /<SocialPlatformIcon\s+platform="instagram"\s+className="size-6 !text-white"/,
  );
});

test("Carousel scheduling preserves a rendered slide's complete composition", () => {
  const detailsStep = carouselModal.slice(
    carouselModal.indexOf("function DetailsStep"),
    carouselModal.indexOf("function PublishingStep"),
  );

  assert.match(
    detailsStep,
    /isReel \? "aspect-\[9\/16\] object-cover" : "aspect-\[4\/5\] object-contain"/,
  );
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
