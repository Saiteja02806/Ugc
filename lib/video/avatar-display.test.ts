import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCreatorDisplayName,
  getAvatarDisplayName,
  getAvatarFallbackText,
} from "./avatar-display.ts";

test("keeps the influencer name while removing reaction metadata", () => {
  assert.equal(getAvatarDisplayName("Reed - Concerned Reaction"), "Reed");
  assert.equal(getAvatarDisplayName("  Maya  "), "Maya");
  assert.equal(getAvatarDisplayName(""), "Influencer");
});

test("formats creator 001 / creater 001 patterns to clean Creator 1, Creator 2", () => {
  assert.equal(formatCreatorDisplayName("Creator 001"), "Creator 1");
  assert.equal(formatCreatorDisplayName("Creator 002"), "Creator 2");
  assert.equal(formatCreatorDisplayName("creater 001"), "Creator 1");
  assert.equal(formatCreatorDisplayName("creator_051"), "Creator 51");
  assert.equal(getAvatarDisplayName("Creator 001 - Concerned Reaction"), "Creator 1");
  assert.equal(getAvatarDisplayName("creater 003 - Smiling"), "Creator 3");
  assert.equal(getAvatarDisplayName("Influencer 001"), "Creator 1");
});

test("builds compact fallback initials", () => {
  assert.equal(getAvatarFallbackText("Reed - Concerned Reaction"), "R");
  assert.equal(getAvatarFallbackText("Ava Stone - Excited"), "AS");
  assert.equal(getAvatarFallbackText("Creator 001 - Concerned Reaction"), "C1");
  assert.equal(getAvatarFallbackText("Creator 2"), "C2");
});
