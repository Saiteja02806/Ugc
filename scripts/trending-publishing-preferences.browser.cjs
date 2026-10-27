/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS browser test harness. */
// Real Settings and Trending components against local HTTP fixtures. No provider
// posts or production data writes are possible in this test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/trending-publishing-preferences-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, value) => fs.writeFileSync(path.join(out, name), value);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css-loader.cjs", `const fs=require('node:fs'),path=require('node:path');module.exports=function(s){const p='ui_'+path.basename(this.resourcePath).replace(/[^a-z]/gi,'_')+'_';const m={};s=s.replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,n)=>{m[n]=p+n;return '.'+p+n});fs.appendFileSync(${JSON.stringify(path.join(out,"modules.css"))},s+'\\n');return 'export default '+JSON.stringify(m)};`);
file("auth.ts", "export const getCurrentUserIdToken=async()=> 'local-preferences';");
file("context.ts", "export const useAuth=()=>({user:{uid:'local-owner',email:'verified@example.com',emailVerified:true}});");
file("timezone.ts", "export const useAccountTimeZone=()=> 'Asia/Calcutta';");
file("popup.ts", "export const useSocialOAuthPopup=()=>({clearPopupError(){},closePopup(){},startConnection(){throw new Error('OAuth disabled in local fixture');}});");
file("entry.tsx", `import {useState} from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {PlatformSelectionModal} from '@/components/social/platform-selection-modal';import {HookVideoScheduleDrawer} from '@/components/trending/hook-video-schedule-drawer';import {PublishingPreferencesSettings} from '@/components/settings/publishing-preferences-settings';
const client=new QueryClient(), mode=location.pathname==='/settings'?'preferences':new URLSearchParams(location.search).get('mode')??'modal';
function App(){const[open,setOpen]=useState(true);return mode==='preferences'?<PublishingPreferencesSettings/>:<><button onClick={()=>setOpen(true)}>Reopen publishing</button>{mode==='modal'?<PlatformSelectionModal open={open} onOpenChange={setOpen} context={{contentType:new URLSearchParams(location.search).get('content')==='video'?'reaction':'carousel',title:'Local slideshow',carouselId:'local-carousel',libraryItemId:'local-library',idempotencyKey:'local-only',returnTo:'trending'}} onConfirmed={async value=>{window.__submission=value;}}/>:open?<HookVideoScheduleDrawer summary={{demoTitle:'Local demo',hookText:'Local hook'}} onClose={()=>setOpen(false)} onConfirm={async value=>{window.__submission=value;setOpen(false);}}/>:null}</>}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><App/></QueryClientProvider>);`);

async function main() {
  file("modules.css", "");
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/firebase/auth": path.join(out, "auth.ts"), "@/contexts/auth-context": path.join(out, "context.ts"),
      "../firebase/auth": path.join(out, "auth.ts"),
      "@/components/providers/account-timezone-provider": path.join(out, "timezone.ts"),
      "@/components/social/use-social-oauth-popup": path.join(out, "popup.ts"), "@": root,
    } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css-loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const accounts = ["instagram", "tiktok", "youtube"].map((platform) => ({
    id: `account-${platform}`, platform, status: "connected", platformAccountId: `local-${platform}`,
    platformAccountName: `Local ${platform}`, platformAccountUsername: "fixture", supportsBackgroundRefresh: true,
    scopes: platform === "instagram" ? ["instagram_business_content_publish"] : platform === "tiktok" ? ["video.publish"] : ["https://www.googleapis.com/auth/youtube.upload"],
  }));
  const defaults = { containsSyntheticMedia: true, tiktokPrivacyLevel: "PUBLIC_TO_EVERYONE", tiktokAllowComments: true, tiktokBrandOrganic: false, youtubePrivacyStatus: "public", youtubeMadeForKids: false, youtubeNotifySubscribers: false };
  let preferences = { ...defaults }, holdPreferences = false, failure = false, commentsDisabled = false, capabilitiesFailure = false, directPostAudited = true;
  let privacyLevels = ["PUBLIC_TO_EVERYONE", "SELF_ONLY"];
  const pendingPreferences = [];
  const releasePreferences = () => { holdPreferences = false; pendingPreferences.splice(0).forEach(resolve => resolve()); };
  const writes = [], errors = [];
  const captionId = "00000000-0000-4000-8000-000000000001";
  const defaultCaption = "A saved caption from Trending.\n\n#BuildInPublic";
  let captions = { revision: 1, captions: [{ id: captionId, text: defaultCaption }], defaultId: captionId };
  const css = (await require("postcss")([require("@tailwindcss/postcss")({ base: root })])
    .process(fs.readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../components";'), { from: path.join(root, "app/globals.css") })).css;
  const json = (res, body) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://fixture");
    if (url.pathname === "/" || url.pathname === "/settings") { res.setHeader("Content-Type", "text/html"); return res.end('<html class="dark"><head><link rel="stylesheet" href="/style.css"/><style>body{margin:0;font-family:Arial;background:#101312;color:white}</style></head><body><div id="root"></div><script>window.process={env:{}}</script><script src="/bundle.js"></script></body></html>'); }
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(fs.readFileSync(path.join(out, "bundle.js"))); }
    if (url.pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(css + fs.readFileSync(path.join(out,"modules.css"),"utf8")); }
    if (url.pathname.startsWith("/api/")) assert.equal(req.headers.authorization, "Bearer local-preferences");
    if (url.pathname === "/api/account/saved-captions") {
      if (req.method === "PUT") { let body=""; for await (const chunk of req) body+=chunk; const next=JSON.parse(body); if(next.revision!==captions.revision){res.statusCode=409;return json(res,{ok:false,message:"Changed in another tab"});} captions={...next,revision:next.revision+1}; }
      return json(res,{ok:true,library:captions});
    }
    if (url.pathname === "/api/account/publishing-preferences") {
      if (req.method === "PUT") { let body = ""; for await (const chunk of req) body += chunk; preferences = { ...preferences, ...JSON.parse(body) }; writes.push({ ...preferences }); }
      else assert.equal(req.method, "GET");
      const result = { ...preferences };
      if (holdPreferences) await new Promise(resolve => pendingPreferences.push(resolve));
      if (failure) { res.statusCode = 503; return json(res, { ok: false }); }
      return json(res, { ok: true, preferences: result });
    }
    if (url.pathname === "/api/social/connections") return json(res, { ok: true, connections: accounts });
    if (url.pathname === "/api/schedules") return json(res, { ok: true, minimumScheduleLeadMinutes: 5, schedules: [] });
    if (url.pathname.endsWith("/publish-settings")) {
      if (capabilitiesFailure) { res.statusCode = 503; return json(res, { ok: false, message: "TikTok account settings unavailable." }); }
      return json(res, { ok: true, capabilities: {
      directPostAudited, privacyLevels, maxVideoDurationSeconds: 600, creatorUsername: "fixture",
      interactions: { commentsDisabled, duetsDisabled: false, stitchesDisabled: false },
      } });
    }
    res.statusCode = 404; res.end();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try { browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) }); }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  const page = await browser.newPage({ locale: "en-GB", viewport: { width: 1366, height: 680 } });
  page.on("pageerror", error => { errors.push(error.message); console.error("BROWSER_ERROR", error.message); });
  const disclosure = () => page.getByRole("checkbox", { name: "Contains AI-generated content", exact: true });
  async function selectTikTok(mode) {
    await page.getByRole("checkbox", { name: mode === "modal" ? /TikTok creator account/ : /Local tiktok/ }).check();
    if (mode === "modal") await page.getByRole("button", { name: "Next", exact: true }).click();
    assert.equal(await page.getByRole("combobox", { name: /Visibility|Audience/ }).count(), 0);
    assert.equal(await page.getByRole("checkbox", { name: "Allow comments", exact: true }).count(), 0);
    const link = page.getByRole("link", { name: "Change default settings", exact: true });
    assert.equal(await link.getAttribute("href"), "/settings#preferences");
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.equal(await disclosure().count(), 0);
  }
  const next = mode => page.getByRole("button", { name: mode === "modal" ? "Next" : "Review", exact: true });
  const ready = () => page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(button => ['Next','Review'].includes(button.textContent.trim()))?.disabled);
  async function submit(mode) {
    if (mode === "modal") {
      await next(mode).click();
      await page.getByRole("button", { name: /^Post now/ }).click();
    } else {
      await next(mode).click();
      await page.getByRole("button", { name: "Post now", exact: true }).click();
    }
    await page.waitForFunction(() => window.__submission);
    return page.evaluate(() => window.__submission.targets[0].settings);
  }
  try {
    await page.goto(base + "/?mode=preferences");
    const setting = page.getByRole("checkbox", { name: "Contains AI-generated content by default", exact: true });
    await setting.waitFor();
    await page.waitForFunction(() => !document.querySelector('input[type="checkbox"]')?.disabled);
    assert.equal(await setting.isChecked(), true);
    const tiktokDefaults = page.getByRole("group", { name: "TikTok defaults", exact: true });
    const tiktokVisibility = tiktokDefaults.getByRole("combobox", { name: "Visibility", exact: true });
    assert.equal(await tiktokVisibility.inputValue(), "PUBLIC_TO_EVERYONE");
    assert.equal(await tiktokDefaults.getByRole("checkbox", { name: "Allow comments", exact: true }).isChecked(), true);
    const promotional = tiktokDefaults.getByRole("checkbox", { name: "Label posts as promotional content", exact: true });
    assert.equal(await promotional.isChecked(), false);
    const visibility = page.getByRole("group", { name: "YouTube defaults", exact: true }).getByRole("combobox", { name: "Visibility", exact: true });
    assert.equal(await visibility.inputValue(), "public");
    assert.equal(await page.getByRole("checkbox", { name: "Made for kids", exact: true }).isChecked(), false);
    await setting.uncheck();
    await tiktokVisibility.selectOption("SELF_ONLY");
    await tiktokDefaults.getByRole("checkbox", { name: "Allow comments", exact: true }).uncheck();
    await promotional.check();
    await visibility.selectOption("unlisted");
    await page.getByRole("checkbox", { name: "Notify subscribers", exact: true }).check();
    await page.getByRole("button", { name: "Save publishing defaults", exact: true }).click();
    await page.getByText("Publishing defaults saved for your account.", { exact: true }).waitFor();
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('input[type="checkbox"]')?.disabled);
    assert.equal(await setting.isChecked(), false);
    assert.equal(await visibility.inputValue(), "unlisted");
    assert.equal(await tiktokVisibility.inputValue(), "SELF_ONLY");
    assert.equal(await tiktokDefaults.getByRole("checkbox", { name: "Allow comments", exact: true }).isChecked(), false);
    assert.equal(await promotional.isChecked(), true);
    assert.deepEqual(writes, [{ ...defaults, containsSyntheticMedia: false, tiktokPrivacyLevel: "SELF_ONLY", tiktokAllowComments: false, tiktokBrandOrganic: true, youtubePrivacyStatus: "unlisted", youtubeNotifySubscribers: true }]);
    await page.screenshot({ path: path.join(out, "settings-defaults.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "settings-promotional-mobile.png"), fullPage: true });
    await promotional.uncheck();
    await page.getByRole("button", { name: "Save publishing defaults", exact: true }).click();
    await page.getByText("Publishing defaults saved for your account.", { exact: true }).waitFor();
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('input[type="checkbox"]')?.disabled);
    assert.equal(await promotional.isChecked(), false);
    await page.setViewportSize({ width: 1366, height: 680 });
    await page.screenshot({ path: path.join(out, "settings-promotional-off-desktop.png"), fullPage: true });
    console.log("PASS Settings defaults promotional disclosure off, saves/restores on and off, keeps AI disclosure separate and fits mobile");

    for (const mode of ["modal", "drawer"]) {
      const writesBeforePublishing = writes.length;
      preferences = { ...defaults, containsSyntheticMedia: false, tiktokPrivacyLevel: "SELF_ONLY", tiktokAllowComments: false };
      holdPreferences = true;
      await page.goto(base + "/?mode=" + mode);
      await selectTikTok(mode);
      assert.equal(await next(mode).isDisabled(), true);
      await page.getByRole("status").filter({ hasText: /Loading your publishing defaults/ }).waitFor({ state: "attached" });
      releasePreferences();
      await ready();
      assert.equal(await disclosure().count(), 0);
      const caption = page.getByRole("textbox", { name: "Post caption" });
      await page.waitForFunction(expected => document.querySelector('textarea[name="caption"]')?.value === expected, defaultCaption);
      await caption.fill("Saved from " + mode + "\n\n#UGCPilot");
      await page.getByRole("button", { name: "Save caption", exact: true }).click();
      await page.getByText("Caption saved.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Clear post caption", exact: true }).click();
      assert.equal(await caption.inputValue(), "");
      await page.getByRole("button", { name: /Saved captions/ }).click();
      await page.getByRole("button", { name: "Use caption", exact: true }).first().click();
      assert.equal(await caption.inputValue(), defaultCaption);
      await page.getByRole("heading", { name: "Saved captions", exact: true }).waitFor({state:"hidden"});
      await page.screenshot({ path: path.join(out, mode + "-1366x680.png"), fullPage: true });
      const settings = await submit(mode);
      assert.equal(await page.evaluate(() => window.__submission.caption), defaultCaption);
      assert.equal(settings.containsSyntheticMedia, false);
      assert.equal(settings.privacyLevel, "SELF_ONLY");
      assert.equal(settings.allowComment, false);
      assert.equal(settings.brandOrganic, false);
      assert.equal(settings.brandedContent, false);
      console.log("PASS " + mode + " waits for saved defaults and submits them without per-post questions");

      await page.setViewportSize({ width: 390, height: 844 });
      preferences = { ...defaults };
      holdPreferences = true;
      await page.goto(base + "/?mode=" + mode);
      await selectTikTok(mode);
      const read = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("publishing-preferences"));
      releasePreferences();
      await read;
      await ready();
      assert.equal(await disclosure().count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(out, mode + "-390x844.png"), fullPage: true });
      const initial = await submit(mode);
      assert.equal(initial.containsSyntheticMedia, true);
      assert.equal(initial.privacyLevel, "PUBLIC_TO_EVERYONE");
      assert.equal(initial.allowComment, true);
      assert.equal(initial.brandOrganic, false, "AI disclosure must not enable promotional labeling");
      assert.equal(writes.length, writesBeforePublishing, "Publishing must not overwrite account defaults");
      console.log("PASS " + mode + " uses Everyone/comments-on defaults with no questions or horizontal overflow on mobile");

      preferences = { ...defaults, containsSyntheticMedia: false, youtubePrivacyStatus: "unlisted", youtubeNotifySubscribers: true };
      await page.setViewportSize({ width: 1366, height: 780 });
      await page.goto(base + "/?mode=" + mode + "&content=video");
      await page.getByRole("checkbox", { name: mode === "modal" ? /YouTube channel/ : /Local youtube/ }).check();
      if (mode === "modal") await next(mode).click();
      await ready();
      assert.equal(await disclosure().count(), 0);
      assert.equal(await page.getByRole("combobox", { name: /^Visibility|^Channel visibility/ }).count(), 0);
      const youtube = await submit(mode);
      assert.equal(youtube.privacyStatus, "unlisted");
      assert.equal(youtube.containsSyntheticMedia, false);
      assert.equal(youtube.madeForKids, false);
      assert.equal(youtube.notifySubscribers, true);
      console.log("PASS " + mode + " uses saved YouTube defaults without per-post questions");

      preferences = { ...defaults };
      await page.goto(base + "/?mode=" + mode);
      await selectTikTok(mode);
      await ready();
      await page.getByRole("textbox", { name: /Caption/i }).fill("Keep this caption while changing defaults");
      const popupPromise = page.waitForEvent("popup");
      await page.getByRole("link", { name: "Change default settings", exact: true }).click();
      const popup = await popupPromise;
      popup.on("pageerror", error => errors.push(error.message));
      await popup.waitForURL(base + "/settings#preferences");
      const popupTikTok = popup.getByRole("group", { name: "TikTok defaults", exact: true });
      await popup.waitForFunction(() => !document.querySelector('input[type="checkbox"]')?.disabled);
      await popupTikTok.getByRole("combobox", { name: "Visibility", exact: true }).selectOption("SELF_ONLY");
      await popupTikTok.getByRole("checkbox", { name: "Allow comments", exact: true }).uncheck();
      await popupTikTok.getByRole("checkbox", { name: "Label posts as promotional content", exact: true }).check();
      await popup.getByRole("button", { name: "Save publishing defaults", exact: true }).click();
      await popup.getByText("Publishing defaults saved for your account.", { exact: true }).waitFor();
      await popup.close();
      const refreshed = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("publishing-preferences"));
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await refreshed;
      await ready();
      assert.equal(await page.getByRole("textbox", { name: /Caption/i }).inputValue(), "Keep this caption while changing defaults");
      const updated = await submit(mode);
      assert.equal(updated.privacyLevel, "SELF_ONLY");
      assert.equal(updated.allowComment, false);
      assert.equal(updated.brandOrganic, true);
      assert.equal(updated.commercialContentDisclosureEnabled, true);
      assert.equal(updated.brandedContent, false);
      assert.equal(await page.evaluate(() => window.__submission.caption), "Keep this caption while changing defaults");
      console.log("PASS " + mode + " opens Settings Preferences and refreshes saved defaults without losing the caption");
    }

    preferences = { ...defaults };
    commentsDisabled = true;
    await page.goto(base + "/?mode=modal");
    await selectTikTok("modal");
    await ready();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    preferences = { ...defaults, containsSyntheticMedia: false };
    await page.getByRole("button", { name: "Reopen publishing", exact: true }).click();
    await selectTikTok("modal");
    await ready();
    const reopened = await submit("modal");
    assert.equal(reopened.containsSyntheticMedia, false);
    assert.equal(reopened.allowComment, false);
    assert.equal(preferences.tiktokAllowComments, true);
    console.log("PASS reopened publishing reloads defaults and respects disabled creator comments");
    commentsDisabled = false;

    for (const mode of ["modal", "drawer"]) {
      for (const restriction of ["unsupported", "unaudited"]) {
        preferences = { ...defaults };
        privacyLevels = restriction === "unsupported" ? ["SELF_ONLY"] : ["PUBLIC_TO_EVERYONE", "SELF_ONLY"];
        directPostAudited = restriction !== "unaudited";
        await page.goto(base + "/?mode=" + mode);
        await selectTikTok(mode);
        await page.getByText("Checking TikTok account settings…", { exact: true }).waitFor({ state: "hidden" });
        await page.waitForFunction(() => !document.body.textContent.includes("Loading your publishing defaults"));
        if (mode === "drawer") await next(mode).click();
        else assert.equal(await next(mode).isDisabled(), true);
        await page.getByRole("alert").filter({ hasText: /visibility|private test/i }).first().waitFor();
        assert.equal(await page.evaluate(() => window.__submission), undefined);
        preferences = { ...defaults, tiktokPrivacyLevel: "SELF_ONLY" };
        const refreshed = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("publishing-preferences"));
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await refreshed;
        await ready();
        assert.equal((await submit(mode)).privacyLevel, "SELF_ONLY");
        console.log("PASS " + mode + " blocks " + restriction + " public visibility until the saved default is changed");
      }
      directPostAudited = true;
      privacyLevels = ["PUBLIC_TO_EVERYONE", "SELF_ONLY"];
      capabilitiesFailure = true;
      await page.goto(base + "/?mode=" + mode);
      await selectTikTok(mode);
      await page.getByRole("button", { name: "Retry TikTok account", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__submission), undefined);
      capabilitiesFailure = false;
      await page.getByRole("button", { name: "Retry TikTok account", exact: true }).click();
      await page.getByText("Checking TikTok account settings…", { exact: true }).waitFor({ state: "hidden" });
      await ready();
      assert.equal((await submit(mode)).privacyLevel, "SELF_ONLY");
      console.log("PASS " + mode + " retries failed creator settings without showing per-post controls");
    }

    for (const mode of ["modal", "drawer"]) {
      failure = true;
      await page.goto(base + "/?mode=" + mode);
      await selectTikTok(mode);
      await page.getByText(/Your publishing defaults could not load/).first().waitFor();
      assert.equal(await next(mode).isDisabled(), true);
      assert.equal(await page.evaluate(() => window.__submission), undefined);
      failure = false;
      await page.getByRole("button", { name: "Retry loading defaults", exact: true }).click();
      await ready();
      assert.equal((await submit(mode)).privacyLevel, "SELF_ONLY");
      console.log("PASS " + mode + " blocks a failed default read and recovers through Retry");
    }
    for (const mode of ["modal","drawer"]) for (const width of [1366,390]) {
      await page.setViewportSize({width,height:844}); await page.goto(base+"/?mode="+mode);
      await selectTikTok(mode);await ready();
      if(mode==="modal") await next(mode).click();
      assert.equal(await page.getByRole("group",{name:"Publishing time",exact:true}).count(),0);
      assert.equal(await page.getByRole("button",{name:"Schedule for later",exact:true}).count(),0);
      const quick=page.getByRole("group",{name:"Quick publish times",exact:true});
      assert.deepEqual(await quick.getByRole("button").allTextContents(),["5 mins","1 hour","3 hours","Tomorrow 09:00"]);
      const tops=await quick.getByRole("button").evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().top));assert.ok(tops.every(top=>Math.abs(top-tops[0])<1));
      await page.getByRole("button",{name:/^Choose publish time, currently/}).click();
      assert.equal(await page.getByLabel("Hour",{exact:true}).locator("option").count(),24);
      assert.equal(await page.getByLabel("Minute",{exact:true}).locator("option").count(),60);
      for(const time of ["00:00","09:30","21:30","23:59"]) {
        await page.getByLabel("Hour",{exact:true}).selectOption(time.slice(0,2));await page.getByLabel("Minute",{exact:true}).selectOption(time.slice(3));
        assert.equal(await page.locator('input[name="postTime"]').inputValue(),time);
      }
      await page.getByLabel("Minute",{exact:true}).focus();await page.keyboard.press("ArrowUp");
      assert.equal(await page.locator('input[name="postTime"]').inputValue(),"23:58");
      await page.screenshot({path:path.join(out,mode+"-24-hour-"+width+".png"),fullPage:true});
      await page.getByRole("button",{name:"Done",exact:true}).click();
      assert.equal(await page.evaluate(()=>window.__submission),undefined);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

    }
    for(const mode of ["modal","drawer"])for(const width of [1366,390]) {
      const local=await browser.newPage({locale:"en-US",viewport:{width,height:844}});
      await local.goto(base+"/?mode="+mode);
      await local.getByRole("checkbox",{name:mode==="modal"?/TikTok creator account/:/Local tiktok/}).check();
      const forward=local.getByRole("button",{name:mode==="modal"?"Next":"Review",exact:true});
      await forward.waitFor();await local.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>['Next','Review'].includes(b.textContent.trim()))?.disabled);
      if(mode==="modal"){await forward.click();await forward.click();}
      await local.getByRole("button",{name:/^Choose publish time, currently/}).click();
      await local.getByLabel("AM/PM",{exact:true}).waitFor();
      assert.equal(await local.getByLabel("Hour",{exact:true}).locator('option').count(),12);
      await local.getByLabel("Hour",{exact:true}).selectOption("12");await local.getByLabel("Minute",{exact:true}).selectOption("00");
      await local.getByLabel("AM/PM",{exact:true}).selectOption("AM");assert.equal(await local.locator('input[name="postTime"]').inputValue(),"00:00");
      await local.getByLabel("AM/PM",{exact:true}).selectOption("PM");assert.equal(await local.locator('input[name="postTime"]').inputValue(),"12:00");
      await local.getByLabel("Hour",{exact:true}).selectOption("09");await local.getByLabel("Minute",{exact:true}).selectOption("30");assert.equal(await local.locator('input[name="postTime"]').inputValue(),"21:30");
      await local.screenshot({path:path.join(out,mode+"-device-12-hour-"+width+".png"),fullPage:true,animations:"disabled"});
      await local.getByRole("button",{name:"Done",exact:true}).click();await local.getByRole("button",{name:"Choose publish time, currently 9:30 PM",exact:true}).waitFor();
      assert.equal(await local.evaluate(()=>window.__submission),undefined);assert.ok(await local.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await local.close();
    }
    for (const mode of ["modal", "drawer"]) for (const width of [1366, 390]) for (const manual of [false, true]) {
      await page.clock.setFixedTime(new Date("2026-12-01T12:00:30Z"));
      await page.setViewportSize({ width, height: 844 }); await page.goto(base + "/?mode=" + mode);
      await selectTikTok(mode); await ready();
      await page.getByRole("textbox", { name: /Caption/i }).fill("Caption completed after choosing five minutes");
      if (mode === "modal") await next(mode).click();
      await page.getByRole("button", { name: "5 mins", exact: true }).click();
      if (manual) {
        await page.getByRole("button", { name: /^Choose publish time, currently/ }).click();
        await page.getByLabel("Hour", { exact: true }).selectOption("21");
        await page.getByLabel("Minute", { exact: true }).selectOption("30");
        await page.getByRole("button", { name: "Done", exact: true }).click();
      }
      await page.clock.setFixedTime(new Date("2026-12-01T12:20:30Z"));
      assert.equal(await page.evaluate(() => window.__submission), undefined);
      if (mode === "drawer") await next(mode).click();
      await page.getByRole("button", { name: mode === "modal" ? "Schedule post" : "Confirm schedule", exact: true }).click();
      await page.waitForFunction(() => window.__submission);
      const saved = await page.evaluate(() => window.__submission);
      assert.equal(saved.useDefaultScheduleTime, !manual);
      assert.equal(saved.scheduledTime, manual ? "21:30" : "17:56");
      assert.equal(saved.caption, "Caption completed after choosing five minutes");
      assert.equal(saved.targets[0].connectionId, "account-tiktok");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    console.log("PASS delayed five-minute final confirmation and exact manual override in both publishing surfaces on desktop/mobile");
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error("ORIGINAL_BROWSER_FAILURE", error);
    if (!page.isClosed()) {
      console.error("BROWSER_STATE", (await page.locator("body").innerText()).slice(0, 2500), errors);
      await page.screenshot({ path: path.join(out, "failed-check.png"), fullPage: true });
    }
    throw error;
  } finally { releasePreferences(); await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
