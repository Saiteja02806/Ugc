// Actual scheduling and preference components; isolated HTTP fixtures cannot publish.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/explore-schedule-review-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, value) => fs.writeFileSync(path.join(out, name), value);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("auth.ts", "export const getCurrentUserIdToken=async()=> 'local-review';");
file("timezone.ts", "export const useAccountTimeZone=()=> 'Asia/Calcutta';");
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {ScheduleEditor} from '@/components/scheduling/schedule-editor';import {PublishingPreferencesSettings} from '@/components/settings/publishing-preferences-settings';
const params=new URLSearchParams(location.search),manual=params.get('mode')==='manual';
const final={id:'00000000-0000-4000-8000-000000000010',sourceType:'combined_video',status:'ready',title:'Finished Explore video',mediaUrl:'/video.mp4'};
const hook={...final,id:'00000000-0000-4000-8000-000000000011',sourceType:'user_video',title:'Original hook',durationLabel:'8s'};
const accounts=['instagram','tiktok','youtube'].map((platform,index)=>({id:'account-'+platform,platform,status:'connected',platformAccountName:'Local '+platform,platformAccountUsername:'fixture',scopes:platform==='instagram'?['instagram_business_content_publish']:platform==='tiktok'?['video.publish']:['https://www.googleapis.com/auth/youtube.upload'],supportsBackgroundRefresh:true}));
const selected=(params.get('platforms')??'instagram').split(',');
createRoot(document.getElementById('root')).render(params.get('mode')==='preferences'?<PublishingPreferencesSettings/>:<ScheduleEditor finalVideo={manual?undefined:final} demoMediaOptions={[final,{...final,id:'unrelated',title:'Another video'}]} hookMediaOptions={manual?[hook]:[]} editingIsCombinedVideo={false} editingPlannedPlatforms={[]} editingSchedule={null} editingScheduledDate={null} editingScheduledTime={null} errorMessage={null} initialClipSelection={manual?'hook_and_secondary':'secondary_only'} initialDemoMediaId={final.id} initialHookMediaId={manual?hook.id:''} initialCaption='Local review: one finished video' initialPlannedTargets={accounts.filter(account=>selected.includes(account.platform)).map(account=>({platform:account.platform,connectionId:account.id,settings:{}}))} initialScheduledDate='2026-12-01' initialScheduledTime='10:30' minimumScheduleLeadMinutes={5} requireScheduleTarget saving={false} socialConnections={accounts} tiktokBetaEnabled youtubeBetaEnabled onClose={()=>{}} onRefreshMedia={async()=>true} onRefreshConnections={async()=>true} onSave={value=>{window.__submission=value;}}/>);`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@/lib/firebase/auth": path.join(out, "auth.ts"), "@/components/providers/account-timezone-provider": path.join(out, "timezone.ts"), "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  let preferences = { containsSyntheticMedia: false }, preferenceDelay = 0, preferenceFailure = false;
  const writes = [], errors = [];
  const cssDir = path.join(root, ".next/static/chunks");
  const css = fs.readdirSync(cssDir).filter(name => name.endsWith(".css")).map(name => fs.readFileSync(path.join(cssDir, name), "utf8")).join("\n");
  const json = (res, body) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://fixture");
    if (url.pathname === "/") { res.setHeader("Content-Type", "text/html"); return res.end('<html class="dark"><head><link rel="stylesheet" href="/style.css"/><style>body{margin:0;font-family:Arial;background:#101312;color:white}</style></head><body><div id="root"></div><script>window.process={env:{}}</script><script src="/bundle.js"></script></body></html>'); }
    if (url.pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(fs.readFileSync(path.join(out, "bundle.js"))); }
    if (url.pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(css); }
    if (url.pathname === "/video.mp4") { res.setHeader("Content-Type", "video/mp4"); return res.end(fs.readFileSync(path.join(root, "public/explore/covers/hook-video-v1.mp4"))); }
    if (url.pathname.startsWith("/api/")) assert.equal(req.headers.authorization, "Bearer local-review");
    if (url.pathname === "/api/account/publishing-preferences") {
      if (req.method === "PUT") { let body=""; for await (const chunk of req) body+=chunk; preferences=JSON.parse(body); writes.push(preferences); }
      if (preferenceDelay) await new Promise(resolve => setTimeout(resolve, preferenceDelay));
      if (preferenceFailure) { res.statusCode=503; return json(res,{ok:false}); }
      return json(res,{ok:true,preferences});
    }
    if (url.pathname.endsWith("/publish-settings")) return json(res,{ok:true,capabilities:{privacyLevels:['PUBLIC_TO_EVERYONE','SELF_ONLY'],directPostAudited:true,maxVideoDurationSeconds:600,creatorUsername:'fixture',interactions:{commentsDisabled:false,duetsDisabled:false,stitchesDisabled:false}}});
    res.statusCode=404; res.end();
  });
  const serving = process.argv.includes("--serve");
  await new Promise(resolve => server.listen(serving ? 3107 : 0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  if (serving) { console.log(`LOCAL_REVIEW_PREVIEW ${base}/ (fixture media and accounts; no publishing)`); return; }
  let browser;
  try { browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) }); }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(base);
    await page.getByRole("button", { name: "Schedule post", exact: true }).waitFor();
    assert.equal(await page.getByRole("heading", { name: "Final video", exact: true }).count(), 1);
    assert.equal(await page.getByText("Hook clip", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Secondary clip", { exact: true }).count(), 0);
    assert.equal(await page.locator("video").count(), 1);
    await page.waitForFunction(() => document.querySelector("video")?.readyState >= 3);
    await page.locator("video").evaluate(video => video.play());
    await page.waitForFunction(() => document.querySelector("video")?.currentTime > .2);
    await page.locator("video").evaluate(video => video.pause());
    assert.equal(await page.getByText("Show on profile grid", { exact: true }).isVisible(), false);
    await page.screenshot({ path: path.join(out, "final-video-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "Schedule post", exact: true }).click();
    const submitted = await page.evaluate(() => window.__submission);
    assert.equal(submitted.scheduledSource.id, "00000000-0000-4000-8000-000000000010");
    assert.equal(submitted.openingMedia, null); assert.equal(submitted.clipSelection, "secondary_only");
    assert.equal(submitted.targets[0].settings.shareToFeed, true); assert.equal(writes.length, 0);
    console.log("PASS Explore review shows one fixed playable output and submits that exact asset; optional placement collapsed");

    await page.goto(base + "/?platforms=tiktok");
    const visibility = page.getByRole("combobox", { name: /^Visibility/ });
    await visibility.waitFor(); assert.equal(await visibility.inputValue(), "");
    assert.equal(await page.getByRole("checkbox", { name: "Comments", exact: true }).isChecked(), false);
    assert.equal(await page.getByRole("button", { name: "Review publishing settings", exact: true }).isDisabled(), true);
    await page.getByText("AI content disclosure · Off", { exact: true }).click();
    await page.getByRole("checkbox", { name: /^Contains AI-generated content/ }).check();
    await visibility.selectOption("PUBLIC_TO_EVERYONE");
    await page.getByRole("checkbox", { name: "Comments", exact: true }).check();
    await page.getByRole("button", { name: "Schedule post", exact: true }).click();
    const tiktok = await page.evaluate(() => window.__submission.targets[0].settings);
    assert.equal(tiktok.privacyLevel, "PUBLIC_TO_EVERYONE"); assert.equal(tiktok.allowComment, true);
    assert.equal(tiktok.allowDuet, false); assert.equal(tiktok.containsSyntheticMedia, true);
    assert.equal(writes.length, 0, "Per-post changes must not overwrite account defaults");
    console.log("PASS TikTok requires an explicit visibility, opt-in interactions and preserves per-post disclosure override");

    preferenceDelay = 1200;
    await page.goto(base + "/?platforms=tiktok");
    await page.getByText("AI content disclosure · On", { exact: true }).click();
    const disclosure = page.getByRole("checkbox", { name: /^Contains AI-generated content/ });
    await disclosure.uncheck(); await disclosure.check();
    await page.waitForResponse(response => response.url().endsWith("publishing-preferences"));
    assert.equal(await disclosure.isChecked(), true, "An arriving preference cannot overwrite an explicit post edit");
    preferenceDelay = 0;

    await page.goto(base + "/?mode=preferences");
    const setting = page.getByRole("checkbox", { name: "Contains AI-generated content by default", exact: true });
    await page.waitForFunction(() => !document.querySelector('input[type="checkbox"]')?.disabled);
    assert.equal(await setting.isChecked(), false); await setting.check();
    await page.getByRole("button", { name: "Save publishing default", exact: true }).click();
    await page.getByText("Publishing default saved for your account.", { exact: true }).waitFor();
    await page.reload(); await page.waitForFunction(() => !document.querySelector('input[type="checkbox"]')?.disabled);
    assert.equal(await setting.isChecked(), true); assert.deepEqual(writes, [{containsSyntheticMedia:true}]);
    console.log("PASS account preference saves, restores and does not overwrite explicit per-post edits");

    await page.goto(base + "/?mode=manual");
    await page.getByText("Hook clip", { exact: true }).first().waitFor();
    assert.ok(await page.getByText("Secondary clip", { exact: true }).count() >= 1);
    await page.getByRole("button", { name: "Schedule post", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__submission.clipSelection), "hook_and_secondary");
    console.log("PASS ordinary scheduler retains its two-clip composition flow");

    await page.setViewportSize({width:390,height:844}); await page.goto(base);
    await page.getByRole("button", { name: "Schedule post", exact: true }).waitFor();
    assert.equal(await page.locator("video").count(),1);
    await page.waitForFunction(() => document.querySelector("video")?.readyState >= 3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:path.join(out,"final-video-mobile.png"),fullPage:true});
    preferenceFailure=true; await page.goto(base + "/?platforms=tiktok");
    await page.getByText(/Your account default could not load/).waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS mobile review has no horizontal overflow; failed preference lookup is explained");
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
