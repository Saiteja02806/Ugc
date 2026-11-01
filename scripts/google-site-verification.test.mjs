import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("app/layout.tsx configures Google Search Console site verification", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(
    layout,
    /verification:\s*\{[\s\S]*?google:\s*["']X8wAlsUNDn-IxZoXdj-k5R1WhTKxO8Eb1GEJKzzFyvM["']/,
    "Root layout metadata must configure Google site verification token"
  );
});
