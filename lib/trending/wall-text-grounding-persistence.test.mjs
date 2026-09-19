import assert from "node:assert/strict";
import test from "node:test";

import { createWallTextLayout } from "./wall-text-feed-logic.ts";
import { createAuthoritativeWallTextContent } from "./wall-layout-engine.ts";
import { prepareWallTextForPersistence } from "./wall-text-db.ts";

test("retains the assigned business-fact receipt through final Wall persistence", async () => {
  const layout = createWallTextLayout();
  const grounding = {
    anchorId: "capability-1",
    factSnapshotVersion: "business-facts-v1",
    factText: "Turn a meal photo into a draft log",
    factType: "capability",
    version: "wall-text-grounding-v2",
  };
  const generated = await createAuthoritativeWallTextContent({
    content: {
      kind: "text",
      text: "Taking a meal photo before eating makes the details easier to remember later, so the next meal log feels less like a guessing game.",
    },
    formatId: "freeform",
    layout,
  });

  const persisted = await prepareWallTextForPersistence({
    layout,
    text: { ...generated.content, grounding },
  });

  assert.deepEqual(persisted.text.grounding, grounding);
});
