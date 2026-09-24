import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { getMissingScheduleAccountPlatforms } from "./account-picker.ts";
import { getConnectionPublishingBlockMessage } from "./social-connection-policy.ts";
import { getSchedulePlatformLabel } from "./types.ts";

// Render the actual picker without importing the editor's unrelated media,
// Firebase and popover dependencies. Only decorative icons are substituted.
const source = readFileSync(new URL("../../components/scheduling/schedule-editor.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("schedule-editor.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const selector = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ConnectedAccountSelector");
assert.ok(selector);
const compiled = ts.transpileModule(selector.getText(ast), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const icon = () => React.createElement("span", { "aria-hidden": "true" });
const Picker = new Function("React", "useState", "getMissingScheduleAccountPlatforms", "getConnectionPublishingBlockMessage", "getSchedulePlatformLabel", "cn", "SocialPlatformIcon", "CheckCircle2", "RefreshCw", "X", "Plus", `${compiled}\nreturn ConnectedAccountSelector;`)(
  React, React.useState, getMissingScheduleAccountPlatforms, getConnectionPublishingBlockMessage,
  getSchedulePlatformLabel, (...values) => values.filter(Boolean).join(" "), icon, icon, icon, icon, icon,
);
const connection = (platform, name) => ({
  id: platform, platform, platformAccountUsername: name,
  status: "connected", scopes: ["video.publish", "instagram_content_publish"],
});
function render(connections, enabledPlatforms = ["instagram", "tiktok", "youtube"]) {
  return renderToStaticMarkup(React.createElement(Picker, {
    accountLabel: "Instagram, TikTok, or YouTube", connections, enabledPlatforms,
    onRefresh: async () => true, onToggle: () => {}, selectedConnectionIds: [],
  }));
}

test("the exact screenshot scenario renders Connect TikTok beside the real accounts", () => {
  const html = render([connection("instagram", "clara__talks"), connection("youtube", "teja.chundu")]);
  assert.match(html, /clara__talks/);
  assert.match(html, /teja.chundu/);
  assert.match(html, /Connect TikTok/);
  assert.match(html, /No connected account/);
  assert.match(html, /Refresh accounts/);
  assert.match(html, /href="\/settings#instagram-publishing"/);
});

test("a connected TikTok account renders a selectable account instead of the missing card", () => {
  const html = render([connection("tiktok", "clara_ugcpilot")], ["tiktok"]);
  assert.match(html, /<button[^>]*aria-pressed="false"[^>]*>[\s\S]*clara_ugcpilot/);
  assert.doesNotMatch(html, /Connect TikTok|No connected account/);
});

test("non-beta users never see a TikTok connection action", () => {
  const html = render([connection("instagram", "clara__talks")], ["instagram"]);
  assert.doesNotMatch(html, /Connect TikTok|Connect YouTube/);
});
