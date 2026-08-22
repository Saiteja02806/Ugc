import assert from "node:assert/strict";
import test from "node:test";

import { groupAvatarsByCreator } from "./avatar-grouping.ts";

test("groups every source from the same creator into one folder", () => {
  const groups = groupAvatarsByCreator([
    { creatorKey: "creator_001", id: "a", label: "Creator 001 - Smile" },
    { creatorKey: "creator_001", id: "b", label: "Creator 001 - Shock" },
    { creatorKey: "creator_002", id: "c", label: "Creator 002 - Talk" },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => [group.label, group.options.map((item) => item.id)]),
    [
      ["Creator 001", ["a", "b"]],
      ["Creator 002", ["c"]],
    ],
  );
});

test("falls back to the creator portion of an asset label", () => {
  const groups = groupAvatarsByCreator([
    { creatorKey: null, id: "a", label: "Talia - Laughing" },
    { creatorKey: null, id: "b", label: "Talia - Surprised" },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.label, "Talia");
  assert.equal(groups[0]?.options.length, 2);
});
