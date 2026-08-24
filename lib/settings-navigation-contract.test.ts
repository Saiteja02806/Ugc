import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../components/settings/settings-workspace.tsx", import.meta.url),
  "utf8",
);

test("Settings exposes only the six approved customer sections in order", () => {
  const labels = Array.from(
    workspace.matchAll(/label: "([^"]+)"/g),
    (match) => match[1],
  );

  assert.deepEqual(labels, [
    "Account",
    "Plan & billing",
    "App screenshots",
    "Connected accounts",
    "Preferences",
    "Privacy & data",
  ]);
  assert.doesNotMatch(workspace, /CarouselAdminSettings/);
});

test("Settings keeps existing deep links while rendering one active panel", () => {
  for (const sectionId of [
    "account",
    "subscription-billing",
    "app-screenshots",
    "instagram-publishing",
    "preferences",
    "privacy-data",
  ]) {
    assert.match(workspace, new RegExp(`activeSection === "${sectionId}"`));
  }

  assert.match(workspace, /window\.history\.pushState/);
  assert.match(workspace, /window\.addEventListener\("hashchange"/);
  assert.match(workspace, /window\.addEventListener\("popstate"/);
});
