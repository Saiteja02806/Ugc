import assert from "node:assert/strict";
import { mock, test } from "node:test";

let row: Record<string, unknown> = {};
const query = {
  select: () => query,
  eq: () => query,
  maybeSingle: async () => ({ data: row, error: null }),
};
mock.module("@supabase/supabase-js", { namedExports: { createClient: () => ({ from: () => query }) } });

test("application reader preserves valid Structure 2 attribution and tolerates stale optional metadata", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://local-test.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-only";
  try {
    const { getCarouselGeneration } = await import("./db.ts");
    row = { id: "test", structure_id: "structure_2", content_format_id: "wrong_belief",
      content_assigned_format_id: "wrong_belief", hook_family_id: null,
      hook_template_id: "the_real_reason", hook_template_version: 1 };
    assert.equal((await getCarouselGeneration("test"))!.hookTemplateId, "the_real_reason");
    assert.equal((await getCarouselGeneration("test"))!.hookTemplateVersion, 1);
    for (const pair of [[null, null], ["unknown", 1], ["the_real_reason", 99], ["cracked_the_code", 1]]) {
      [row.hook_template_id, row.hook_template_version] = pair;
      assert.equal((await getCarouselGeneration("test"))!.hookTemplateId, null);
    }
    row.structure_id = "invalid";
    await assert.rejects(getCarouselGeneration("test"), /invalid structure/);
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
