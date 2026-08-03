import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const composer = readProjectFile(
  "components/generation/ai-studio-composer.tsx",
);
const imageWorkspace = readProjectFile(
  "components/workspace/ugc-chat-workspace.tsx",
);
const studioWorkspace = readProjectFile(
  "components/generation/ai-studio-workspace.tsx",
);
const videoWorkspace = readProjectFile(
  "components/video/video-generation-workspace.tsx",
);
const promptHelper = composer.slice(
  composer.indexOf("<FieldDescription"),
  composer.indexOf("</FieldDescription>") + "</FieldDescription>".length,
);

test("the image prompt uses one unified composer surface", () => {
  assert.match(imageWorkspace, /layout="unified"/);
  assert.match(composer, /data-layout=\{layout\}/);
  assert.match(
    composer,
    /"mx-auto w-full max-w-\[1024px\] border bg-card shadow-floating"/,
  );
  assert.match(
    composer,
    /layout === "unified"[\s\S]*?"rounded-\[24px\] border-border-strong p-0/,
  );
  assert.match(
    composer,
    /"max-h-60 min-h-28 rounded-none px-0 py-0 text-base font-normal leading-7"/,
  );
  assert.match(composer, /layout === "unified"\s*\?\s*"flex"/);
});

test("the unified toolbar keeps settings and Generate inside the same form", () => {
  assert.match(composer, /<form[\s\S]*?\{settings\}[\s\S]*?type="submit"/);
  assert.match(composer, /layout === "unified" && "px-3 pb-3 sm:px-4 sm:pb-4"/);
  assert.match(imageWorkspace, /label="4:5 portrait"/);
  assert.match(imageWorkspace, /label="1 image"/);
  assert.match(imageWorkspace, />\s*Enhance\s*</);
  assert.match(imageWorkspace, /generateLabel="Generate image"/);
  assert.doesNotMatch(videoWorkspace, /layout="unified"/);
});

test("access guidance appears once inside the composer", () => {
  assert.match(promptHelper, /accessMessage \?\?/);
  assert.doesNotMatch(composer, /generationLocked \? \(\s*<p/);
  assert.match(studioWorkspace, /if \(state !== "pro"\) \{\s*return null;/);
  assert.doesNotMatch(studioWorkspace, /Pro access required/);
});

test("the redesign preserves prompt and submission behavior", () => {
  assert.match(composer, /onSubmit=\{onSubmit\}/);
  assert.match(composer, /onKeyDown=\{onTextareaKeyDown\}/);
  assert.match(composer, /prompt\.length > maxLength/);
  assert.match(composer, /disabled=\{generateDisabled \|\| promptTooLong\}/);
  assert.match(imageWorkspace, /onClick=\{handleEnhancePrompt\}/);
});

function readProjectFile(relativePath: string) {
  return readFileSync(
    new URL(`../../${relativePath}`, import.meta.url),
    "utf8",
  );
}
