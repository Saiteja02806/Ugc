import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getMissingScheduleAccountPlatforms } from "./account-picker.ts";

test("TikTok remains discoverable when Instagram and YouTube are connected", () => {
  assert.deepEqual(getMissingScheduleAccountPlatforms(["instagram", "tiktok", "youtube"], [
    { platform: "instagram", status: "connected" },
    { platform: "youtube", status: "connected" },
  ]), ["tiktok"]);
});

test("disconnected TikTok requires connection instead of appearing publishable", () => {
  assert.deepEqual(getMissingScheduleAccountPlatforms(["tiktok"], [
    { platform: "tiktok", status: "revoked" },
  ]), ["tiktok"]);
});

test("a connected or reconnectable TikTok account uses the real account tile", () => {
  for (const status of ["connected", "expired", "permission_missing", "error"] as const) {
    assert.deepEqual(getMissingScheduleAccountPlatforms(["tiktok"], [{ platform: "tiktok", status }]), []);
  }
});

test("missing cards never expand the enabled platform list", () => {
  assert.deepEqual(getMissingScheduleAccountPlatforms(["instagram"], []), ["instagram"]);
  assert.deepEqual(getMissingScheduleAccountPlatforms(["instagram", "tiktok"], []), ["instagram", "tiktok"]);
});

test("Schedule post loads fresh connections and wires the refresh and connect controls", () => {
  const workspace = readFileSync(new URL("../../components/scheduling/scheduling-workspace.tsx", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../../components/scheduling/schedule-editor.tsx", import.meta.url), "utf8");
  const openHandler = workspace.slice(workspace.indexOf("const handleNewSchedulePost ="), workspace.indexOf("async function handleSaveScheduleDraft"));
  assert.match(openHandler, /const connections = await loadSocialConnections\(\{ force: true \}\)/);
  assert.match(workspace, /onRefreshConnections=\{async \(\) =>\s*\(await loadSocialConnections\(\{ force: true \}\)\) !== null/);
  assert.match(editor, /enabledPlatforms=\{selectablePlatforms\}/);
  assert.match(editor, /onRefresh=\{onRefreshConnections\}/);
  assert.match(editor, /missingPlatforms\.map\(platform/);
  assert.match(editor, /Connect \{platform === "tiktok" \? "TikTok"/);
  assert.match(editor, /href="\/settings#instagram-publishing"/);
});
