import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = readFileSync(new URL("../../components/workspace/ugc-chat-workspace.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["ImageGenerationCard", "ImagePromptBubble", "getImagePreviewWidthClassName", "getGeneratedImageHeight", "formatGeneratedAt"]);
const declarations = ast.statements.filter((node) =>
  ts.isFunctionDeclaration(node) && names.has(node.name?.text) ||
  ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => declaration.name.getText(ast) === "IMAGE_PREVIEW_WIDTH_CLASS_NAMES"),
).map((node) => node.getText(ast)).join("\n");
const compiled = ts.transpileModule(declarations, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const icon = () => React.createElement("span", { "aria-hidden": "true" });
const dependencies = {
  React, useState: React.useState,
  cn: (...values) => values.filter(Boolean).join(" "),
  ChevronDown: icon, ChevronUp: icon, Loader2: icon,
  AiStudioResultActions: ({ title, url }) => React.createElement("a", { href: url, "aria-label": `Download ${title}` }, "Download"),
};
const components = new Function(...Object.keys(dependencies), `${compiled}\nreturn { ImageGenerationCard, ImagePromptBubble };`)(...Object.values(dependencies));
const render = (name, props) => renderToStaticMarkup(React.createElement(components[name], props));
const prompt = "Use the supplied face.\nCreate a portrait with natural window light.";
const asset = { id: "image-1", url: "https://example.com/image.png", title: "Generated image", prompt, aspectRatio: "9:16", createdAt: "2026-10-01T15:30:00Z" };
const props = { asset: null, aspectRatio: asset.aspectRatio, prompt, createdAt: asset.createdAt, referenceImageUrl: null };

test("pending and completed image rows keep the preview on the left and the prompt on the right", () => {
  for (const html of [render("ImageGenerationCard", props), render("ImageGenerationCard", { ...props, asset })]) {
    assert.ok(html.indexOf("data-image-preview") < html.indexOf("data-image-details"));
    assert.match(html, /flex flex-col items-start gap-4 sm:flex-row sm:gap-6/);
    assert.match(html, /max-w-\[54rem\]/);
    assert.match(html, /max-w-\[min\(160px,20dvh\)\]/);
    assert.match(html, /data-image-details[^>]*self-start[^>]*sm:max-w-\[26rem\]/);
    const articleClassName = html.match(/<article[^>]*class="([^"]*)"/)?.[1];
    assert.ok(articleClassName);
    assert.doesNotMatch(articleClassName, /\bborder\b|\bbg-|\bp-\d|\bsm:p-|\bring-/);
    assert.match(html, /aria-label="Show full image prompt"/);
    assert.ok(html.includes(prompt));
  }
});

test("image progress is inside its left preview and is replaced by the full uncropped result", () => {
  const pending = render("ImageGenerationCard", props);
  const complete = render("ImageGenerationCard", { ...props, asset });
  assert.equal((pending.match(/role="status"/g) ?? []).length, 1);
  assert.ok(pending.indexOf("data-image-preview") < pending.indexOf('role="status"'));
  assert.ok(pending.indexOf('role="status"') < pending.indexOf("data-image-details"));
  assert.match(pending, /Creating your image/);
  assert.doesNotMatch(complete, /Creating your image|role="status"/);
  assert.match(complete, /<img[^>]*object-contain/);
  assert.match(complete, /aria-label="Download Generated image"/);
  assert.ok(complete.indexOf('aria-label="Download Generated image"') < complete.indexOf("data-image-details"), "image actions stay beneath the left preview");
  assert.ok(complete.indexOf("Ready") < complete.indexOf("data-image-details"), "ratio and ready status stay with the preview");
});

test("submitted image prompts are collapsed accessibly while retaining the complete text", () => {
  const html = render("ImagePromptBubble", { createdAt: asset.createdAt, prompt: `${prompt}\n${"More instructions. ".repeat(150)}` });
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /line-clamp-3/);
  assert.match(html, /More instructions\./);
  assert.match(source, /expanded \? "max-h-48 overflow-y-auto overscroll-contain pr-2" : "line-clamp-3"/);
});
