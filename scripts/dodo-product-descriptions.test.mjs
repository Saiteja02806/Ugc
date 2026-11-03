import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS, applyDescriptions, reviewDescriptions } from "./reconcile-dodo-product-descriptions.mjs";

function fixture() {
  const writes = [];
  const products = Object.fromEntries(PRODUCTS.map(([slug, interval, id]) => [id, {
    product_id: id, name: `Vidmake ${slug} ${interval}`, description: "Old catalogue copy",
    price: { currency: "USD", price: ({ starter: { monthly: 29, yearly: 299 }, growth: { monthly: 49, yearly: 490 }, startup: { monthly: 99, yearly: 999 } })[slug][interval] * 100, payment_frequency_interval: interval === "monthly" ? "Month" : "Year" },
    credit_entitlements: [{ id: "historical-image-credit", credits_amount: 200 }], entitlements: [{ id: "existing-entitlement" }], metadata: { preserve: "existing" },
  }]));
  const client = { products: { retrieve: async id => structuredClone(products[id]), update: async (id, body) => {
    writes.push({ id, body }); Object.assign(products[id], body);
  } } };
  return { client, products, writes };
}

test("description review uses current shared allowances and exact annual prices without writes", async () => {
  const { client, writes } = fixture(), review = await reviewDescriptions(client);
  assert.equal(writes.length, 0); assert.equal(review.length, 6);
  for (const item of review) {
    const credits = ({ starter: "200", growth: "600", startup: "1,200" })[item.slug];
    assert.ok(item.description.includes(`${credits} shared AI credits per month`));
    assert.doesNotMatch(item.description, /refund|trial|cancel|priority|600 monthly/i);
  }
  assert.match(review.at(-1).description, /150 four-second hooks or 100 six-second videos, not both[\s\S]*\$999 annually/);
});

test("apply sends description only and preserves product prices, entitlements and metadata", async () => {
  const { client, products, writes } = fixture(), before = structuredClone(products), review = await reviewDescriptions(client);
  await applyDescriptions(client, review);
  assert.equal(writes.length, 6);
  for (const write of writes) {
    assert.deepEqual(Object.keys(write.body), ["description"]);
    assert.deepEqual(products[write.id], { ...before[write.id], description: write.body.description });
  }
});

test("changed catalogue or unexpected price refuses every write", async () => {
  const { client, products, writes } = fixture(), review = await reviewDescriptions(client);
  products[PRODUCTS.at(-1)[2]].description = "Concurrent merchant edit";
  await assert.rejects(applyDescriptions(client, review), /changed after review/);
  assert.equal(writes.length, 0);
  products[PRODUCTS[0][2]].price.price = 1;
  await assert.rejects(reviewDescriptions(client), /Unexpected price/);
  assert.equal(writes.length, 0);
});
