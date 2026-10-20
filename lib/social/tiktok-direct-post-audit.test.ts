import assert from "node:assert/strict";
import test from "node:test";

import { isTikTokDirectPostAudited } from "./tiktok-direct-post-audit.ts";

test("the web app uses approved posting by default and honors explicit overrides", () => {
  const previous = process.env.TIKTOK_DIRECT_POST_AUDITED;
  try {
    delete process.env.TIKTOK_DIRECT_POST_AUDITED;
    assert.equal(isTikTokDirectPostAudited(), true);
    process.env.TIKTOK_DIRECT_POST_AUDITED = " TRUE ";
    assert.equal(isTikTokDirectPostAudited(), true);
    process.env.TIKTOK_DIRECT_POST_AUDITED = "false";
    assert.equal(isTikTokDirectPostAudited(), false);
  } finally {
    if (previous === undefined) delete process.env.TIKTOK_DIRECT_POST_AUDITED;
    else process.env.TIKTOK_DIRECT_POST_AUDITED = previous;
  }
});
