import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Actual SettingsWorkspace and next/dynamic; only account services, router and
// deferred section bodies are substituted. No real account requests or writes.
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); }
catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".tmp/settings-lazy/browser");
mkdirSync(out, { recursive: true });
const write = (name, value) => { writeFileSync(path.join(out, name), value); return path.join(out, name); };
const auth = write("auth.tsx", `import {useSyncExternalStore} from 'react';let user={uid:'owner-a',displayName:'Owner A',email:'owner-a@example.test',emailVerified:true,providerIds:['password']};window.changeSettingsOwner=next=>{user=next;window.dispatchEvent(new Event('settings-auth'))};export function useAuth(){const current=useSyncExternalStore(cb=>{window.addEventListener('settings-auth',cb);return()=>window.removeEventListener('settings-auth',cb)},()=>user);return {user:current,signOut:async()=>{window.fixture.signOuts++}}}`);
const navigation = write("navigation.ts", `export const useRouter=()=>({push:url=>window.fixture.routes.push(url),replace:url=>window.fixture.routes.push(url)});`);
const theme = write("theme.tsx", `import {useState} from 'react';export function useTheme(){const [theme,setTheme]=useState('light');return {theme,setTheme,locked:false}}`);
const aliases = {
  "@/contexts/auth-context": auth,
  "@/components/providers/theme-provider": theme,
  "next/navigation": navigation,
  "next/link": write("link.tsx", `export default function Link({children,href,...props}){return <a href={href} {...props}>{children}</a>}`),
  "@/lib/firebase/auth": write("token.ts", `export async function getCurrentUserIdToken(){throw Error('No live token allowed')}`),
  "@/components/billing/use-billing-subscription": write("billing.ts", `export function useBillingSubscription(){return {data:{isActive:true,displayName:'Pro',trial:{status:'inactive'}}}}`),
  "@/lib/social/platform-visibility": write("tiktok.ts", `export const hasTikTokUiAccess=()=>window.fixture.beta;`),
  "@/lib/social/youtube-beta-access": write("youtube.ts", `export const hasYouTubeBetaAccess=()=>window.fixture.beta;`),
};
const panels = [
  ["settings/instagram-account-manager", "InstagramAccountManager"], ["settings/tiktok-beta-account-manager", "TikTokBetaAccountManager"],
  ["settings/youtube-beta-account-manager", "YouTubeBetaAccountManager"], ["settings/app-screenshots-settings", "AppScreenshotsSettings"],
  ["media/media-library-dialog", "MediaLibraryPanel"], ["settings/business-context-settings", "BusinessContextSettings"],
  ["settings/publishing-preferences-settings", "PublishingPreferencesSettings"], ["settings/support-feedback-settings", "SupportFeedbackSettings"],
];
for (const [module, name] of panels) aliases[`@/components/${module}`] = write(`panel-${name}.tsx`, `import {useAuth} from '@/contexts/auth-context';window.fixture.loaded.push('${name}');export function ${name}({type}){const {user}=useAuth();return <div data-panel='${name}'><p>${name} {type} {user?.uid??'signed-out'}</p><input aria-label='${name} draft' defaultValue=''/></div>}`);
write("entry.tsx", `import {createRoot} from 'react-dom/client';import {SettingsWorkspace} from '@/components/settings/settings-workspace';window.fixture={loaded:[],routes:[],signOuts:0,beta:new URLSearchParams(location.search).get('beta')==='1'};createRoot(document.getElementById('root')).render(<SettingsWorkspace/>);`);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
const { webpack } = require("next/dist/compiled/webpack/webpack");
await new Promise((resolve, reject) => {
  const compiler = webpack({ mode: "development", target: "web", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "entry.js", chunkFilename: "chunks/[name].js", publicPath: "/" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs"), exclude: /node_modules/ }] } });
  compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? Error(stats.toString({ all: false, errors: true }))) : resolve()));
});
const globals = readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') + '\n@source "../components/settings/settings-workspace.tsx";\n@source "../components/ui";';
write("fixture.css", (await postcss([tailwind({ base: root })]).process(globals, { from: path.join(root, "app/globals.css") })).css);
const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/entry.js"></script></body></html>';
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://fixture").pathname;
  if (pathname === "/") { res.setHeader("Content-Type", "text/html"); res.end(html); return; }
  const file = path.resolve(out, `.${pathname}`);
  if (!file.startsWith(out + path.sep) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", file.endsWith(".css") ? "text/css" : "text/javascript"); res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser; const errors = [], checks = [];
try {
  browser = await pw.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 500 });
    const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    const chunkRequests = []; page.on("request", request => { if (request.url().includes("/chunks/")) chunkRequests.push(request.url()); });
    const nav = label => page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: label, exact: true });
    await page.goto(origin); await page.getByRole("heading", { name: "Account", exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.fixture.loaded), []); assert.equal(chunkRequests.length, 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, `account-${viewport.width}.png`) });
    await nav("Business Context").click(); await page.locator('[data-panel="BusinessContextSettings"]').waitFor();
    assert.deepEqual(await page.evaluate(() => window.fixture.loaded), ["BusinessContextSettings"]);
    await page.getByLabel("BusinessContextSettings draft").fill("local edit");
    await nav("Account").click(); await page.goBack(); await page.locator('[data-panel="BusinessContextSettings"]').waitFor();
    assert.equal(await page.getByLabel("BusinessContextSettings draft").inputValue(), "", "existing unmount-on-switch form semantics remain intact");
    await page.evaluate(() => { location.hash = "media-library"; }); await page.locator('[data-panel="MediaLibraryPanel"]').waitFor();
    assert.equal(await page.locator('[data-panel="BusinessContextSettings"]').count(), 0);
    await nav("Connected accounts").click(); await page.locator('[data-panel="InstagramAccountManager"]').waitFor();
    assert.equal(await page.locator('[data-panel="TikTokBetaAccountManager"]').count(), 0);
    assert.equal(await page.locator('[data-panel="YouTubeBetaAccountManager"]').count(), 0);
    assert.equal(await page.evaluate(() => window.fixture.loaded.some(name => /TikTok|YouTube/.test(name))), false);
    await nav("Preferences").click(); await page.locator('[data-panel="PublishingPreferencesSettings"]').waitFor();
    await page.getByRole("button", { name: "Use dark theme", exact: true }).click(); await page.getByRole("button", { name: "Use light theme", exact: true }).waitFor();
    await nav("App screenshots").click(); await page.locator('[data-panel="AppScreenshotsSettings"]').waitFor();
    await nav("Raise Ticket").click(); await page.locator('[data-panel="SupportFeedbackSettings"]').waitFor(); assert.match(await page.locator('[data-panel="SupportFeedbackSettings"]').innerText(), /support_ticket/);
    await nav("Request Feature").click(); assert.match(await page.locator('[data-panel="SupportFeedbackSettings"]').innerText(), /feature_request/);
    await page.evaluate(() => window.changeSettingsOwner({ uid: "owner-b", email: "owner-b@example.test", emailVerified: true }));
    await page.getByText("SupportFeedbackSettings feature_request owner-b", { exact: true }).waitFor();
    await nav("Account").click(); await page.getByText("owner-b@example.test", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Close settings", exact: true }).click(); assert.deepEqual(await page.evaluate(() => window.fixture.routes), ["/dashboard"]);
    await page.getByRole("button", { name: "Sign out", exact: true }).first().click(); await page.waitForFunction(() => window.fixture.routes.includes('/sign-in')); assert.equal(await page.evaluate(() => window.fixture.signOuts), 1);
    await page.goto(origin + "?fresh=screenshots#app-screenshots"); await page.locator('[data-panel="AppScreenshotsSettings"]').waitFor(); assert.deepEqual(await page.evaluate(() => window.fixture.loaded), ["AppScreenshotsSettings"]);
    await page.goto(origin + "?beta=1#instagram-publishing"); await page.locator('[data-panel="YouTubeBetaAccountManager"]').waitFor(); assert.deepEqual((await page.evaluate(() => window.fixture.loaded)).sort(), ["InstagramAccountManager", "TikTokBetaAccountManager", "YouTubeBetaAccountManager"].sort());
    // Hold a real async chunk in flight, switch away, then let it finish.
    await page.goto(origin); let release;
    await page.route("**/chunks/**", async route => { await new Promise(resolve => { release = resolve; }); await route.continue(); });
    await nav("Business Context").click(); await page.getByRole("status").waitFor();
    await nav("Account").click(); assert.ok(release); release(); await page.unrouteAll({ behavior: "wait" }); await page.waitForLoadState("networkidle");
    assert.equal(await page.locator('[data-panel="BusinessContextSettings"]').count(), 0); await page.getByRole("heading", { name: "Account", exact: true }).waitFor();
    checks.push(`${viewport.width}px: no initial section chunks, selection-only loads, direct hash/back, provider gates, form lifecycle, owner change, theme/close/sign-out, late async resolution`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  write("receipt.json", JSON.stringify({ checks, errors, limitations: "Actual Settings shell/dynamic module lifecycle; stubbed account services and section bodies. Desktop Edge with mobile viewport/touch; no hosted acceptance." }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
