import assert from "node:assert/strict";
import test from "node:test";

import {
  LATEST_PRODUCT_UPDATE,
  shouldShowProductUpdateNotice,
} from "./product-updates.ts";

test("shows the Instagram connection notice only to accounts that existed before the fix", () => {
  assert.equal(
    shouldShowProductUpdateNotice(
      LATEST_PRODUCT_UPDATE,
      "2026-09-10T23:59:59.000Z",
    ),
    true,
  );
  assert.equal(
    shouldShowProductUpdateNotice(
      LATEST_PRODUCT_UPDATE,
      "2026-09-11T00:00:00.000Z",
    ),
    false,
  );
  assert.equal(
    shouldShowProductUpdateNotice(
      LATEST_PRODUCT_UPDATE,
      "2026-09-12T00:00:00.000Z",
    ),
    false,
  );
});

test("does not show an existing-user notice when the account age cannot be confirmed", () => {
  assert.equal(
    shouldShowProductUpdateNotice(LATEST_PRODUCT_UPDATE, null),
    false,
  );
  assert.equal(
    shouldShowProductUpdateNotice(LATEST_PRODUCT_UPDATE, "not-a-date"),
    false,
  );
});
