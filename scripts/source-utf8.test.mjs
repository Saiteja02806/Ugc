import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";

test("tracked application source decodes as strict UTF-8", () => {
  const paths = execFileSync("git", ["ls-files", "-z", "app", "components", "lib"], { encoding: "utf8" })
    .split("\0").filter(path => /\.(?:tsx?|css|mjs)$/.test(path));
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const path of paths) assert.doesNotThrow(() => decoder.decode(readFileSync(path)), path);
});

test("image workspace labels do not contain double-encoded punctuation", () => {
  const source = readFileSync("components/workspace/ugc-chat-workspace.tsx", "utf8");
  assert.doesNotMatch(source, /\u00e2\u20ac\u00a6|\u00c2\u00b7|\u00c3\u2014/);
});
