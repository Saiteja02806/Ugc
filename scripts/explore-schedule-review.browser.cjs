/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS fixture runner. */
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
file("css.cjs", `const names={};module.exports=function(source){const css=source.replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,name)=>'.'+(names[name]='schedule_'+name));return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names)+';';};`);
file("auth.ts", "export const getCurrentUserIdToken=async()=> 'local-review';");
file("timezone.ts", "export const useAccountTimeZone=()=> 'Asia/Calcutta';");
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {ScheduleEditor} from '@/components/scheduling/schedule-editor';import {PublishingPreferencesSettings} from '@/components/settings/publishing-preferences-settings';
const params=new URLSearchParams(location.search),manual=params.get('mode')==='manual';
const final={id:'00000000-0000-4000-8000-000000000010',sourceType:'combined_video',status:'ready',title:'Finished Explore video',mediaUrl:'/video.mp4'};
const hook={...final,id:'00000000-0000-4000-8000-000000000011',sourceType:'user_video',title:'Original hook',durationLabel:'8s'};
const accounts=['instagram','tiktok','youtube'].map((platform,index)=>({id:'account-'+platform,platform,status:'connected',platformAccountName:'Local '+platform,platformAccountUsername:'fixture',scopes:platform==='instagram'?['instagram_business_content_publish']:platform==='tiktok'?['video.publish']:['https://www.googleapis.com/auth/youtube.upload'],supportsBackgroundRefresh:true}));
const selected=(params.get('platforms')??'instagram').split(',');
createRoot(document.getElementById('root')).render(params.get('mode')==='preferences'?<PublishingPreferencesSettings/>:<ScheduleEditor presentation={params.get('presentation')==='workflow'?'workflow':'modal'} finalVideo={manual?undefined:final} demoMediaOptions={[final,{...final,id:'unrelated',title:'Another video'}]} hookMediaOptions={manual?[hook]:[]} editingIsCombinedVideo={false} editingPlannedPlatforms={[]} editingSchedule={null} editingScheduledDate={null} editingScheduledTime={null} errorMessage={null} initialClipSelection={manual?undefined:'secondary_only'} initialDemoMediaId={final.id} initialHookMediaId={manual?hook.id:''} initialCaption='Local review: one finished video' initialPlannedTargets={accounts.filter(account=>selected.includes(account.platform)).map(account=>({platform:account.platform,connectionId:account.id,settings:{}}))} initialScheduledDate={params.get('date')??'2026-12-01'} initialScheduledTime={params.get('time')??'10:30'} minimumScheduleLeadMinutes={5} requireScheduleTarget saving={false} socialConnections={accounts} tiktokBetaEnabled youtubeBetaEnabled onClose={()=>{}} onRefreshMedia={async()=>true} onRefreshConnections={async()=>true} onUploadVideo={manual?async file=>({...final,id:'direct-upload',sourceType:'user_video',title:file.name}):undefined} onSave={value=>{window.__submission=value;document.body.dataset.fixtureSubmission=JSON.stringify(value);}}/>);`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@/lib/firebase/auth": path.join(out, "auth.ts"), "@/components/providers/account-timezone-provider": path.join(out, "timezone.ts"), "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  let preferences = { containsSyntheticMedia: false }, preferenceDelay = 0, preferenceFailure = false;
  const writes = [], errors = [];
  const css = (await require("postcss")([require("@tailwindcss/postcss")({ base: root })])
    .process(fs.readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../components";'), { from: path.join(root, "app/globals.css") })).css;
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
    await page.clock.setFixedTime(new Date("2026-10-14T09:10:30Z"));
    await page.goto(base + "/?presentation=workflow&date=2026-10-14&time=02:49");
    const timePicker = page.getByRole("button", { name: "Choose publish time, currently 02:49", exact: true });
    await timePicker.waitFor();
    assert.equal(await page.getByRole("button", { name: "Choose date and time", exact: true }).isDisabled(), true);
    assert.match(await page.locator("#schedule-clock-help").innerText(), /Now: 2026-10-14 14:40.*Asia\/Calcutta[\s\S]*Earliest: 2026-10-14 14:46/);
    await timePicker.click();
    assert.equal(await page.getByRole("group", { name: "AM/PM", exact: true }).count(), 0);
    await page.getByRole("group", { name: "Hour", exact: true }).getByRole("button", { name: "14", exact: true }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    assert.equal(await page.locator('input[name="scheduledTime"]').inputValue(), "14:49");
    assert.equal(await page.locator("#schedule-time-feedback").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Schedule post", exact: true }).isEnabled(), true);
    assert.equal(await page.evaluate(() => window.__submission), undefined);
    await page.getByRole("button", { name: "Schedule post", exact: true }).click();
    const afternoon = await page.evaluate(() => window.__submission);
    assert.equal(afternoon.scheduledTime, "14:49"); assert.equal(afternoon.scheduledFor, "2026-10-14T09:19:00.000Z");
    await page.screenshot({ path: path.join(out, "schedule-afternoon-corrected.png"), fullPage: true });
    console.log("PASS screenshot regression: 24-hour selection clears the warning and submits 14:49 IST at the correct UTC instant");

    await page.clock.setFixedTime(new Date("2026-10-14T18:27:30Z"));
    await page.goto(base + "/?presentation=workflow&date=2026-10-14&time=23:59");
    await page.getByRole("button", { name: "Use next available time", exact: true }).click();
    assert.equal(await page.locator('input[name="scheduledDate"]').inputValue(), "2026-10-15");
    assert.equal(await page.locator('input[name="scheduledTime"]').inputValue(), "00:04");
    assert.equal(await page.evaluate(() => window.__submission), undefined);
    assert.equal(await page.getByRole("button", { name: "Schedule post", exact: true }).isEnabled(), true);
    console.log("PASS next available time crosses midnight with a confirmation buffer and never submits automatically");
    await page.clock.setFixedTime(new Date("2026-10-14T09:10:30Z"));
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
    assert.equal(tiktok.brandOrganic, false);
    assert.equal(writes.length, 0, "Per-post changes must not overwrite account defaults");
    console.log("PASS TikTok requires an explicit visibility, opt-in interactions and preserves per-post disclosure override");

    preferenceDelay = 1200;
    await page.goto(base + "/?platforms=tiktok");
    await page.getByText("AI content disclosure · On", { exact: true }).click();
    const disclosure = page.getByRole("checkbox", { name: /^Contains AI-generated content/ });
    await disclosure.uncheck(); await disclosure.check();
    await page.waitForResponse(response => new URL(response.url()).pathname.endsWith("publishing-preferences"));
    assert.equal(await disclosure.isChecked(), true, "An arriving preference cannot overwrite an explicit post edit");
    preferenceDelay = 0;

    await page.goto(base + "/?mode=preferences");
    const setting = page.getByRole("checkbox", { name: "Contains AI-generated content by default", exact: true });
    await page.waitForFunction(() => !document.querySelector('input[type="checkbox"]')?.disabled);
    assert.equal(await setting.isChecked(), false); await setting.check();
    await page.getByRole("button", { name: "Save publishing defaults", exact: true }).click();
    await page.getByText("Publishing defaults saved for your account.", { exact: true }).waitFor();
    await page.reload(); await page.waitForFunction(() => !document.querySelector('input[type="checkbox"]')?.disabled);
    assert.equal(await setting.isChecked(), true); assert.deepEqual(writes, [{containsSyntheticMedia:true,tiktokPrivacyLevel:"PUBLIC_TO_EVERYONE",tiktokAllowComments:true,tiktokBrandOrganic:false,youtubePrivacyStatus:"public",youtubeMadeForKids:false,youtubeNotifySubscribers:false}]);
    console.log("PASS account preference saves, restores and does not overwrite explicit per-post edits");

    preferences = { ...preferences, tiktokBrandOrganic: true };
    await page.goto(base + "/?platforms=tiktok");
    await visibility.selectOption("PUBLIC_TO_EVERYONE");
    await page.getByRole("button", { name: "Schedule post", exact: true }).click();
    await page.waitForFunction(() => window.__submission);
    assert.equal(await page.evaluate(() => window.__submission.targets[0].settings.brandOrganic), true);
    assert.equal(await page.evaluate(() => window.__submission.targets[0].settings.brandedContent), false);
    preferences = { ...preferences, tiktokBrandOrganic: false };
    console.log("PASS scheduler applies the saved promotional preference independently from AI disclosure");

    await page.goto(base + "/?mode=manual");
    await page.getByText("Video clip", { exact: true }).waitFor();
    assert.equal(await page.getByText("Hook clip", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Secondary clip", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: /^Change selected video/ }).count(), 1);
    await page.getByRole("button", { name: /^Change selected video/ }).click();
    await page.getByRole("button", { name: /Original hook.*Choose/ }).click();
    await page.getByRole("button", { name: "Schedule post", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__submission.clipSelection), "secondary_only");
    assert.equal(await page.evaluate(() => window.__submission.scheduledSource.id), "00000000-0000-4000-8000-000000000011");
    assert.equal(await page.evaluate(() => window.__submission.useOpeningClip), false);
    await page.getByLabel("Upload video clip", { exact: true }).setInputFiles({ name: "Uploaded single clip.mp4", mimeType: "video/mp4", buffer: Buffer.from("fixture-upload") });
    await page.getByRole("button", { name: "Change selected video, currently Uploaded single clip.mp4", exact: true }).waitFor();
    await page.getByRole("button", { name: "Schedule post", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__submission.scheduledSource.id), "direct-upload");
    assert.equal(await page.evaluate(() => window.__submission.openingMedia), null);
    await page.screenshot({path:path.join(out,"single-video-scheduler-desktop.png"),fullPage:true});
    console.log("PASS ordinary scheduler chooses or uploads exactly one video and submits no opening clip");
    await page.setViewportSize({width:390,height:844}); await page.goto(base + "/?mode=manual");
    await page.getByText("Video clip", { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:path.join(out,"single-video-scheduler-mobile.png"),fullPage:true});

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
