import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL("../../components/trending/trending-workspace.tsx", import.meta.url),
  "utf8",
);
const automationUi = readFileSync(
  new URL(
    "../../components/trending/trending-slideshow-automation-workspace.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("places Automation pill beside Edit in Trending header while keeping Edit intact", () => {
  assert.match(workspace, /data-trending-automation-control/);
  assert.match(workspace, /Configure daily slideshow automation, active/);
  assert.match(workspace, />\s*Automation\s*</);
  assert.match(
    workspace,
    /<div ref=\{setHeaderActionsRoot\} className="flex items-center" \/>[\s\S]*data-trending-automation-control/,
  );
  assert.match(workspace, /<TrendingSlideshowAutomationWorkspace/);
  assert.match(workspace, /<CreativeEditAction/);
});

test("implements 4-step guided setup, Option A naming, exact daily counts, collection-only backgrounds, saved visual styles, and WorkflowTimePicker", () => {
  // 4-step navigation
  assert.match(automationUi, /Step 1 of 4 · Content & Daily Count/);
  assert.match(automationUi, /Step 2 of 4 · Appearance/);
  assert.match(automationUi, /Step 3 of 4 · Posting Rules/);
  assert.match(automationUi, /Step 4 of 4 · Review & Activate/);

  // Option A approved labels & exact count steppers
  assert.match(automationUi, /All Product Stories/);
  assert.match(automationUi, /All Educational Tips/);
  assert.match(automationUi, /Custom Mix/);
  assert.match(automationUi, /Decrease \$\{meta\.title\} daily count/);
  assert.match(automationUi, /Increase \$\{meta\.title\} daily count/);

  // Strict collection-only backgrounds (optional) & default as-is backgrounds
  assert.match(
    automationUi,
    /Default backgrounds \(Use generated slideshow as-is\)/,
  );
  assert.match(
    automationUi,
    /No library upload or\s+collection needed/,
  );
  assert.match(automationUi, /Use my collection only \(Optional\)/);
  assert.match(automationUi, /Never substitutes\s+stock or AI images/);
  assert.match(automationUi, /data-empty-collections-state/);
  assert.match(
    automationUi,
    /You don&apos;t have any image collections in\s+your Media library yet/,
  );
  assert.match(automationUi, /Create collection & upload images/);
  assert.match(automationUi, /Change collection/);
  assert.match(automationUi, /Default style/);
  assert.match(automationUi, /Save as new style/);
  assert.match(automationUi, /<CarouselTextControls/);
  assert.match(automationUi, /<CarouselManualText/);

  // Live Example preview with Cover and Body slides
  assert.match(automationUi, /Example preview/);
  assert.match(automationUi, /Cover slide \(1\)/);
  assert.match(automationUi, /Body slide/);

  // Step 3 uses WorkflowTimePicker; TikTok/YouTube settings are not duplicated
  assert.match(automationUi, /<WorkflowTimePicker/);
  assert.doesNotMatch(automationUi, /TikTok visibility for/);
  assert.doesNotMatch(automationUi, /YouTube Shorts only supports/);
  assert.match(
    automationUi,
    /follow your\s+publishing settings in Settings/,
  );
  assert.match(automationUi, /data-automation-preparing-reason/);
  assert.match(automationUi, /Music Usage\s+Confirmation/);

  // Explicit activation & Active/Needs attention management
  assert.match(automationUi, /Activate automation/);
  assert.match(automationUi, /Needs attention — action required/);
  assert.match(automationUi, /Upload images to collection/);
  assert.match(automationUi, /Pause slideshow automation\?/);
});
