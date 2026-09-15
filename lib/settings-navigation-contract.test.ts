import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../components/settings/settings-workspace.tsx", import.meta.url),
  "utf8",
);

test("Settings exposes the approved customer sections in order", () => {
  const labels = Array.from(
    workspace.matchAll(/label: "([^"]+)"/g),
    (match) => match[1],
  );

  assert.deepEqual(labels, [
    "Account",
    "Business Context",
    "Plan & billing",
    "App screenshots",
    "Connected accounts",
    "Preferences",
    "Product updates",
    "Raise Ticket",
    "Request Feature",
    "Privacy & data",
  ]);
  assert.doesNotMatch(workspace, /CarouselAdminSettings/);
});

test("Settings keeps existing deep links while rendering one active panel", () => {
  for (const sectionId of [
    "account",
    "business-context",
    "subscription-billing",
    "app-screenshots",
    "instagram-publishing",
    "preferences",
    "product-updates",
    "raised-ticket",
    "request-feature",
    "privacy-data",
  ]) {
    assert.match(workspace, new RegExp(`activeSection === "${sectionId}"`));
  }

  assert.match(workspace, /window\.history\.pushState/);
  assert.match(workspace, /window\.addEventListener\("hashchange"/);
  assert.match(workspace, /window\.addEventListener\("popstate"/);
});

test("Business Context is a first-class Settings panel, not a detached workflow", () => {
  assert.match(
    workspace,
    /import \{ BusinessContextSettings \} from "@\/components\/settings\/business-context-settings"/,
  );
  assert.match(
    workspace,
    /activeSection === "business-context"[\s\S]*<BusinessContextSettings \/>/,
  );
});

test("Settings has an explicit close control that returns to the workspace", () => {
  assert.match(workspace, /function handleCloseSettings\(\)[\s\S]*router\.push\("\/dashboard"\)/);
  assert.match(workspace, /aria-label="Close settings"/);
  assert.match(workspace, /title="Close settings"/);
});
