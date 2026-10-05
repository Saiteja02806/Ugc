import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import * as visibility from "./platform-visibility.ts";
import * as access from "./tiktok-beta-access.ts";
import * as types from "./types.ts";
import * as analyticsSelection from "../analytics/social-account-selection.ts";
import * as scheduleTime from "../scheduling/schedule-time.ts";
import * as accountTimezone from "../scheduling/account-timezone.ts";
import * as publishingSettings from "../scheduling/platform-settings.ts";
import * as connectionPolicy from "../scheduling/social-connection-policy.ts";
import * as tiktokPublishing from "./tiktok-publishing.ts";
import * as youtubeAccess from "./youtube-beta-access.ts";

const root = new URL("../../", import.meta.url);
const verifiedUser = { email: "verified@example.com", emailVerified: true, uid: "user" };
const cn = (...values) => values.filter(Boolean).join(" ");
const icon = ({ platform }) => React.createElement("span", { "data-icon-platform": platform });
const element = (tag) => function TestElement({ children, ...props }) {
  return React.createElement(tag, Object.fromEntries(
    Object.entries(props).filter(([key]) => key === "className" || key === "title" || key === "type" || key === "id" || key.startsWith("aria-") || key.startsWith("data-")),
  ), children);
};
const chrome = new Proxy({}, { get: (_, name) => name === "Dialog"
  ? ({ open, children }) => open === false ? null : React.createElement("div", {}, children)
  : name === "Button" || name === "PopoverTrigger" ? element("button") : element("div") });

// Render real component source. Substitute only framework chrome, decorative
// media/icons and hosted dependencies; all platform definitions and filters run.
function uiLoader(policy = visibility, connectedAccounts) {
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const exports = {};
    let seededConnections = false;
    // Model the completed connection load without network or effect execution.
    // Both scheduling surfaces initialize connections as their first empty array.
    const fixtureReact = connectedAccounts ? { ...React, useState(initial) {
      let initialState = initial;
      if (Array.isArray(initial) && initial.length === 0 && !seededConnections) {
        seededConnections = true;
        initialState = connectedAccounts;
      } else if (initial === true) {
        initialState = false;
      }
      return React.useState(initialState);
    } } : React;
    const source = readFileSync(new URL(`${path}.tsx`, root), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const require = (id) => {
      if (id === "react") return fixtureReact;
      if (id === "react/jsx-runtime") return ReactJsx;
      if (id === "lucide-react") return new Proxy({}, { get: () => icon });
      if (id === "next/image") return { default: () => React.createElement("img", { alt: "" }) };
      if (id === "next/link") return { default: element("a") };
      if (id === "@tanstack/react-query") return { useQueryClient: () => ({}) };
      if (id === "@/contexts/auth-context") return { useAuth: () => ({ user: verifiedUser }) };
      if (id === "@/lib/social/youtube-beta-access") return youtubeAccess;
      if (id === "@/lib/social/tiktok-publishing") return tiktokPublishing;
      if (id === "@/lib/scheduling/schedule-time") return scheduleTime;
      if (id === "@/lib/scheduling/account-timezone") return accountTimezone;
      // Seed the owner preference; no hosted query runs in this render fixture.
      if (id === "@/components/providers/account-timezone-provider") return { useAccountTimeZone: () => "UTC" };
      if (id === "@/lib/scheduling/platform-settings") return publishingSettings;
      if (id === "@/lib/scheduling/social-connection-policy") return connectionPolicy;
      if (id === "@/lib/firebase/auth" || id === "@/lib/scheduling/account-data-query") return new Proxy({}, { get: () => () => assert.fail("Rendering must not perform hosted requests") });
      if (id === "@/components/social/use-social-oauth-popup") return { useSocialOAuthPopup: () => ({ connectingPlatform: null }) };
      if (id === "@/lib/social/instagram-professional-account") return { INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED_ERROR: "instagram_professional_account_required" };
      if (id === "@/lib/scheduling/carousel-scheduling-client") return { CarouselScheduleRecoveryError: class extends Error {} };
      if (id === "@/components/social/instagram-caption-preview") return { InstagramCaptionPreview: icon };
      if (id === "@/components/social/instagram-professional-account-guide") return { InstagramProfessionalAccountGuide: icon };
      if (id === "@/components/trending/hook-inline-symbols") return { HookInlineSymbols: element("span") };
      if (id === "@/lib/social/platform-visibility") return policy;
      if (id === "@/lib/analytics/social-account-selection") return analyticsSelection;
      if (id === "@/lib/utils") return { cn };
      if (id === "@/components/social/platform-icon") return { SocialPlatformIcon: icon };
      if (id === "@/components/social/social-account-avatar") return { SocialAccountAvatar: icon };
      if (id.startsWith("@/components/ui/")) return chrome;
      if (id.endsWith(".module.css")) return new Proxy({}, { get: (_, key) => key });
      if (id === "@/components/explore/hook-workflow-media-controls") return { WorkflowMediaPlayer: icon };
      throw new Error(`Add an explicit fixture for ${id}`);
    };
    const localRequire = (id) => id === "@/components/marketing/landing-platforms" || id === "@/components/explore/workflow-scheduling-panel"
      ? load(id.slice(2)) : require(id);
    new Function("require", "exports", compiled)(localRequire, exports);
    cache.set(path, exports);
    return exports;
  }
  return load;
}

const ReactJsx = await import("react/jsx-runtime");
const render = (component, props = {}) => renderToStaticMarkup(React.createElement(component, props));

test("TikTok visibility is independent of integration access and provider types", () => {
  assert.equal(visibility.hasTikTokUiAccess(verifiedUser), false);
  assert.equal(access.hasTikTokBetaAccess(verifiedUser), true);
  assert.deepEqual(types.socialPlatforms, ["instagram", "tiktok", "youtube"]);
  assert.deepEqual(visibility.visibleSocialPlatforms, ["instagram", "youtube"]);
  assert.equal(visibility.visibleSocialPlatformList, "Instagram and YouTube");
});

test("landing badge and publishing illustration show only the two visible platforms", () => {
  const load = uiLoader();
  const badge = render(load("components/marketing/landing-platforms").LandingPlatformBadge);
  const section = render(load("components/marketing/landing-multi-platform-section").LandingMultiPlatformSection);
  assert.match(badge, /Instagram/);
  assert.match(badge, /YouTube/);
  assert.doesNotMatch(`${badge}${section}`, /tiktok/i);
  assert.match(section, /Two.*platforms/);
});

test("Explore hides the option and gives a safe prompt for an existing TikTok draft", () => {
  const load = uiLoader();
  const { WorkflowSchedulingPanel } = load("components/explore/workflow-scheduling-panel");
  const draft = { platform: "tiktok", caption: "Keep my caption", date: "2026-10-10", time: "12:00" };
  const html = render(WorkflowSchedulingPanel, { draft, onChange: () => assert.fail("Render must not rewrite a saved draft") });
  assert.match(html, /aria-label="Instagram"/);
  assert.match(html, /aria-label="YouTube"/);
  assert.doesNotMatch(html, /tiktok/i);
  assert.match(html, /Keep my caption/);
  const preview = render(load("components/explore/workflow-edit-workspace").WorkflowScheduleWorkspace, { draft });
  assert.match(preview, /Choose a platform in Schedule/);
  assert.equal(draft.platform, "tiktok");
});

test("analytics cannot expose a connected TikTok account through the platform menu", () => {
  const html = render(uiLoader()("components/analytics/social-analytics-beta-controls").SocialAnalyticsBetaControls, {
    platform: "instagram", selectedConnectionId: "all",
    connections: [{ id: "saved-tiktok", platform: "tiktok", platformAccountName: "Hidden creator", status: "connected" }],
    onConnectionChange: () => {}, onPlatformChange: () => {},
  });
  assert.match(html, /Instagram: choose analytics account/);
  assert.match(html, /YouTube: choose analytics account/);
  assert.doesNotMatch(html, /tiktok|Hidden creator/i);
});

const connectedAccounts = types.socialPlatforms.map((platform) => ({
  id: `saved-${platform}`, platform, status: "connected",
  platformAccountId: platform, platformAccountName: `${platform}-creator`,
  platformAccountUsername: `${platform}-creator`, scopes: ["video.publish", "instagram_content_publish"],
}));

test("Trending's real video drawer hides stored TikTok accounts and retains Instagram and YouTube", () => {
  const html = render(uiLoader(visibility, connectedAccounts)("components/trending/hook-video-schedule-drawer").HookVideoScheduleDrawer, {
    summary: { hookText: "My content", demoTitle: "Demo" }, onClose: () => {}, onConfirm: () => {},
  });
  assert.match(html, /instagram-creator/);
  assert.match(html, /youtube-creator/);
  assert.doesNotMatch(html, /tiktok/i);
});

test("Trending's shared account modal hides TikTok for video and carousel formats", () => {
  for (const contentType of ["wall_text", "reaction", "carousel"]) {
    const html = render(uiLoader(visibility, connectedAccounts)("components/social/platform-selection-modal").PlatformSelectionModal, {
      open: true, context: { contentType, title: "My content", returnTo: "trending" },
      onOpenChange: () => {}, onConfirmed: () => {},
    });
    assert.match(html, /instagram-creator/);
    assert.doesNotMatch(html, /tiktok/i);
    if (contentType !== "carousel") {
      assert.match(html, /youtube-creator/);
      assert.match(html, /Select publishing account/);
    } else {
      assert.doesNotMatch(html, /youtube-creator/);
    }
  }
});

test("one switch restores marketing, Explore and analytics while verification remains required", () => {
  const source = readFileSync(new URL("platform-visibility.ts", import.meta.url), "utf8");
  const exports = {};
  const compiled = ts.transpileModule(source.replace("tiktok: false", "tiktok: true"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", compiled)((id) => id === "./types" ? types : access, exports);
  assert.equal(exports.hasTikTokUiAccess(verifiedUser), true);
  assert.equal(exports.hasTikTokUiAccess({ ...verifiedUser, emailVerified: false }), false);
  assert.equal(exports.hasTikTokUiAccess(null), false);
  assert.equal(exports.visibleSocialPlatformList, "Instagram, TikTok, and YouTube");
  const load = uiLoader(exports);
  assert.match(render(load("components/marketing/landing-platforms").LandingPlatformBadge), /TikTok/);
  assert.match(render(load("components/marketing/landing-multi-platform-section").LandingMultiPlatformSection), /Three.*platforms/);
  assert.deepEqual(load("components/explore/workflow-scheduling-panel").SCHEDULE_PLATFORMS.map(({ value }) => value), types.socialPlatforms);
  assert.match(render(load("components/analytics/social-analytics-beta-controls").SocialAnalyticsBetaControls, {
    platform: "instagram", connections: [], selectedConnectionId: "all", onConnectionChange: () => {}, onPlatformChange: () => {},
  }), /TikTok: choose analytics account/);
  const restored = uiLoader(exports, connectedAccounts);
  assert.match(render(restored("components/trending/hook-video-schedule-drawer").HookVideoScheduleDrawer, {
    summary: { hookText: "My content", demoTitle: "Demo" }, onClose: () => {}, onConfirm: () => {},
  }), /tiktok-creator/);
  assert.match(render(restored("components/social/platform-selection-modal").PlatformSelectionModal, {
    open: true, context: { contentType: "wall_text", title: "My content", returnTo: "trending" }, onOpenChange: () => {}, onConfirmed: () => {},
  }), /tiktok-creator/);
});
