import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import DodoPayments from "dodopayments";
import { displayedPricingPlans, getPlanVideoAllowance } from "../lib/pricing/plans.ts";

// Public product identifiers reviewed against the merchant's six existing products.
// This utility can update DESCRIPTION ONLY; it cannot change prices or credits.
export const PRODUCTS = [
  ["starter", "monthly", "pdt_0NjAgM8lgylBnopVzS0gy"],
  ["starter", "yearly", "pdt_0Nlppaiv3CehGoBw9g0Nj"],
  ["growth", "monthly", "pdt_0NjAiCt8PWENDXfDyVeyE"],
  ["growth", "yearly", "pdt_0Nlpr4cC0HHCuJ1JoUw3z"],
  ["startup", "monthly", "pdt_0Nr1EU7fTOznh7Au0qrWK"],
  ["startup", "yearly", "pdt_0Nr1EcYSxhTFJs2KTD74z"],
];

export function descriptionFor(plan, interval) {
  const { hookVideos, fullVideos } = getPlanVideoAllowance(plan.sharedMonthlyCredits);
  const amount = plan.sharedMonthlyCredits.toLocaleString("en-US");
  return `Vidmake ${plan.name}. ${amount} shared AI credits per month for images and videos. ` +
    `Using Omni Flash at 2 credits per second provides up to ${hookVideos} four-second hooks or ${fullVideos} six-second videos, not both. WAN 3.0 and Kling 4.0 use 2 credits per second; Kling 3.0 uses 1; Seedance 2.5 uses 3. ` +
    `Images and other AI generation use the same credit balance. Billed $${plan.prices[interval]} ${interval === "yearly" ? "annually" : "monthly"}.`;
}

function snapshot(product) {
  return { productId: product.product_id, name: product.name, description: product.description ?? "", price: product.price,
    creditEntitlements: product.credit_entitlements, entitlements: product.entitlements, metadata: product.metadata };
}

export async function reviewDescriptions(client) {
  const review = [];
  for (const [slug, interval, id] of PRODUCTS) {
    const plan = displayedPricingPlans.find(p => p.slug === slug);
    const product = snapshot(await client.products.retrieve(id));
    assert.equal(product.productId, id);
    assert.equal(product.price.currency, "USD");
    assert.equal(product.price.price, plan.prices[interval] * 100, `Unexpected price for ${slug}/${interval}; no writes allowed`);
    assert.equal(product.price.payment_frequency_interval, interval === "yearly" ? "Year" : "Month");
    assert(new RegExp(slug === "startup" ? "start\\s*up" : slug, "i").test(product.name), `Wrong product tier: ${id}`);
    review.push({ slug, interval, before: product, description: descriptionFor(plan, interval) });
  }
  return review;
}

export async function applyDescriptions(client, approvedReview, onVerified = () => {}) {
  // Re-read ALL six and compare with the reviewed artifact before the first write.
  const fresh = await reviewDescriptions(client);
  assert.deepEqual(fresh, approvedReview, "Product catalogue changed after review; prepare a fresh review before applying");
  for (const item of fresh) {
    if (item.before.description !== item.description) {
      await client.products.update(item.before.productId, { description: item.description }, { maxRetries: 0, timeout: 15000 });
    }
    const after = snapshot(await client.products.retrieve(item.before.productId));
    assert.deepEqual(after, { ...item.before, description: item.description }, `Unexpected non-description change: ${item.before.productId}`);
    onVerified({ productId: item.before.productId, verified: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
  if (!args.includes("--out")) throw new Error("Supply --out <review.json>. Default is read-only; --apply additionally requires --review <review.json>.");
  if (args.includes("--env-file")) process.loadEnvFile(value("--env-file"));
  if (args.includes("--apply") && !args.includes("--review")) throw new Error("--apply requires the exact reviewed --review artifact");
  // Read the approval artifact before writing output, even if paths coincide.
  const approved = args.includes("--apply") ? JSON.parse(readFileSync(value("--review"), "utf8")) : null;
  if (!process.env.DODO_PAYMENTS_API_KEY) throw new Error("Dodo API credentials are unavailable");
  const client = new DodoPayments({ bearerToken: process.env.DODO_PAYMENTS_API_KEY, environment: "live_mode", maxRetries: 0, timeout: 15000 });
  const review = await reviewDescriptions(client);
  writeFileSync(value("--out"), JSON.stringify(review, null, 2));
  if (args.includes("--apply")) {
    await applyDescriptions(client, approved, result => console.log(JSON.stringify(result)));
  } else console.log(JSON.stringify(review.map(item => ({ plan: item.slug, interval: item.interval, productId: item.before.productId, before: item.before.description, proposed: item.description }))));
}
