import assert from "node:assert/strict";
import { mock, test } from "node:test";

const billing = await import("../billing/subscription-db.ts");
let subscription;
let imageCost = 1;
let reads = [];
mock.module("../billing/subscription-db.ts", { namedExports: {
  ...billing,
  getUserSubscription: async (userId, options) => { reads.push({ userId, options }); return subscription; },
  getGenerationCreditCost: (kind) => { assert.equal(kind, "image"); return imageCost; },
} });
const { getCharacterGenerationAccess } = await import("./generation-api.ts");

test("character access reads the verified owner's shared billing balance, including credits spent elsewhere", async () => {
  // Any separate allowance lookup or external call is a test failure.
  const network = mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected separate allowance lookup"); });
  try {
    for (const isActive of [false, true]) {
      for (const creditsRemaining of [2, 1, 0]) {
        subscription = { isActive, creditsRemaining };
        const result = await getCharacterGenerationAccess("owner");
        assert.equal(result.isPaid, isActive);
        assert.equal(result.creditsRemaining, creditsRemaining);
        assert.equal(result.affordableImageCount, creditsRemaining);
        assert.equal(result.canGenerate, creditsRemaining > 0);
        assert.equal(result.imageCreditCost, 1);
      }
    }
    imageCost = 2;
    subscription = { isActive: true, creditsRemaining: 5 };
    assert.equal((await getCharacterGenerationAccess("owner")).affordableImageCount, 2);
    assert.ok(reads.every(read => read.userId === "owner" && read.options.strict && read.options.refreshCredits === false));
    assert.equal(network.mock.callCount(), 0);
  } finally { network.mock.restore(); }
});
