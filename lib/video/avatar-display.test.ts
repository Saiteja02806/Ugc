import assert from "node:assert/strict";
import test from "node:test";

import { getAvatarDisplayName, getAvatarFallbackText } from "./avatar-display.ts";

test("keeps the influencer name while removing reaction metadata", () => {
  assert.equal(getAvatarDisplayName("Reed - Concerned Reaction"), "Reed");
  assert.equal(getAvatarDisplayName("  Maya  "), "Maya");
  assert.equal(getAvatarDisplayName(""), "Influencer");
});

test("builds compact fallback initials", () => {
  assert.equal(getAvatarFallbackText("Reed - Concerned Reaction"), "R");
  assert.equal(getAvatarFallbackText("Ava Stone - Excited"), "AS");
});
