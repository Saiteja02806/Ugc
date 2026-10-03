import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test, { mock } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const local = (file) => pathToFileURL(path.resolve(file)).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      for (const extension of [".ts", ".tsx"]) {
        const url = local(specifier.slice(2) + extension);
        if (existsSync(fileURLToPath(url))) return { url, shortCircuit: true };
      }
    }
    if (["next/navigation", "next/link", "next/image"].includes(specifier)) {
      return next(specifier + ".js", context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (/\.tsx(?:\?|$)/u.test(url)) {
      return {
        format: "module", shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
          compilerOptions: {
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
      };
    }
    return next(url, context);
  },
});

let user = { uid: "fixture" }, authLoading = false, searchParams = new URLSearchParams();
let query = { data: null, isError: false, isFetching: false, isPending: false, refetch: async () => {} };
mock.module(local("contexts/auth-context.tsx"), {
  namedExports: { useAuth: () => ({ user, loading: authLoading }) },
});
mock.module(local("lib/firebase/auth.ts"), {
  namedExports: { getCurrentUserIdToken: async () => null },
});
mock.module(local("components/billing/use-billing-subscription.ts"), {
  namedExports: { useBillingSubscription: () => query },
});
mock.module("next/navigation", {
  namedExports: { useRouter: () => ({ push() {}, replace() {} }), useSearchParams: () => searchParams },
});
mock.module("next/link", {
  defaultExport: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children),
});
mock.module("next/image", {
  defaultExport: (props) => React.createElement("img", props),
});
mock.module(local("components/ui/badge.tsx"), {
  namedExports: { Badge: ({ children, className }) => React.createElement("span", { className }, children) },
});
mock.module(local("components/ui/separator.tsx"), {
  namedExports: { Separator: () => React.createElement("hr") },
});
mock.module(local("components/brand/product-logo.tsx"), {
  namedExports: { ProductLogoMark: () => null },
});
mock.module(local("components/auth/auth-method-picker.tsx"), {
  namedExports: { AuthMethodPicker: () => null },
});

const { PricingCard } = await import(local("components/pricing/pricing-card.tsx"));
const { PricingComparison } = await import(local("components/pricing/pricing-comparison.tsx"));
const { PricingPage } = await import(local("components/pricing/pricing-page.tsx"));
const { PricingCatalog } = await import(local("components/pricing/pricing-catalog.tsx"));
const { default: SignInPage } = await import(local("app/sign-in/page.tsx"));
const { pricingPlans } = await import(local("lib/pricing/plans.ts"));
const { FREE_TRIAL_CONTENT_DAYS } = await import(local("lib/billing/free-trial-policy.ts"));
const paid = { accessSource: "dodo", planKey: "starter", isActive: true, isDodoManaged: true, status: "active", billingInterval: "monthly", trial: { status: "expired" } };
function card(planSlug, subscription, props = {}) {
  return renderToStaticMarkup(React.createElement(PricingCard, {
    plan: pricingPlans.find((plan) => plan.slug === planSlug),
    billingInterval: "monthly", isSubscriptionLoading: false, subscription, ...props,
  }));
}
function primaryButton(html) {
  return html.match(/<button\b[^>]*aria-label="[^"]+"[^>]*>[\s\S]*?<\/button>/u)?.[0];
}

test("current paid management and annual-switch buttons render enabled", () => {
  const current = card("starter", paid);
  assert.match(current, /Manage current plan/u);
  assert.doesNotMatch(primaryButton(current), /disabled=""/u);
  const yearly = card("starter", paid, { billingInterval: "yearly" });
  assert.match(yearly, /Switch to annual billing/u);
  assert.doesNotMatch(primaryButton(yearly), /disabled=""/u);
  assert.match(yearly, /Current plan/u);
});

test("held subscriber has an enabled recovery button and no current-free badge", () => {
  const subscription = { ...paid, isActive: false, status: "on_hold" };
  const starter = card("starter", subscription);
  assert.match(starter, /Payment needed/u);
  assert.match(starter, /Update payment method/u);
  assert.doesNotMatch(primaryButton(starter), /disabled=""/u);
  const free = card("free", subscription);
  assert.doesNotMatch(free, /Current plan|Trial active/u);
  assert.match(free, /Manage billing/u);
  assert.doesNotMatch(primaryButton(free), /disabled=""/u);
});

test("complimentary current tier opens the workspace without a checkout label", () => {
  const html = card("starter", { ...paid, accessSource: "complimentary", isDodoManaged: false });
  assert.match(html, /Complimentary/u);
  assert.match(html, /Open workspace/u);
  assert.doesNotMatch(html, /Get Starter/u);
  assert.doesNotMatch(primaryButton(html), /disabled=""/u);
});

test("billing query failure renders retry and blocks every plan action", () => {
  query = { ...query, data: null, isError: true };
  const html = renderToStaticMarkup(React.createElement(PricingCatalog, { initialBillingInterval: "monthly" }));
  assert.match(html, /role="alert"/u);
  assert.match(html, /Retry billing details/u);
  assert.equal((html.match(/disabled=""[^>]+aria-label="Billing unavailable/gu) ?? []).length, 3);
  assert.match(html, /2 months free/u);
  assert.doesNotMatch(html, /Save 20%/u);
  query = { ...query, isError: false };
});

test("anonymous trial signup shows the actual duration and paid cards use the shared coin icon", () => {
  user = null;
  const html = card("free", null);
  assert.match(html, new RegExp(`Start ${FREE_TRIAL_CONTENT_DAYS}-day trial`, "u"));
  assert.match(html, new RegExp(`for ${FREE_TRIAL_CONTENT_DAYS} days`, "u"));
  assert.match(html, /href="\/sign-in\?plan=free&amp;billing=monthly"/u);
  assert.doesNotMatch(html, /Free forever/u);
  assert.match(card("starter", null), /credits\.png/u);
  authLoading = true;
  assert.match(primaryButton(card("starter", null)), /disabled=""/u);
  authLoading = false;
  user = { uid: "fixture" };
});

test("sign-in displays the catalog's billed price instead of historical hardcoded amounts", () => {
  for (const [plan, billing, expected] of [
    ["starter", "monthly", "Starter ($19/month)"],
    ["starter", "yearly", "Starter ($190/year)"],
    ["growth", "yearly", "Growth ($490/year)"],
  ]) {
    searchParams = new URLSearchParams({ plan, billing });
    const html = renderToStaticMarkup(React.createElement(SignInPage));
    assert.ok(html.includes(expected), expected);
    assert.doesNotMatch(html, /\$29\/mo|\$24\/mo/u);
  }
  searchParams = new URLSearchParams({ plan: "free" });
  assert.match(renderToStaticMarkup(React.createElement(SignInPage)), new RegExp(`${FREE_TRIAL_CONTENT_DAYS}-day free trial`, "u"));
});


test("pricing follows the URL after returning from signup with stale server props", () => {
  user = null;
  query = { ...query, isError: false };
  searchParams = new URLSearchParams({ billing: "yearly" });
  const annual = renderToStaticMarkup(React.createElement(PricingCatalog, { initialBillingInterval: "monthly" }));
  assert.match(annual, /Billed \$190 yearly/u);
  assert.match(annual, /plan=starter&amp;billing=yearly/u);
  searchParams = new URLSearchParams();
  const monthly = renderToStaticMarkup(React.createElement(PricingCatalog, { initialBillingInterval: "yearly" }));
  assert.match(monthly, /Billed \$19 monthly/u);
  assert.match(monthly, /plan=starter&amp;billing=monthly/u);
  user = { uid: "fixture" };
});


test("free credits are shown once per account, with the credit coin and YouTube benefits", () => {
  user = null;
  const free = card("free", null);
  assert.match(free, /2 free credits · once per account/u);
  assert.match(free, /credits\.png/u);
  assert.match(free, /Connect YouTube &amp; schedule videos/u);
  const comparison = renderToStaticMarkup(React.createElement(PricingComparison, { plans: pricingPlans }));
  const creditRow = comparison.match(/<tr[^>]*><th[^>]*>AI generation credits<\/th>[\s\S]*?<\/tr>/u)?.[0];
  assert.ok(creditRow);
  assert.match(creditRow, /Once per account/u);
  assert.equal((creditRow.match(/Per month/gu) ?? []).length, 2);
  assert.match(comparison, /YouTube channel connection/u);
  assert.match(comparison, /YouTube video scheduling/u);
  assert.match(comparison, /Uses free credits/u);
  user = { uid: "fixture" };
});

test("the full pricing page explains free-credit persistence and YouTube video support", () => {
  const html = renderToStaticMarkup(React.createElement(PricingPage, { initialBillingInterval: "monthly" }));
  assert.match(html, /Free accounts receive 2 credits once; these do not refill monthly/u);
  assert.match(html, /one-time free AI credits remain available until you spend them/u);
  assert.match(html, /YouTube supports video uploads/u);
  assert.doesNotMatch(html, /Custom AI Studio image and video generation requires a paid plan/u);
});
