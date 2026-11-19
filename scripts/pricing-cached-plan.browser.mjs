import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Pricing plan action snapshot: verifies that returning to the pricing page
// shows active plan buttons from the browser's local subscription snapshot
// instead of waiting on a fresh network call. Exercises the real PricingCard,
// PricingCatalog, plan-action, snapshot helper, on-mount snapshot write and the
// actual subscription fetch. Auth context, Firebase token, navigation and Link
// are stubbed; no real plan, payment or backend call is touched.
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); }
catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }

const root = process.cwd();
const out = path.join(root, ".tmp/pricing-cached-plan-browser");
mkdirSync(out, { recursive: true });
const write = (name, content) => { const file = path.join(out, name); writeFileSync(file, content); return file; };

const SNAPSHOT_STORAGE_KEY = "vidmake.billing.plan-snapshot.v1";

const aliases = {
  "@/contexts/auth-context": write(
    "auth.ts",
    `import { useSyncExternalStore } from "react";
let owner = "snapshot-owner";
const listeners = new Set();
window.__setPlanFixtureOwner = value => {
  owner = value;
  for (const notify of listeners) notify();
};
export function useAuth() {
  const uid = useSyncExternalStore(
    notify => { listeners.add(notify); return () => listeners.delete(notify); },
    () => owner,
  );
  return { user: uid ? { uid } : null, loading: false };
}`,
  ),
  "@/lib/firebase/auth": write(
    "token.ts",
    `export async function getCurrentUserIdToken() {
  window.__subscriptionRequests = (window.__subscriptionRequests || 0) + 1;
  return "snapshot-fixture-token";
}`,
  ),
  "next/navigation": write(
    "navigation.ts",
    `export const useRouter = () => ({ push: url => location.assign(url), replace: url => location.replace(url) });
export const useSearchParams = () => new URLSearchParams(location.search);
export const usePathname = () => "/pricing";`,
  ),
  "next/link": write(
    "link.tsx",
    `export default function Link({ href, children, ...props }) { return <a href={href} {...props}>{children}</a>; }`,
  ),
};

write(
  "loader.cjs",
  `const ts = require(${JSON.stringify(require.resolve("typescript"))});
module.exports = function (source) {
  return ts.transpileModule(source, {
    fileName: this.resourcePath,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
};`,
);

write(
  "style-loader.cjs",
  `module.exports = function () { return "export default new Proxy({}, { get: (_, key) => 'snapshot-' + String(key) });"; };`,
);

write(
  "entry.tsx",
  `import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PricingCatalog } from "@/components/pricing/pricing-catalog";

const client = new QueryClient();
const fixtureRoot = createRoot(document.getElementById("root"));
fixtureRoot.render(
  React.createElement(
    QueryClientProvider,
    { client },
    React.createElement("main", null, React.createElement(PricingCatalog, { initialBillingInterval: "monthly" })),
  ),
);`,
);

const { webpack } = require("next/dist/compiled/webpack/webpack");
await new Promise((resolve, reject) => {
  const compiler = webpack({
    mode: "development",
    devtool: false,
    context: root,
    entry: path.join(out, "entry.tsx"),
    output: { path: out, filename: "bundle.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": root } },
    plugins: [
      new webpack.DefinePlugin({ "process.env.NODE_ENV": '"development"', "process.env": {} }),
    ],
    module: {
      rules: [
        { test: /\.tsx?$/, use: path.join(out, "loader.cjs"), exclude: /node_modules/ },
        { test: /\.module\.css$/, use: path.join(out, "style-loader.cjs") },
      ],
    },
  });
  compiler.run((error, stats) =>
    compiler.close(() =>
      error || stats.hasErrors()
        ? reject(error || new Error(stats.toString({ all: false, errors: true })))
        : resolve(),
    ),
  );
});

write(
  "fixture.css",
  (await postcss([tailwind({ base: root })]).process(
    readFileSync("app/globals.css", "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') +
      `\n@source "../components/pricing";\n@source "../components/ui";\n@source "../components/icons";\n@source "../.tmp/pricing-cached-plan-browser/entry.tsx";`,
    { from: path.join(root, "app/globals.css") },
  )).css,
);

const requests = [];
let mode = "immediate";
let respondPlan = "paid";
const server = createServer((req, res) => {
  if (req.url.startsWith("/api/billing/")) {
    requests.push({ url: req.url, mode });
    const respond = () => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        subscription: respondPlan === "free"
          ? {
              userId: "snapshot-owner",
              accessSource: "free",
              billingInterval: null,
              isActive: false,
              isDodoManaged: false,
              planKey: "free",
              status: "free",
              trial: { status: "expired" },
            }
          : {
              userId: "snapshot-owner",
              accessSource: "dodo",
              billingInterval: "monthly",
              isActive: true,
              isDodoManaged: true,
              planKey: "starter",
              status: "active",
              trial: { status: "expired" },
            },
      }));
    };
    if (mode === "delayed") {
      setTimeout(respond, 900);
      return;
    }
    respond();
    return;
  }
  const name = req.url.split("?")[0];
  if (name === "/bundle.js" || name === "/fixture.css") {
    res.setHeader("Content-Type", name.endsWith(".css") ? "text/css" : "text/javascript; charset=utf-8");
    res.end(readFileSync(path.join(out, name.slice(1))));
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="en">
<head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><title>Pricing snapshot</title></head>
<body style="margin:0;background:#101014"><main id="root" style="padding:24px"></main>
<script>
  const params = new URLSearchParams(location.search);
  const seed = params.get("seed");
  const staleMs = Number(params.get("stale") || 0);
  function snapshot(planKey, status, active, trialStatus) {
    return JSON.stringify({
      ownerId: "snapshot-owner",
      storedAt: Date.now() - staleMs,
      subscription: {
        accessSource: active ? "dodo" : "free",
        billingInterval: active ? "monthly" : null,
        isActive: active,
        isDodoManaged: active,
        planKey,
        status,
        trial: { status: trialStatus },
      },
    });
  }
  if (seed === "paid") localStorage.setItem("${SNAPSHOT_STORAGE_KEY}", snapshot("starter", "active", true, "expired"));
  else if (seed === "free") localStorage.setItem("${SNAPSHOT_STORAGE_KEY}", snapshot("free", "free", false, "expired"));
  else localStorage.removeItem("${SNAPSHOT_STORAGE_KEY}");
</script>
<script src="/bundle.js"></script>
</body></html>`);
});
server.on("connection", socket => socket.on("close", () => socket.destroy()));
const origin = await new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));

let browser;
const results = [];
try {
  browser = await pw.chromium.launch({ headless: true, channel: "msedge" });

  // 1. The on-mount subscription fetch writes the snapshot.
  mode = "immediate";
  respondPlan = "paid";
  const write = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await write.goto(origin);
  await write.getByRole("button", { name: "Manage current plan for Starter plan" }).waitFor({ timeout: 10_000 });
  const captured = await write.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "null"), SNAPSHOT_STORAGE_KEY);
  assert.equal(captured.ownerId, "snapshot-owner");
  assert.equal(captured.subscription.planKey, "starter");
  assert.ok(captured.storedAt > Date.now() - 5_000);
  results.push({ step: "write", status: "PASS" });
  await write.close();

  // 2. Returning from checkout is a fresh page load; cached CTAs are enabled
  //    before the delayed subscription response finishes.
  mode = "delayed";
  respondPlan = "paid";
  const cached = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await cached.goto(`${origin}?seed=paid`);
  const cacheStartedAt = Date.now();
  await cached.getByRole("button", { name: "Manage current plan for Starter plan" }).waitFor({ timeout: 10_000 });
  assert.ok(Date.now() - cacheStartedAt < 900, "Snapshot must hydrate CTAs before the subscription response");
  const ctaText = await cached.getByRole("button", { name: "Manage current plan for Starter plan" }).innerText();
  assert.match(ctaText, /Manage current plan/u);
  await cached.close();
  results.push({ step: "instant cached hydration", status: "PASS" });

  // 3. A fresh, uncached visit waits on the network.
  const fresh = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await fresh.goto(origin);
  await fresh.waitForFunction(() => document.body.innerText.includes("Checking plan"));
  await fresh.getByRole("button", { name: "Manage current plan for Starter plan" }).waitFor({ timeout: 10_000 });
  await fresh.close();
  results.push({ step: "brand new visit waits on the network", status: "PASS" });

  // 4. A fresh response overrides the snapshot within the same visit.
  mode = "immediate";
  respondPlan = "free";
  const updated = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await updated.goto(`${origin}?seed=paid`);
  await updated.evaluate(() => window.location.reload());
  await updated.getByRole("button", { name: "Get Starter for Starter plan" }).waitFor({ timeout: 10_000 });
  const override = await updated.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "null"), SNAPSHOT_STORAGE_KEY);
  assert.equal(override.subscription.planKey, "free");
  results.push({ step: "fresh response overrides the snapshot", status: "PASS" });
  await updated.close();
} catch (error) {
  results.push({ error: error instanceof Error ? error.message : String(error) });
  try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => { errors.push(error.message); });
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${origin}?seed=paid`);
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: path.join(out, "failure.png"), fullPage: true });
  results.push({ body: await page.evaluate(() => document.body.innerText), errors });
  } catch { /* Diagnostic capture failed too. */ }
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
if (results.some(entry => entry.error)) console.log(requests);
console.log(JSON.stringify(results, null, 2));
