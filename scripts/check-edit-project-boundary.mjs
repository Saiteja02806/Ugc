import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = {
  appLayout: read("app/layout.tsx"),
  appSidebar: read("components/layout/app-sidebar.tsx"),
  creativeAssets: read("components/avatars/avatars-workspace.tsx"),
  demoEditor: read("components/demos/demo-editor-shell.tsx"),
  demoLegacyPage: read("app/demos/[demoId]/page.tsx"),
  demosWorkspace: read("components/demos/demos-workspace.tsx"),
  editDetailPage: read("app/edit/[videoId]/page.tsx"),
  editIndexPage: read("app/edit/page.tsx"),
  editLibrary: read("components/edit/edit-library-workspace.tsx"),
  editorRoutes: read("lib/edit/routes.ts"),
  editor: read("components/edit/focused-video-editor-shell.tsx"),
  editorPreview: read("components/edit/focused-video-editor.tsx"),
  mediaRoute: read("app/api/media/[assetId]/route.ts"),
  renderRoute: read("app/api/edit/render/route.ts"),
  renderWorker: read("worker/src/jobs/render-edit-video.ts"),
  renderEngine: read("worker/src/lib/render-engine.ts"),
  overlaySpec: read("worker/src/lib/edit-overlay-render-spec.ts"),
  overlaySpecReexport: read("lib/edit/overlay-render-spec.ts"),
  scheduleRenderRoute: read("app/api/schedules/[scheduleId]/render/route.ts"),
  schedulingResolution: read("lib/scheduling/render-asset-resolution.ts"),
  schedulingService: read("lib/scheduling/service.ts"),
  workerStore: read("worker/src/lib/supabase.ts"),
  workerDockerfile: read("worker/Dockerfile"),
};

assert(
  !getConstBody(files.creativeAssets, "hookVideoSourceTypes").includes(
    '"edit_export"',
  ),
  "Creative Assets videos must exclude Edit exports.",
);
assert(
  !getConstBody(files.creativeAssets, "hookVideoSourceTypes").includes(
    '"demo_upload"',
  ) &&
    getConstBody(files.creativeAssets, "hookVideoSourceTypes").includes(
      '"influencer_upload"',
    ) &&
    getConstBody(files.creativeAssets, "hookVideoSourceTypes").includes(
      '"catalog_influencer"',
    ) &&
    files.creativeAssets.includes(
      "displayCollections={creativeAssetVideoCollections}",
    ),
  "Creative Assets must combine uploaded, generated, and influencer videos without absorbing Content demos.",
);
assert(
  !files.appSidebar.includes('label: "Edit"') &&
    !files.appSidebar.includes('href: "/edit"'),
  "Edit must remain a contextual capability, not primary navigation.",
);
assert(
  files.editor.includes("returnHref") &&
    files.editor.includes("returnLabel") &&
    files.demoEditor.includes("returnHref") &&
    files.demoEditor.includes("returnLabel"),
  "Video and demo editors must support contextual return navigation.",
);
assert(
  files.editorRoutes.includes("/avatars/media/") &&
    files.editorRoutes.includes("/library/demos/") &&
    files.demosWorkspace.includes("getContentDemoEditorHref") &&
    files.demoLegacyPage.includes("redirect(getContentDemoEditorHref(demoId))"),
  "Creative Assets and Content must own their editor entry points.",
);
assert(
  files.editIndexPage.includes("redirect(CREATIVE_ASSETS_VIDEOS_HREF)") &&
    files.editDetailPage.includes("redirect(getCreativeAssetEditorHref(videoId))"),
  "Legacy Edit URLs must redirect to Creative Assets.",
);
assert(
  files.editLibrary.includes('fetch("/api/edit/videos"'),
  "The Edit library must load Edit projects.",
);
assert(
  !files.editLibrary.includes('fetch(`/api/media?'),
  "The Edit library must not load raw media as project cards.",
);
assert(
  files.editor.includes("/api/edit/videos/${encodeURIComponent(currentVideo.id)}"),
  "Editor drafts must save through the Edit project API.",
);
assert(
  files.mediaRoute.includes(
    "Editing changes must be saved to an Edit project, not a Creative Asset.",
  ),
  "The raw Creative Asset API must reject editor draft writes.",
);
assert(
  !files.workerStore.includes('source_type: "edit_export"'),
  "Edit saves must not create Creative Asset export rows.",
);
assert(
  files.workerStore.includes("areJsonValuesEqual") &&
    files.workerStore.includes('status: draftIsCurrent ? "rendered" : "draft"') &&
    files.workerStore.includes('status: draftIsCurrent ? "failed" : "draft"'),
  "Background Save completion must not mark newer Edit changes as Saved.",
);
assert(
  files.schedulingResolution.includes("getEditableVideoForOwner") &&
    files.schedulingResolution.includes("getLatestEditableVideoRenderForOwner") &&
    files.schedulingResolution.includes("rendered_video_url") &&
    files.schedulingResolution.includes("getSavedEditRenderAsset"),
  "Scheduling must resolve saved Edit outputs from Edit project records.",
);
assert(
  (files.schedulingResolution.includes("getDemoVideo") ||
    files.schedulingResolution.includes("findDemoVideo")) &&
    files.schedulingResolution.includes("rendered_video_url") &&
    files.schedulingResolution.includes("getSavedDemoRenderAsset"),
  "Scheduling must resolve saved Demo outputs from demo records.",
);
assert(
  files.schedulingService.includes("@/lib/scheduling/render-asset-resolution") &&
    files.scheduleRenderRoute.includes("@/lib/scheduling/render-asset-resolution"),
  "Scheduling service and render route must share the same saved-output resolver.",
);
assert(
  files.renderRoute.includes('["clean", "minimal", "bubble"]') &&
    files.renderWorker.includes('["clean", "minimal", "bubble"]'),
  "The API and worker must support every editor text style.",
);
assert(
  files.editorPreview.includes("EDIT_OVERLAY_VERTICAL_INSET_PERCENT") &&
    files.editorPreview.includes("buildEditOverlayTextLayout") &&
    files.editorPreview.includes("getOverlayPreviewGraphic") &&
    files.editorPreview.includes("layout.lines.map") &&
    files.renderEngine.includes("./edit-overlay-render-spec.js") &&
    files.renderEngine.includes("buildEditOverlayTextLayout") &&
    files.renderEngine.includes("layout.lines.flatMap") &&
    files.renderEngine.includes("EDIT_OVERLAY_VERTICAL_INSET_PERCENT") &&
    files.overlaySpecReexport.includes("@/worker/src/lib/edit-overlay-render-spec"),
  "Preview and saved MP4 overlays must use the shared overlay render spec.",
);
assert(
  files.overlaySpec.includes('EDIT_OVERLAY_FONT_FAMILY = "Geist"') &&
    files.overlaySpec.includes("EDIT_OVERLAY_FONT_WEIGHT = 600") &&
    files.appLayout.includes("Geist-SemiBold.woff2") &&
    files.appLayout.includes('variable: "--font-edit-overlay"') &&
    files.workerDockerfile.includes("Geist-SemiBold.ttf") &&
    files.workerDockerfile.includes("fonts-noto-cjk") &&
    files.renderEngine.includes("ensureEditOverlayFontRegistered") &&
    files.renderEngine.includes("fontfile: fontPath") &&
    files.renderEngine.includes("registration verification failed") &&
    !files.renderEngine.includes("@font-face"),
  "Preview and export must use the same font family and weight.",
);
assert(
  !files.renderEngine.includes('"h*0.12"') &&
    !files.renderEngine.includes('"h-text_h-h*0.12"') &&
    !files.renderEngine.includes("? 62") &&
    !files.renderEngine.includes("? 10 : 8") &&
    !files.renderEngine.includes("* 0.84") &&
    !files.renderEngine.includes("* 0.34") &&
    !files.renderEngine.includes("* 0.42"),
  "Saved MP4 overlays must not duplicate preview layout constants.",
);
assert(
  files.editor.includes("jobId=${encodeURIComponent(jobId)}") &&
    files.editor.includes("sourceVideoId=${encodeURIComponent(sourceVideoId)}") &&
    files.editor.includes("RenderPollTransientError") &&
    files.editor.includes("resumePollGeneration") &&
    files.editor.includes("isTransientHttpStatus"),
  "New renders must poll the exact job while resumed renders use the persistent Edit project identity.",
);
assert(
  files.editLibrary.includes('video.status === "rendering"') &&
    files.editLibrary.includes("window.setInterval") &&
    files.editLibrary.includes("visibilitychange"),
  "The Edit library must refresh background Save status after navigation.",
);
assert(
  files.renderEngine.includes('"veryfast"') &&
    files.renderEngine.indexOf('args.push("-ss"') <
      files.renderEngine.indexOf('args.push("-i", inputPath)'),
  "Edit saves must use fast input seeking and the optimized encode preset.",
);

console.log("Edit project boundary checks passed.");

function read(path) {
  return readFileSync(resolve(path), "utf8");
}

function getConstBody(source, name) {
  const match = source.match(
    new RegExp(`const\\s+${name}[^=]*=\\s*\\[([\\s\\S]*?)\\];`),
  );

  if (!match) {
    throw new Error(`Could not find ${name}.`);
  }

  return match[1];
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
