import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseJobStore } from "../../dist/lib/supabase.js";

test("reservation retries only rolled-back SQL timeouts with identical inputs and a strict two-call bound", async () => {
  const input = { businessProfileId: "profile", carouselId: "carousel", primaryCategorySlug: "productivity", slidePlan: [], useProductAsset: true };
  for (const code of ["57014", "55P03", "NETWORK", "23505"]) {
    const calls = [];
    const store = new SupabaseJobStore({ rpc: async (...args) => {
      calls.push(args); return calls.length === 1 ? { data: null, error: { code, message: "first failure" } } : { data: [{ slide_number: 1 }], error: null };
    } });
    if (["57014", "55P03"].includes(code)) {
      assert.deepEqual(await store.reserveCarouselRoleAssets(input), [{ slide_number: 1 }]);
      assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]);
    } else { await assert.rejects(store.reserveCarouselRoleAssets(input), /first failure/); assert.equal(calls.length, 1); }
  }
});
