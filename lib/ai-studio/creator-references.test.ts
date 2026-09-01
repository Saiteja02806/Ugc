import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { CREATOR_REFERENCES } from "./creator-references.ts";

test("creator reference library ships the supplied optional image set", () => {
  assert.equal(CREATOR_REFERENCES.length, 17);
  assert.equal(new Set(CREATOR_REFERENCES.map((reference) => reference.id)).size, 17);

  for (const reference of CREATOR_REFERENCES) {
    assert.match(reference.src, /^\/ai-studio\/creator-references\/creator-\d{2}\.png$/);
    const assetPath = fileURLToPath(
      new URL(`../../public${reference.src}`, import.meta.url),
    );
    assert.equal(existsSync(assetPath), true, `${reference.src} must exist`);
  }
});
