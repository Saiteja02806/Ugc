import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { upsertAIStudioResult } from "./media-results.ts";

const source = readFileSync(new URL("../../components/video/video-generation-workspace.tsx", import.meta.url), "utf8") + "\n" + readFileSync(new URL("../../components/video/video-result-prompt.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set([
  "OptimisticVideoCard", "VideoResultCard", "VideoResultMetadata", "VideoPromptBubble",
  "VideoHistoryDrawer", "getVideoHistoryTitle", "getVideoResultWidthClassName",
  "formatVideoDuration", "formatGeneratedAt",
]);
const declarations = ast.statements.filter((node) =>
  ts.isFunctionDeclaration(node) && names.has(node.name?.text) ||
  ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => declaration.name.getText(ast) === "VIDEO_RESULT_WIDTH_CLASS_NAMES"),
).map((node) => node.getText(ast).replace(/^export /, "")).join("\n");
const compiled = ts.transpileModule(declarations, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const icon = () => React.createElement("span", { "aria-hidden": "true" });
const placeholderSource = readFileSync(new URL("../../components/video/video-generation-placeholder.tsx", import.meta.url), "utf8");
const placeholderModule = {};
new Function("require", "exports", ts.transpileModule(placeholderSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(name => {
  if (name === "react/jsx-runtime") return jsxRuntime;
  assert.equal(name, "lucide-react");
  return { Loader2: props => React.createElement("span", props) };
}, placeholderModule);
const Button = ({ children, ...props }) => {
  delete props.variant;
  delete props.size;
  return React.createElement("button", props, children);
};
const Input = (props) => React.createElement("input", props);
const Link = ({ children, ...props }) => React.createElement("a", props, children);
const ResultActions = ({ title, url }) => React.createElement("a", { href: url, "aria-label": `Download ${title}` }, "Download");
const dependencies = {
  AiStudioCopyButton: ({ kind }) => React.createElement("button", { "aria-label": `Copy ${kind}` }, "Copy"),
  React, useState: React.useState, useRef: React.useRef, useEffect: React.useEffect,
  Button, Input, Link, AiStudioResultActions: ResultActions,
  cn: (...values) => values.filter(Boolean).join(" "),
  ChevronDown: icon, ChevronUp: icon, Clock3: icon, History: icon, Loader2: icon,
  Monitor: icon, Pause: icon, Play: icon, Search: icon, Sparkles: icon,
  Volume2: icon, VolumeX: icon, X: icon,
  VideoGenerationPlaceholder: placeholderModule.VideoGenerationPlaceholder,
  resultLayout: { card: "result-card", row: "result-row", media: "result-media", prompt: "result-prompt" },
};
const components = new Function(...Object.keys(dependencies), `${compiled}\nreturn { OptimisticVideoCard, VideoResultCard, VideoPromptBubble, VideoHistoryDrawer };`)(...Object.values(dependencies));
const render = (name, props) => renderToStaticMarkup(React.createElement(components[name], props));
const video = {
  id: "video-1", url: "https://example.com/video.mp4", thumbnailUrl: "https://example.com/poster.jpg",
  title: "Presenter video", prompt: "A presenter introduces a product.", ratio: "9:16",
  modelLabel: "Kling 3.0", resolution: "720p", durationSeconds: 15,
  createdAt: "2026-10-01T15:30:00Z", status: "Ready",
};

test("AI Studio and Explore share the animated preview with reduced-motion support and no invented progress", () => {
  const html = renderToStaticMarkup(React.createElement(placeholderModule.VideoGenerationPlaceholder, { aspectRatio: "16:9", label: "Preparing your video" }));
  assert.match(html, /aspect-ratio:16 \/ 9/);
  assert.match(html, /animate-spin motion-reduce:animate-none/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /Preparing your video/);
  assert.doesNotMatch(html, /<video|aria-valuenow|\d+%/);
  assert.match(source, /<VideoGenerationPlaceholder aspectRatio=\{aspectRatio\}/);
  assert.match(readFileSync(new URL("../../components/explore/workflow-preview-canvas.tsx", import.meta.url), "utf8"), /<VideoGenerationPlaceholder/);
});

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

test("pending and completed previews share the enlarged viewport-responsive portrait footprint", () => {
  const completed = render("VideoResultCard", { video });
  const pending = render("OptimisticVideoCard", {
    aspectRatio: video.ratio, prompt: video.prompt,
    modelLabel: video.modelLabel, durationSeconds: video.durationSeconds, resolution: video.resolution,
  });
  const width = "w-[min(100%,calc((100dvh-260px)*9/16),22rem)]";
  assert.ok(completed.includes(width));
  assert.ok(pending.includes(width));
  assert.match(completed, /max-w-\[64rem\]/);
  assert.match(completed, /result-row/);
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
    assert.match(html, /result-prompt/);
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

test("Hook and Wall keep History reachable with no current results and open only their active live drawer", () => {
  function attribute(component, name) {
    let expression;
    function visit(node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === component) {
        const found = node.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(ast) === name);
        if (found && ts.isJsxExpression(found.initializer)) expression = found.initializer.expression.getText(ast);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(expression, `${component} ${name} comes from the actual workspace`);
    return expression;
  }
  const toolbarCode = ts.transpileModule(`const toolbar = ${attribute("AiStudioResults", "toolbar")};`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const drawerOpen = new Function("recreateView", "active", "historyOpen", `return ${attribute("VideoHistoryDrawer", "open")};`);
  for (const format of ["hook", "wall_text"]) {
    let opened = false;
    const values = { React, Button, History: icon, Plus: icon,
      recreateView: { workflow: { format }, preview: false }, selectedHistoryVideo: null,
      visibleVideos: [], generatedVideos: [], isGenerating: false,
      setHistoryOpen: value => { opened = value; }, setSelectedHistoryVideoId() {}, startNewVideoSession() {},
    };
    const toolbar = new Function(...Object.keys(values), `${toolbarCode}\nreturn toolbar;`)(...Object.values(values));
    assert.match(renderToStaticMarkup(toolbar), />History<|>History\s/);
    const historyButton = React.Children.toArray(toolbar.props.children).find(child => React.isValidElement(child) && child.type === Button);
    assert.ok(historyButton, "History exists even before this visit generates anything");
    historyButton.props.onClick();
    assert.equal(drawerOpen(values.recreateView, true, opened), true);
    assert.equal(drawerOpen(values.recreateView, false, opened), false);
    assert.equal(drawerOpen({ ...values.recreateView, preview: true }, true, opened), false);
    values.recreateView.preview = true;
    assert.equal(new Function(...Object.keys(values), `${toolbarCode}\nreturn toolbar;`)(...Object.values(values)), undefined);
  }
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
