import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Source-level guard for the new always-visible drag affordance on text overlays.
const source = readFileSync("components/explore/format-video-text-overlay.tsx", "utf8");

test("editing preview shows an always-visible drag container and move chip on text overlays", () => {
  assert.match(source, /stroke="rgba\(255,255,255,\.38\)" strokeDasharray=/u, "The container must be visible without hover");
  assert.match(source, /strokeDasharray=\{`\$\{width \* \.014\} \$\{width \* \.014\}`\}/u, "The container uses a dashed pattern scaled to the frame");
  assert.match(source, /data-move-chip aria-hidden="true"/u, "A move chip marks the draggable surface");
  assert.match(source, /polyline points="5 9 2 12 5 15"/u, "The chip carries the move glyph");
  assert.match(source, /fill="rgba\(12,12,16,\.68\)"/u, "The chip stays readable over any footage");
  // Accessibility contract kept on the container handle.
  assert.match(source, /aria-roledescription="draggable text"/u);
  assert.match(source, /aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"/u);
});
