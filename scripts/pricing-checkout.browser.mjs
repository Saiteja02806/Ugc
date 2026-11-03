import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Actual PricingCard + deadline helper. Account/provider boundaries are isolated;
// no billing request can reach a real service and no payment is submitted.
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); }
catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = process.cwd(), out = path.join(root, ".tmp/pricing-checkout-browser");
mkdirSync(out, { recursive: true });
const write = (name, content) => { const file = path.join(out, name); writeFileSync(file, content); return file; };
const aliases = {
  "@/contexts/auth-context": write("auth.ts", `import{useSyncExternalStore}from'react';let owner='fixture-owner';const listeners=new Set();window.setFixtureOwner=value=>{owner=value;for(const notify of listeners)notify()};export const useAuth=()=>{const uid=useSyncExternalStore(notify=>{listeners.add(notify);return()=>listeners.delete(notify)},()=>owner);return{user:uid?{uid}:null,loading:false}};`),
  "@/lib/firebase/auth": write("token.ts", `export async function getCurrentUserIdToken(owner){window.requestedOwner=owner;const mode=new URLSearchParams(location.search).get('mode');if(mode==='token-stall')return new Promise(()=>{});return mode==='no-token'?null:'fixture-only-token';}`),
  "next/navigation": write("navigation.ts", `export const useRouter=()=>({push:url=>location.assign(url)});`),
  "next/link": write("link.tsx", `export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`),
  "next/image": write("image.tsx", `export default function Image({fill,unoptimized,...props}){return <img {...props}/>}`),
};
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(s){return ts.transpileModule(s,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};`);
write("entry.tsx", `import{createRoot}from'react-dom/client';import{PricingCard}from'@/components/pricing/pricing-card';import{displayedPricingPlans}from'@/lib/pricing/plans';const params=new URLSearchParams(location.search),interval=params.get('billing')||'yearly';const subscription={accessSource:'complimentary',planKey:'growth',isActive:true,isDodoManaged:params.get('managed')==='1',status:'active',billingInterval:'monthly',trial:{status:'expired'}};const fixtureRoot=createRoot(document.getElementById('root'));window.unmountPricingFixture=()=>fixtureRoot.unmount();fixtureRoot.render(<main className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">{displayedPricingPlans.map(plan=><PricingCard key={plan.slug} plan={plan} allowanceView="hooks" billingInterval={interval} isSubscriptionLoading={false} subscription={subscription}/>)}</main>);`);
const { webpack } = require("next/dist/compiled/webpack/webpack");
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": root } },
    module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs"), exclude: /node_modules/ }] } });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
});
write("fixture.css", (await postcss([tailwind({ base: root })]).process(readFileSync("app/globals.css", "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + '\n@source "../components/pricing";\n@source "../components/ui";\n@source "../components/icons";\n@source "../.tmp/pricing-checkout-browser/entry.tsx";', { from: path.join(root, "app/globals.css") })).css);
const requests = [], sockets = new Set();
let mode = "failure", origin;
const server = createServer((req, res) => {
  if (req.url.startsWith("/api/billing/")) {
    let body = "";
    req.on("data", data => body += data);
    req.on("end", () => {
      requests.push({ url: req.url, body: body ? JSON.parse(body) : null, authorization: req.headers.authorization });
      if (mode === "headers-stall") return;
      res.setHeader("Content-Type", "application/json");
      if (mode === "body-stall") { res.writeHead(200); res.flushHeaders(); res.write('{"checkoutUrl":'); return; }
      if (mode === "invalid-json") { res.end("not-json"); return; }
      if (mode === "success" || mode === "delayed-success") {
        const response = JSON.stringify({ checkoutUrl: origin + "/destination?" + new URLSearchParams(requests.at(-1).body ?? { portal: "true" }) });
        if (mode === "delayed-success") setTimeout(() => res.end(response), 750);
        else res.end(response);
        return;
      }
      setTimeout(() => { res.writeHead(503); res.end(JSON.stringify({ error: "Fixture billing temporarily unavailable. Try again." })); }, 150);
    });
    return;
  }
  if (req.url.startsWith("/destination")) { res.end("Checkout destination reached without payment"); return; }
  const name = req.url.split("?")[0];
  if (name === "/bundle.js" || name === "/fixture.css") {
    res.setHeader("Content-Type", name.endsWith(".css") ? "text/css" : "text/javascript; charset=utf-8"); res.end(readFileSync(path.join(out, name.slice(1)))); return;
  }
  if (name === "/icons/credits.png") { res.setHeader("Content-Type", "image/png"); res.end(readFileSync("public/icons/credits.png")); return; }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end('<!doctype html><html class="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><body style="margin:0;background:#101014"><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
const modelsOnly = process.argv.includes("--models-only");
try {
  browser = await pw.chromium.launch({ headless: true, channel: "msedge" });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
    const page = await browser.newPage({ viewport });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin); const button = page.getByRole("button", { name: "Get Startup for Startup plan", exact: true }); await button.waitFor();
    assert.equal(await page.locator("article").count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.match(await page.locator("article").nth(2).innerText(), /\$83[\s\S]*Billed \$999 yearly[\s\S]*150 video hooks[\s\S]*1,200 credits/);
    const modelRequestCount=requests.length;
    for (const name of ["Starter", "Growth", "Startup"]) {
      assert.match(await page.getByRole("combobox",{name:`Video model for ${name} allowance`}).innerText(),/Omni Flash/);
    }
    await page.screenshot({path:path.join(out,`default-omni-${viewport.width}.png`),fullPage:true});
    const choose = async (card,model) => {
      await card.getByRole("combobox").scrollIntoViewIfNeeded();
      await card.getByRole("combobox").click();
      const label=({google_omni:"Omni Flash",wan_3_0:"WAN 3.0",seedance_2_5:"Seedance 2.5",kling_3_0:"Kling 3.0",kling_4_0:"Kling 4.0"})[model];
      await page.getByRole("listbox").waitFor();
      try { await page.getByRole("option").filter({hasText:label}).click({timeout:3000}); }
      catch(error) {
        await page.screenshot({path:path.join(out,"picker-failure.png"),fullPage:true});
        write("picker-failure.json",JSON.stringify(await page.evaluate(()=>({scrollY,active:document.activeElement?.outerHTML,options:Array.from(document.querySelectorAll('[role="option"]'),el=>({text:el.textContent,rect:el.getBoundingClientRect().toJSON(),display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility,ancestors:[el.parentElement,el.parentElement?.parentElement,el.parentElement?.parentElement?.parentElement].map(e=>e&&({tag:e.tagName,rect:e.getBoundingClientRect().toJSON(),style:e.getAttribute("style"),class:e.className}))}))})),null,2));
        throw error;
      }
      await page.getByRole("listbox").waitFor({state:"detached"});
    };
    for (const [model, counts] of [
      ["google_omni", [[25, 16], [75, 50], [150, 100]]],
      ["wan_3_0", [[33, 16], [100, 50], [200, 100]]],
      ["seedance_2_5", [[16, 11], [50, 33], [100, 66]]],
      ["kling_3_0", [[66, 33], [200, 100], [400, 200]]],
      ["kling_4_0", [[33, 16], [100, 50], [200, 100]]],
    ]) {
      for (const index of [0, 1, 2]) {
        const card = page.locator("article").nth(index);
        await choose(card,model);
        const [hooks, full] = counts[index], text = await card.innerText();
        assert.ok(text.includes(`${hooks} video hooks, ${model === "google_omni" || model === "seedance_2_5" ? 4 : 3} seconds each`));
        assert.ok(text.includes(`or ${full} six-second videos`));
        assert.ok(text.includes(`${hooks} ${model === "google_omni" || model === "seedance_2_5" ? 4 : 3}-second hook videos each month`));
        assert.ok(text.includes(`${full} six-second videos each month`));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(out, `model-${model}-${viewport.width}.png`), fullPage: true });
    }
    // Each card's informational model selection is independent of its siblings.
    await choose(page.locator("article").first(),"google_omni");
    assert.match(await page.getByRole("combobox", { name: "Video model for Growth allowance" }).innerText(), /Kling 4.0/);
    const trigger = page.getByRole("combobox", {name:"Video model for Starter allowance"});
    await trigger.focus(); await trigger.press("ArrowDown");
    await page.getByRole("listbox").waitFor();
    await page.keyboard.press("End"); await page.keyboard.press("Enter");
    await page.getByRole("listbox").waitFor({state:"detached"});
    assert.match(await trigger.innerText(),/Kling 4.0/);
    await trigger.click(); await page.keyboard.press("Escape");
    await page.getByRole("listbox").waitFor({state:"detached"});
    assert.match(await trigger.innerText(),/Kling 4.0/);
    console.log("PASS keyboard/Escape",viewport);
    for (const index of [0,1,2]) await choose(page.locator("article").nth(index),"google_omni");
    await trigger.click();
    assert.match(await page.getByRole("option",{selected:true}).innerText(),/Omni Flash/);
    await page.waitForFunction(()=>{const menu=document.querySelector('[role="listbox"]');return menu&&Number(getComputedStyle(menu).opacity)>=0.99;});
    await page.screenshot({path:path.join(out,`picker-open-${viewport.width}.png`),fullPage:true,animations:"disabled"});
    if(viewport.width===390) await page.screenshot({path:path.join(out,"picker-preview-mobile.png"),clip:{x:24,y:240,width:342,height:265},animations:"disabled"});
    await page.keyboard.press("Escape");
    await page.getByRole("listbox").waitFor({state:"detached"});
    assert.equal(requests.length,modelRequestCount,"Model selection must not create a billing request");
    await page.screenshot({ path: path.join(out, `pricing-${viewport.width}.png`), fullPage: true });
    if (modelsOnly) {
      assert.equal(errors.length,0);
      results.push({viewport,status:"PASS",cases:"default Omni; all model counts; independent cards; keyboard; Escape; selection indicator; no overflow/billing effects"});
      await page.close(); continue;
    }
    const before = requests.length; mode = "failure";
    await button.evaluate(element => { element.click(); element.click(); });
    await page.getByRole("alert").waitFor();
    assert.equal(requests.length, before + 1, "Rapid clicks create one request");
    assert.deepEqual(requests.at(-1).body, { billingInterval: "yearly", planSlug: "startup" });
    assert.equal(await page.evaluate(() => window.requestedOwner), "fixture-owner");
    assert.equal(await button.isEnabled(), true);
    await page.screenshot({ path: path.join(out, `error-${viewport.width}.png`), fullPage: true });
    mode = "success"; await button.click(); await page.waitForURL("**/destination?**");
    assert.match(page.url(), /billingInterval=yearly&planSlug=startup/);
    for (const billing of ["monthly", "yearly"]) {
      await page.goto(`${origin}?billing=${billing}`); await page.getByRole("button", { name: "Get Starter for Starter plan", exact: true }).click(); await page.waitForURL("**/destination?**");
      assert.deepEqual(requests.at(-1).body, { billingInterval: billing, planSlug: "starter" });
    }
    assert.equal(errors.length, 0);
    results.push({ viewport, status: "PASS", cases: "prices/allowances, no overflow, duplicate click, owner, error/retry, exact product payload" });
    await page.close();
  }
  if (!modelsOnly) {
  // Real browser clocks exercise the actual 20s token and 30s response deadlines.
  for (const [failureMode, expectedRequests] of [["token-stall", 0], ["headers-stall", 1], ["body-stall", 1], ["invalid-json", 1], ["no-token", 0]]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mode = failureMode; const before = requests.length;
    await page.goto(`${origin}?mode=${failureMode}`);
    const button = page.getByRole("button", { name: "Get Startup for Startup plan", exact: true }); await button.click();
    const start = Date.now(); await page.getByRole("alert").waitFor({ timeout: 35000 });
    const elapsedMs = Date.now() - start;
    assert.equal(await button.isEnabled(), true);
    assert.equal(requests.length, before + expectedRequests);
    if (failureMode.includes("stall")) assert.match(await page.getByRole("alert").innerText(), /took too long/);
    assert(elapsedMs < 34000);
    results.push({ failureMode, elapsedMs, status: "PASS", requests: expectedRequests });
    await page.close();
  }
  for (const boundary of ["account-switch", "unmount"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mode = "delayed-success"; await page.goto(origin);
    const before = requests.length;
    const checkoutRequest = page.waitForRequest("**/api/billing/checkout");
    await page.getByRole("button", { name: "Get Startup for Startup plan", exact: true }).click();
    await checkoutRequest;
    if (boundary === "account-switch") await page.evaluate(() => window.setFixtureOwner("other-owner"));
    else await page.evaluate(() => window.unmountPricingFixture());
    await page.waitForTimeout(1000);
    assert(!page.url().includes("/destination"), "An abandoned checkout must not redirect later");
    assert.equal(requests.length, before + 1);
    if (boundary === "account-switch") assert.equal(await page.getByRole("button", { name: "Get Startup for Startup plan", exact: true }).isEnabled(), true);
    else assert.equal(await page.locator("article").count(), 0);
    results.push({ boundary, status: "PASS", lateRedirect: false });
    await page.close();
  }
  {
    const page = await browser.newPage(); mode = "success";
    await page.goto(origin + "?managed=1");
    await page.getByRole("button", { name: "Change plan for Startup plan", exact: true }).click();
    await page.waitForURL("**/destination?portal=true");
    assert.equal(requests.at(-1).url, "/api/billing/portal");
    assert.equal(requests.at(-1).body, null);
    results.push({ managed: "existing subscription portal", status: "PASS" }); await page.close();
  }
  }
  write("results.json", JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
} finally {
  await browser?.close(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve));
}
