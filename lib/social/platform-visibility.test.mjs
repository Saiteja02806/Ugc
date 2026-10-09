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
import * as publishingSettings from "../scheduling/platform-settings.ts";
import * as connectionPolicy from "../scheduling/social-connection-policy.ts";
import * as tiktokPublishing from "./tiktok-publishing.ts";
import * as youtubeAccess from "./youtube-beta-access.ts";
import * as workflowDraft from "../explore/workflow-scheduling-draft.ts";
import * as accountTimezone from "../scheduling/account-timezone.ts";

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
function uiLoader(policy = visibility, connectedAccounts, user = verifiedUser) {
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
      if (id === "@/contexts/auth-context") return { useAuth: () => ({ user }) };
      if (id === "@/components/providers/account-timezone-provider") return { useAccountTimeZone: () => "Asia/Kolkata" };
      if (id === "@/lib/scheduling/account-timezone") return accountTimezone;
      if (id === "@/lib/explore/workflow-scheduling-draft") return workflowDraft;
      if (id === "@/lib/social/youtube-beta-access") return youtubeAccess;
      if (id === "@/lib/social/tiktok-publishing") return tiktokPublishing;
      if (id === "@/lib/scheduling/schedule-time") return scheduleTime;
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

test("approved TikTok is visible with the existing verified-user access requirement", () => {
  assert.equal(visibility.hasTikTokUiAccess(verifiedUser), true);
  assert.equal(visibility.hasTikTokUiAccess({ ...verifiedUser, emailVerified: false }), false);
  assert.equal(visibility.hasTikTokUiAccess(null), false);
  assert.equal(access.hasTikTokBetaAccess(verifiedUser), true);
  assert.deepEqual(types.socialPlatforms, ["instagram", "tiktok", "youtube"]);
  assert.deepEqual(visibility.visibleSocialPlatforms, types.socialPlatforms);
  assert.equal(visibility.visibleSocialPlatformList, "Instagram, TikTok, and YouTube");
});

test("landing badge and publishing illustration show all three supported video destinations", () => {
  const load = uiLoader();
  const badge = render(load("components/marketing/landing-platforms").LandingPlatformBadge);
  const section = render(load("components/marketing/landing-multi-platform-section").LandingMultiPlatformSection);
  assert.match(badge, /Instagram/);
  assert.match(badge, /YouTube/);
  assert.match(badge, /TikTok/);
  assert.match(section, /TikTok account/);
  assert.match(section, /Three.*platforms/);
});

test("Explore displays TikTok and restores its saved draft in the post preview", () => {
  const load = uiLoader();
  const { WorkflowSchedulingPanel } = load("components/explore/workflow-scheduling-panel");
  const draft = { platform: "tiktok", caption: "Keep my caption", date: "2026-10-10", time: "12:00" };
  const html = render(WorkflowSchedulingPanel, { draft, onChange: () => assert.fail("Render must not rewrite a saved draft") });
  assert.match(html, /aria-label="Instagram"/);
  assert.match(html, /aria-label="YouTube"/);
  assert.match(html, /aria-label="TikTok" aria-pressed="true"/);
  assert.match(html, /Keep my caption/);
  const preview = render(load("components/explore/workflow-edit-workspace").WorkflowScheduleWorkspace, { draft });
  assert.match(preview, /TikTok/);
  assert.doesNotMatch(preview, /Choose a platform in Schedule/);
  assert.equal(draft.platform, "tiktok");
});

test("Explore offers TikTok for slideshows while keeping YouTube video-only", () => {
  const html = render(uiLoader()("components/explore/workflow-scheduling-panel").WorkflowSchedulingPanel, {
    draft: { platform: "", caption: "", date: "", time: "" }, imageOnly: true, onChange: () => {},
  });
  assert.match(html, /aria-label="Instagram"/);
  assert.match(html, /aria-label="TikTok"/);
  assert.doesNotMatch(html, /aria-label="YouTube"/);
});

test("analytics displays TikTok in the platform menu and its connected account", () => {
  const html = render(uiLoader()("components/analytics/social-analytics-beta-controls").SocialAnalyticsBetaControls, {
    platform: "instagram", selectedConnectionId: "all",
    connections: [{ id: "saved-tiktok", platform: "tiktok", platformAccountName: "TikTok creator", status: "connected" }],
    onConnectionChange: () => {}, onPlatformChange: () => {},
  });
  assert.match(html, /Instagram: choose analytics account/);
  assert.match(html, /YouTube: choose analytics account/);
  assert.match(html, /TikTok: choose analytics account/);
  assert.match(html, /TikTok creator/);
});

const connectedAccounts = types.socialPlatforms.map((platform) => ({
  id: `saved-${platform}`, platform, status: "connected",
  platformAccountId: platform, platformAccountName: `${platform}-creator`,
  platformAccountUsername: `${platform}-creator`, scopes: ["video.publish", "instagram_content_publish"],
}));

test("Trending's real video drawer displays connected TikTok, Instagram and YouTube accounts", () => {
  const html = render(uiLoader(visibility, connectedAccounts)("components/trending/hook-video-schedule-drawer").HookVideoScheduleDrawer, {
    summary: { hookText: "My content", demoTitle: "Demo" }, onClose: () => {}, onConfirm: () => {},
  });
  assert.match(html, /instagram-creator/);
  assert.match(html, /youtube-creator/);
  assert.match(html, /tiktok-creator/);
});

test("Trending's shared account modal offers TikTok for videos and carousels", () => {
  for (const contentType of ["wall_text", "reaction", "carousel"]) {
    const html = render(uiLoader(visibility, connectedAccounts)("components/social/platform-selection-modal").PlatformSelectionModal, {
      open: true, context: { contentType, title: "My content", returnTo: "trending" },
      onOpenChange: () => {}, onConfirmed: () => {},
    });
    assert.match(html, /instagram-creator/);
    assert.match(html, /tiktok-creator/);
    if (contentType !== "carousel") {
      assert.match(html, /youtube-creator/);
      assert.match(html, /Select publishing account/);
    } else {
      assert.doesNotMatch(html, /youtube-creator/);
    }
  }
});

test("Connected accounts displays the TikTok connection action and saved account", () => {
  const html = render(uiLoader(visibility, connectedAccounts)("components/social/connected-accounts-workspace").ConnectedAccountsWorkspace);
  assert.match(html, /Connect TikTok/);
  assert.match(html, /tiktok-creator/);
});

test("unverified users do not gain TikTok publishing controls from UI visibility", () => {
  for (const user of [null, { ...verifiedUser, emailVerified: false }]) {
    const html = render(uiLoader(visibility, connectedAccounts, user)("components/social/platform-selection-modal").PlatformSelectionModal, {
      open: true, context: { contentType: "reaction", title: "My content", returnTo: "trending" }, onOpenChange: () => {}, onConfirmed: () => {},
    });
    assert.doesNotMatch(html, /tiktok-creator/);
  }
});

test("a future visibility rollback preserves saved TikTok drafts and integration access", () => {
  const source = readFileSync(new URL("platform-visibility.ts", import.meta.url), "utf8");
  const exports = {};
  const compiled = ts.transpileModule(source.replace("tiktok: true", "tiktok: false"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", compiled)((id) => id === "./types" ? types : access, exports);
  assert.equal(exports.hasTikTokUiAccess(verifiedUser), false);
  assert.equal(access.hasTikTokBetaAccess(verifiedUser), true);
  assert.equal(exports.visibleSocialPlatformList, "Instagram and YouTube");
  const load = uiLoader(exports);
  assert.doesNotMatch(render(load("components/marketing/landing-platforms").LandingPlatformBadge), /TikTok/);
  assert.match(render(load("components/marketing/landing-multi-platform-section").LandingMultiPlatformSection), /Two.*platforms/);
  const draft = { platform: "tiktok", caption: "Keep my caption", date: "2026-10-10", time: "12:00" };
  const html = render(load("components/explore/workflow-scheduling-panel").WorkflowSchedulingPanel, {
    draft, onChange: () => assert.fail("Render must not rewrite a saved draft"),
  });
  assert.doesNotMatch(html, /tiktok/i);
  assert.match(html, /Keep my caption/);
  assert.match(render(load("components/explore/workflow-edit-workspace").WorkflowScheduleWorkspace, { draft }), /Choose a platform in Schedule/);
  assert.equal(draft.platform, "tiktok");
  assert.doesNotMatch(render(load("components/analytics/social-analytics-beta-controls").SocialAnalyticsBetaControls, {
    platform: "instagram", connections: [], selectedConnectionId: "all", onConnectionChange: () => {}, onPlatformChange: () => {},
  }), /TikTok: choose analytics account/);
  const hidden = uiLoader(exports, connectedAccounts);
  assert.doesNotMatch(render(hidden("components/trending/hook-video-schedule-drawer").HookVideoScheduleDrawer, {
    summary: { hookText: "My content", demoTitle: "Demo" }, onClose: () => {}, onConfirm: () => {},
  }), /tiktok-creator/);
  assert.doesNotMatch(render(hidden("components/social/platform-selection-modal").PlatformSelectionModal, {
    open: true, context: { contentType: "wall_text", title: "My content", returnTo: "trending" }, onOpenChange: () => {}, onConfirmed: () => {},
  }), /tiktok-creator/);
});
