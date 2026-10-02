import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { upsertAIStudioResult } from "./media-results.ts";

const source = readFileSync(new URL("../../components/video/video-generation-workspace.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set([
  "OptimisticVideoCard", "VideoResultCard", "VideoResultMetadata", "VideoPromptBubble",
  "VideoHistoryDrawer", "getVideoHistoryTitle", "getVideoResultWidthClassName",
  "formatVideoDuration", "formatGeneratedAt",
]);
const declarations = ast.statements.filter((node) =>
  ts.isFunctionDeclaration(node) && names.has(node.name?.text) ||
  ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => declaration.name.getText(ast) === "VIDEO_RESULT_WIDTH_CLASS_NAMES"),
).map((node) => node.getText(ast)).join("\n");
const compiled = ts.transpileModule(declarations, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const icon = () => React.createElement("span", { "aria-hidden": "true" });
const Button = ({ children, ...props }) => {
  delete props.variant;
  delete props.size;
  return React.createElement("button", props, children);
};
const Input = (props) => React.createElement("input", props);
const Link = ({ children, ...props }) => React.createElement("a", props, children);
const ResultActions = ({ title, url }) => React.createElement("a", { href: url, "aria-label": `Download ${title}` }, "Download");
const dependencies = {
  React, useState: React.useState, useRef: React.useRef, useEffect: React.useEffect,
  Button, Input, Link, AiStudioResultActions: ResultActions,
  cn: (...values) => values.filter(Boolean).join(" "),
  ChevronDown: icon, ChevronUp: icon, Clock3: icon, History: icon, Loader2: icon,
  Monitor: icon, Pause: icon, Play: icon, Search: icon, Sparkles: icon,
  Volume2: icon, VolumeX: icon, X: icon,
};
const components = new Function(...Object.keys(dependencies), `${compiled}\nreturn { OptimisticVideoCard, VideoResultCard, VideoPromptBubble, VideoHistoryDrawer };`)(...Object.values(dependencies));
const render = (name, props) => renderToStaticMarkup(React.createElement(components[name], props));
const video = {
  id: "video-1", url: "https://example.com/video.mp4", thumbnailUrl: "https://example.com/poster.jpg",
  title: "Presenter video", prompt: "A presenter introduces a product.", ratio: "9:16",
  modelLabel: "Kling 3.0", resolution: "720p", durationSeconds: 15,
  createdAt: "2026-10-01T15:30:00Z", status: "Ready",
};

test("pending video puts one live status inside its preview and keeps prompt details nearby", () => {
  const html = render("OptimisticVideoCard", {
    aspectRatio: video.ratio, avatarThumbnail: video.thumbnailUrl, prompt: video.prompt,
    modelLabel: video.modelLabel, durationSeconds: video.durationSeconds, resolution: video.resolution,
  });
  assert.equal((html.match(/role="status"/g) ?? []).length, 1);
  assert.match(html, /aspect-ratio:9 \/ 16[\s\S]*role="status" aria-live="polite"[\s\S]*Creating your video/);
  assert.match(html, /Video reference/);
  assert.match(html, /Kling 3\.0[\s\S]*0:15[\s\S]*720p/);
  assert.doesNotMatch(html, /Rendering video|Your generation will appear here when it is ready/);
  assert.match(source, /statusPlacement="inline"/);
});

test("pending and completed previews have the same compact responsive portrait footprint", () => {
  const completed = render("VideoResultCard", { video });
  const pending = render("OptimisticVideoCard", {
    aspectRatio: video.ratio, prompt: video.prompt,
    modelLabel: video.modelLabel, durationSeconds: video.durationSeconds, resolution: video.resolution,
  });
  const width = "w-[min(100%,calc(34dvh*9/16),11.25rem)]";
  assert.ok(completed.includes(width));
  assert.ok(pending.includes(width));
  assert.match(completed, /max-w-\[54rem\]/);
  assert.match(completed, /sm:flex-row sm:justify-between sm:gap-6/);
  assert.doesNotMatch(completed, /sm:max-w-\[min\(520px,62%\)\]|lg:gap-8/);
});

test("preview rows use a plain canvas with prompt at the right and metadata below the left preview", () => {
  for (const html of [
    render("VideoResultCard", { video, isNew: true }),
    render("OptimisticVideoCard", {
      aspectRatio: video.ratio, prompt: video.prompt,
      modelLabel: video.modelLabel, durationSeconds: video.durationSeconds, resolution: video.resolution,
    }),
  ]) {
    const articleClass = html.match(/<article[^>]*class="([^"]*)"/)?.[1];
    assert.ok(articleClass);
    assert.doesNotMatch(articleClass, /\bborder\b|\bbg-|\bring-|\brounded-|\bp-3\b|sm:p-4/);
    assert.match(html, /sm:max-w-\[26rem\] sm:flex-1/);
    assert.ok(html.indexOf("Kling 3.0") < html.indexOf('aria-label="Show full video prompt"'), "metadata belongs to the media column before the prompt column");
  }
});

test("ready previews preserve playback, audio and download with a seek control and uncropped video", () => {
  const html = render("VideoResultCard", { video });
  assert.match(html, /<video[^>]*object-contain[^>]*muted=""[^>]*playsInline=""[^>]*preload="metadata"/);
  assert.doesNotMatch(html, /autoPlay|autoplay/);
  assert.match(html, /type="range" aria-label="Seek video"/);
  assert.match(html, /aria-label="Play video"/);
  assert.match(html, /aria-label="Unmute video"/);
  assert.match(html, /aria-label="Download Presenter video"/);
  assert.match(html, /aria-label="Show full video prompt"/);
});

test("opening History loads lazy posters and leaves fallback videos unloaded", () => {
  const props = {
    groups: [{ label: "Today", videos: [video, { ...video, id: "no-poster", thumbnailUrl: null }] }],
    onClose() {}, onQueryChange() {}, onSelectVideo() {}, open: true, query: "", selectedVideoId: null,
  };
  const html = render("VideoHistoryDrawer", props);
  assert.match(html, /<img[^>]*src="https:\/\/example.com\/poster.jpg"[^>]*loading="lazy"[^>]*decoding="async"/);
  assert.equal((html.match(/<video\b/g) ?? []).length, 1);
  assert.match(html, /<video[^>]*preload="none"/);
  assert.doesNotMatch(html, /preload="metadata"/);
  assert.equal(render("VideoHistoryDrawer", { ...props, open: false }), "");
});

test("completing a video preserves the full loaded history and updates existing entries without duplicates", () => {
  let updaterSource;
  function findUpdater(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "setGeneratedVideos") {
      const updater = node.arguments[0];
      if (ts.isArrowFunction(updater) && updater.body.getText(ast).includes("upsertAIStudioResult")) {
        updaterSource = updater.getText(ast);
      }
    }
    ts.forEachChild(node, findUpdater);
  }
  findUpdater(ast);
  assert.ok(updaterSource, "exercise the workspace's actual completion state updater");
  const updaterJs = ts.transpileModule(`const applyCompletion = ${updaterSource};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const completedVideo = { ...video, id: "new-completion" };
  const applyCompletion = new Function("upsertAIStudioResult", "nextVideo", `${updaterJs}\nreturn applyCompletion;`)(upsertAIStudioResult, completedVideo);
  const loadedHistory = Array.from({ length: 35 }, (_, index) => ({ ...video, id: `saved-${index}` }));
  const updatedHistory = applyCompletion(loadedHistory);
  assert.equal(updatedHistory.length, 36);
  assert.equal(updatedHistory[0].id, "new-completion");
  assert.deepEqual(updatedHistory.slice(1).map(({ id }) => id), loadedHistory.map(({ id }) => id));
  assert.equal(applyCompletion(updatedHistory).length, 36, "refreshing the same completed video should replace its entry");
  assert.equal(loadedHistory.length, 35, "state updater must not mutate existing history");
});
