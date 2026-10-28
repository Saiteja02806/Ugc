/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-component browser verification. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { webpack } = require("next/dist/compiled/webpack/webpack");
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }

const root = path.resolve(__dirname, ".."), out = path.join(root, ".tmp/character-reference-browser");
fs.mkdirSync(out, { recursive: true });
const file = (name, content) => fs.writeFileSync(path.join(out, name), content);
file("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
file("css-loader.cjs", `module.exports=source=>'const style=document.createElement("style");style.textContent='+JSON.stringify(source)+';document.head.append(style);export default '+JSON.stringify(Object.fromEntries([...source.matchAll(/\\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m=>[m[1],m[1]])))+';';`);
file("auth.tsx", `export const useAuth=()=>({user:{uid:'fixture-owner'},loading:false});`);
file("token.ts", `export const getCurrentUserIdToken=async owner=>{if(owner!=='fixture-owner')throw new Error('Account changed');return 'fixture-token';};`);
file("next.tsx", `export default function Element({href,src,alt,children}){return href?<a href={href}>{children}</a>:<img src={src} alt={alt}/>;}`);
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {CharacterWorkspace} from '@/components/characters/character-workspace';const client=new QueryClient({defaultOptions:{queries:{retry:false}}});const root=createRoot(document.getElementById('root'));window.fixtureNavigate=active=>root.render(<QueryClientProvider client={client}>{active?<CharacterWorkspace/>:<p>Explore fixture</p>}</QueryClientProvider>);window.fixtureNavigate(true);`);

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const requests = [], selections = [], uploads = [], receipts = new Map(), assets = new Map();
const generated = new Map();
let mode = "hold-upload", releaseUpload, base;
let reachedUpload;
const uploadReached = new Promise(resolve => { reachedUpload = resolve; });
const uuid = () => require("node:crypto").randomUUID();
const readBody = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString()); };

async function main() {
  const { CHARACTER_PROMPT_SKILLS, composeCharacterPrompt, resolveCharacterPromptSkills } = await import("../lib/characters/prompt-skills.ts");
  console.log("Preparing influencer browser fixture…");
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
        "@/contexts/auth-context": path.join(out, "auth.tsx"), "@/lib/firebase/auth": path.join(out, "token.ts"),
        "next/image": path.join(out, "next.tsx"), "next/link": path.join(out, "next.tsx"), "@": root,
      } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css-loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  console.log("Components bundled; compiling fixture styles…");
  const styleSource = fs.readFileSync(path.join(root, "app/globals.css"), "utf8")
    .replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "../components/characters";\n@source "../components/generation";\n@source "../components/ui";');
  const css = (await require("postcss")([require("@tailwindcss/postcss")({ base: root })])
    .process(styleSource, { from: path.join(root, "app/globals.css") })).css;
  console.log("Fixture assets compiled; opening browser…");
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, base || "http://fixture.test");
    const json = (body, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
    if (url.pathname === "/bundle.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); res.end(fs.readFileSync(path.join(out, "bundle.js"))); return; }
    if (url.pathname === "/style.css") { res.writeHead(200, { "Content-Type": "text/css" }); res.end(css); return; }
    if (url.pathname.endsWith(".png") || url.pathname.endsWith(".webp")) { res.writeHead(200, { "Content-Type": "image/webp" }); res.end(fs.readFileSync(path.join(root, "public/explore/characters/creator-office-v2.webp"))); return; }
    if (url.pathname.startsWith("/api/")) assert.equal(req.headers.authorization, "Bearer fixture-token");
    if (url.pathname === "/api/characters/access") { json({ ok: true, access: { affordableImageCount: 3, creditsRemaining: 20, imageCreditCost: 1, isPaid: true } }); return; }
    if (url.pathname === "/api/characters") { json({ ok: true, characters: [...generated.values()].map(job => ({ id: job.output.mediaAssetId, url: job.output.url, name: "My AI influencer", prompt: job.prompt, sourceJobId: job.id })) }); return; }
    if (url.pathname === "/api/characters/history") { json({ ok: true, images: [...generated.values()].map(job => ({ jobId: job.id, generationId: job.output.generationId, mediaAssetId: job.output.mediaAssetId, url: job.output.url, createdAt: new Date().toISOString(), prompt: job.skills?.length ? job.prompt : "Generated influencer", displayPrompt: job.displayPrompt, skills: job.skills, saved: true, model: "gpt_image" })), nextCursor: null }); return; }
    if (url.pathname === "/api/characters/select") {
      const body = await readBody(req); selections.push(body);
      assert.deepEqual(Object.keys(body), ["jobId"]);
      const job = generated.get(body.jobId); assert.ok(job?.output);
      json({ ok: true, character: { id: job.output.mediaAssetId, url: job.output.url, name: "My AI influencer", sourceJobId: job.id } }); return;
    }
    if (url.pathname === "/api/media/create-upload-url") {
      const body = await readBody(req); uploads.push(body);
      if (mode === "upload-error") { json({ ok: false, error: "Reference storage unavailable" }, 503); return; }
      const id = uuid(); assets.set(id, { id, collection: "image", status: "uploading", url: `${base}/reference.png` });
      json({ ok: true, assetId: id, key: `uploaded/${id}.png`, uploadUrl: `${base}/put/${id}`, requiredHeaders: { "Content-Type": "image/png" } }); return;
    }
    if (url.pathname.startsWith("/put/")) { for await (const chunk of req) assert.ok(chunk.length); res.writeHead(200); res.end(); return; }
    if (url.pathname === "/api/media/complete-upload") {
      const body = await readBody(req);
      if (mode === "hold-upload") await new Promise(resolve => { releaseUpload = resolve; reachedUpload(); });
      const asset = { ...assets.get(body.assetId), status: "ready", width: body.width, height: body.height, ratio: body.ratio };
      assets.set(asset.id, asset); json({ ok: true, asset }); return;
    }
    if (url.pathname === "/api/characters/generate") {
      const body = await readBody(req); requests.push(body);
      if (body.referenceImageAssetIds) assert.ok(body.referenceImageAssetIds.length > 1 && body.referenceImageAssetIds.every(id => assets.has(id)));
      else if (body.referenceImageAssetId) assert.ok(assets.has(body.referenceImageAssetId));
      const savedIds = body.referenceCharacterIds ?? (body.referenceCharacterId ? [body.referenceCharacterId] : []);
      assert.ok(savedIds.every(id => [...generated.values()].some(job => job.output.mediaAssetId === id)));
      assert.ok(savedIds.length || body.referenceImageAssetIds?.length || body.referenceImageAssetId);
      assert.equal(body.referenceImageUrl, undefined);
      let receipt = receipts.get(body.idempotencyKey);
      if (!receipt) { receipt = { ok: true, requestedCount: 1, partial: false, jobs: [{ jobId: uuid(), generationId: uuid() }] }; receipts.set(body.idempotencyKey, receipt); }
      if (mode === "uncertain") { json({ ok: false, message: "Could not confirm this request" }, 503); return; }
      json(receipt, 202); return;
    }
    if (url.pathname === "/api/characters/status") {
      const id = url.searchParams.get("jobId");
      if (mode === "pending-output") { json({ ok: true, job: { id, status: "processing", model: "gpt_image", isTerminal: false } }); return; }
      const submitted = requests.find(body => receipts.get(body.idempotencyKey)?.jobs.some(job => job.jobId === id));
      if (!generated.has(id)) generated.set(id, { id, status: "completed", model: "gpt_image", isTerminal: true,
        prompt: submitted ? composeCharacterPrompt(submitted.prompt, resolveCharacterPromptSkills(submitted.skillIds)) : null,
        ...(submitted?.skillIds?.length ? { displayPrompt: submitted.prompt, skills: resolveCharacterPromptSkills(submitted.skillIds).map(({ id, name }) => ({ id, name })) } : {}), batchId: submitted ? receipts.get(submitted.idempotencyKey).jobs[0].jobId : null,
        output: { url: `${base}/generated.png`, mediaAssetId: uuid(), generationId: uuid(), ratio: "9:16" } });
      json({ ok: true, job: generated.get(id) }); return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end('<!doctype html><html class="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"/><style>body{margin:0;font-family:Arial;background:var(--background);color:var(--foreground)}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    page.setDefaultTimeout(20_000);
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.clock.install();
    await page.goto(base);
    console.log("Checking uploads and continuous generation…");
    const prompt = page.getByRole("textbox", { name: "Describe your AI influencer" });
    const input = page.locator('input[type="file"]');
    await prompt.fill("Give me an influencer image in a similar style to this reference.");
    await input.setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: png });
    await uploadReached;
    assert.equal(await page.getByRole("button", { name: "Generate", exact: true }).isDisabled(), true);
    await prompt.press("Enter"); assert.equal(requests.length, 0);
    // A second paste while the first is uploading must queue, then append.
    await prompt.evaluate((target, data) => {
      const transfer = new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], "second.png", { type: "image/png" }));
      target.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }));
    }, png.toString("base64"));
    mode = "success"; releaseUpload(); releaseUpload = null;
    await page.getByRole("button", { name: "Preview Ref 1: reference image 1", exact: true }).waitFor();
    await page.getByRole("button", { name: "Preview Ref 2: reference image 2", exact: true }).waitFor();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByRole("button", { name: /Enlarge influencer image/ }).last().waitFor();
    assert.equal(await page.getByRole("button", { name: "New session", exact: true }).count(), 0);
    assert.deepEqual(requests[0].referenceImageAssetIds, [...assets.keys()].slice(0, 2));
    assert.equal(requests[0].prompt, "Give me an influencer image in a similar style to this reference.");

    // Real clipboard and drag/drop events bubble from the prompt to its form.
    for (const event of ["paste", "drop"]) {
      await prompt.fill("Use this attached image as a style reference.");
      await prompt.evaluate((target, { event, data }) => {
        const transfer = new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], "reference.png", { type: "image/png" }));
        target.dispatchEvent(event === "paste" ? new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }) : new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
      }, { event, data: png.toString("base64") });
      await page.getByRole("button", { name: `Preview Ref ${event === "paste" ? 3 : 4}: reference image ${event === "paste" ? 3 : 4}`, exact: true }).waitFor();
      await page.getByRole("button", { name: "Generate", exact: true }).click();
      const expected = event === "paste" ? 2 : 3;
      await page.getByRole("button", { name: `Enlarge influencer image ${expected}`, exact: true }).waitFor();
    }
    assert.equal(requests.length, 3);
    assert.deepEqual(requests.map(body => body.referenceImageAssetIds.length), [2, 3, 4]);
    assert.deepEqual(requests[2].referenceImageAssetIds.slice(0, 3), requests[1].referenceImageAssetIds);
    console.log("Checking submitted prompts remain separate from drafts and image controls stay below the composer…");
    assert.equal(await page.getByRole("button", { name: "Copy prompt", exact: true }).count(), 3, "identical prompts from different submissions retain their own batches");
    assert.equal(await page.locator("details").count(), 0);
    await prompt.fill("This is an unsent draft, not the prompt used for these images.");
    const submittedText = page.getByRole("button", { name: "Copy prompt", exact: true }).locator("..").locator("p");
    assert.deepEqual(await submittedText.allTextContents(), requests.map(body => body.prompt));
    const promptLayout = await page.getByRole("button", { name: "Copy prompt", exact: true }).first().locator("..").evaluate(element => {
      const image = element.parentElement.nextElementSibling.querySelector("article").getBoundingClientRect();
      const row = element.getBoundingClientRect(), text = element.querySelector("p");
      return { widthDifference: Math.abs(row.width - image.width), leftDifference: Math.abs(row.left - image.left), textHeight: text.clientHeight };
    });
    assert.ok(promptLayout.widthDifference < 1 && promptLayout.leftDifference < 1 && promptLayout.textHeight > 21, "prompt wraps over multiple lines within the image width");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy prompt", exact: true }).first().click();
    await page.getByRole("status").filter({ hasText: "Prompt copied" }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), requests[0].prompt);
    await page.clock.runFor(2_001);
    await page.getByRole("button", { name: "Copy prompt", exact: true }).first().blur();
    await page.screenshot({ path: path.join(out, "submitted-prompt-desktop.png"), fullPage: false });
    const checkRail = async () => {
      const layout = await page.getByRole("region", { name: "Generated influencer images" }).evaluate(rail => {
        const cards = [...rail.querySelectorAll("article")].map(card => card.getBoundingClientRect());
        return { overflowX: getComputedStyle(rail).overflowX, overflowY: getComputedStyle(rail).overflowY,
          scrollable: rail.scrollWidth > rail.clientWidth, tops: cards.map(card => card.top), widths: cards.map(card => card.width),
          pageFits: document.documentElement.scrollWidth <= innerWidth };
      });
      assert.equal(layout.overflowX, "auto"); assert.equal(layout.overflowY, "hidden");
      assert.equal(new Set(layout.tops).size, 1); assert.equal(new Set(layout.widths).size, 1);
      assert.equal(layout.pageFits, true);
      return layout;
    };
    await checkRail();
    await page.getByRole("button", { name: "Enlarge influencer image 1", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.screenshot({ path: path.join(out, "lightbox-desktop.png"), fullPage: true });
    await page.keyboard.press("Escape"); await page.clock.runFor(200);
    await page.screenshot({ path: path.join(out, "rail-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal((await checkRail()).scrollable, true);
    await page.screenshot({ path: path.join(out, "rail-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Enlarge influencer image 1", exact: true }).click();
    const lightbox = page.getByRole("dialog");
    await lightbox.waitFor();
    assert.equal(await lightbox.locator("img").getAttribute("src"), [...generated.values()][0].output.url);
    await page.screenshot({ path: path.join(out, "lightbox-mobile.png"), fullPage: true });
    await lightbox.getByRole("button", { name: "Next image", exact: true }).click();
    assert.equal(await lightbox.getByRole("heading").textContent(), "Influencer image 2");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await lightbox.getByRole("heading").textContent(), "Influencer image 1");
    await page.keyboard.press("Escape"); await page.clock.runFor(200);
    await lightbox.waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("button", { name: "Select influencer image 1", exact: true }).getAttribute("aria-pressed"), "false");
    await page.getByRole("button", { name: "Enlarge influencer image 1", exact: true }).click();
    await lightbox.getByRole("button", { name: "Close", exact: true }).click();
    await page.clock.runFor(200); await lightbox.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Enlarge influencer image 1", exact: true }).click();
    await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 2, y: 2 } });
    await page.clock.runFor(200); await lightbox.waitFor({ state: "hidden" });
    await page.screenshot({ path: path.join(out, "pasted-references-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.getByRole("button", { name: "Remove reference image 2", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: /Preview Ref \d: reference image \d/, exact: false }).count(), 3);
    console.log("PASS rapid/serial clipboard pastes and drops append all image IDs; individual removal and mobile fit");
    await page.getByRole("button", { name: "Clear references", exact: true }).click();
    console.log("Checking image hover stays on the app controls and selection stays in the workspace…");
    const firstCandidate = page.getByRole("button", { name: "Select influencer image 1", exact: true });
    await firstCandidate.scrollIntoViewIfNeeded();
    await page.clock.runFor(100);
    const controlAtImage = async locator => locator.locator("img").evaluate(img => {
      const rect = img.getBoundingClientRect();
      return { pointerEvents: getComputedStyle(img).pointerEvents,
        control: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest("button")?.getAttribute("aria-label") };
    });
    assert.deepEqual(await controlAtImage(firstCandidate), { pointerEvents: "none", control: "Select influencer image 1" });
    await firstCandidate.hover();
    await firstCandidate.click({ position: { x: 40, y: 40 } });
    await page.clock.runFor(100);
    await page.getByRole("button", { name: "Preview Identity: influencer reference" }).waitFor();
    assert.equal(await firstCandidate.getAttribute("aria-pressed"), "true");
    assert.equal(page.url(), `${base}/`); assert.equal(page.context().pages().length, 1);
    await page.getByRole("button", { name: "Remove influencer reference", exact: true }).click();
    await page.clock.runFor(100);
    assert.equal(await firstCandidate.getAttribute("aria-pressed"), "false");
    await firstCandidate.focus();
    await firstCandidate.press("Enter");
    await page.clock.runFor(100);
    await page.getByRole("button", { name: "Preview Identity: influencer reference" }).waitFor();
    assert.equal(await firstCandidate.getAttribute("aria-pressed"), "true", "keyboard activation keeps image selection accessible");
    await page.getByRole("button", { name: "Remove influencer reference", exact: true }).click();
    console.log("Checking saved gallery and idle rollover…");
    assert.equal(await page.getByRole("article", { name: /Influencer candidate/ }).count(), 3);
    await page.getByRole("button", { name: "My influencers", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Select saved image/ }).first().waitFor();
    assert.equal(await page.getByRole("dialog").getByRole("button", { name: /Select saved image/ }).count(), 3);
    assert.equal(await page.getByRole("dialog").locator("img").first().evaluate(img => getComputedStyle(img).pointerEvents), "none");
    await page.screenshot({ path: path.join(out, "library-desktop.png"), fullPage: true });
    await page.getByRole("dialog").getByRole("button", { name: /Select saved image/ }).first().click();
    await page.getByRole("button", { name: "Use 1 image as references", exact: true }).click();
    await page.getByRole("button", { name: "Preview Identity: influencer reference" }).waitFor();
    assert.equal(await page.getByText("Keeping this identity", { exact: false }).count(), 0);
    const identityBounds = await page.getByRole("button", { name: "Preview Identity: influencer reference" }).boundingBox();
    const plusBounds = await page.getByRole("button", { name: "Add reference image", exact: true }).boundingBox();
    assert.ok(identityBounds.x < plusBounds.x && Math.abs(identityBounds.y - plusBounds.y) < 12, "identity thumbnail sits beside the plus control");
    await prompt.fill("Change the outfit while keeping this identity.");
    const glow = await page.locator('form[data-layout="unified"]').evaluate(form => getComputedStyle(form).boxShadow);
    assert.ok(glow === "none" || [...glow.matchAll(/(-?[\d.]+)px/g)].every(match => Number(match[1]) === 0), "focused composer has no visible shadow or ring");
    await page.screenshot({ path: path.join(out, "identity-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "identity-mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.getByRole("button", { name: "Remove influencer reference", exact: true }).click();
    await page.clock.fastForward("10:01");
    await page.getByText("Your creator starts here.", { exact: true }).waitFor();
    assert.equal(await prompt.inputValue(), "");
    assert.equal(await page.getByRole("button", { name: /Preview Ref \d: reference image \d/ }).count(), 0);
    await page.getByRole("button", { name: "My influencers", exact: true }).click();
    assert.equal(await page.getByRole("dialog").getByRole("button", { name: /Select saved image/ }).count(), 3);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    mode = "upload-error";
    await prompt.fill("Make an influencer in this style.");
    await input.setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: png });
    await page.getByText("Reference storage unavailable", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Generate", exact: true }).isDisabled(), true);
    await prompt.press("Enter"); assert.equal(requests.length, 3);
    await page.getByRole("button", { name: "Remove failed reference", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Generate", exact: true }).isEnabled(), true);

    mode = "uncertain";
    await input.setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Preview Ref 1: reference image 1", exact: true }).waitFor();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByRole("button", { name: "Retry request", exact: true }).waitFor();
    const original = requests.at(-1);
    assert.equal(await input.isDisabled(), true);
    await page.reload();
    await page.getByRole("button", { name: "Retry request", exact: true }).waitFor();
    mode = "success";
    await page.getByRole("button", { name: "Retry request", exact: true }).click();
    await page.getByRole("button", { name: /Enlarge influencer image/ }).last().waitFor();
    assert.deepEqual(requests.at(-1), original); assert.equal(receipts.size, 4);
    await page.screenshot({ path: path.join(out, "desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "mobile.png"), fullPage: true });
    console.log("Checking completed image History after cached re-entry and reload…");
    await page.evaluate(() => window.fixtureNavigate(false));
    await page.getByText("Explore fixture", { exact: true }).waitFor();
    await page.evaluate(() => window.fixtureNavigate(true));
    await page.getByText("Your creator starts here.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("article", { name: /Influencer candidate/ }).count(), 0);
    await page.getByRole("button", { name: "Influencer image history", exact: true }).click();
    const historyImages = page.getByRole("dialog").getByRole("button", { name: /Generated influencer/ });
    await historyImages.first().waitFor();
    assert.equal(await historyImages.count(), 4);
    assert.equal(await historyImages.first().locator("img").evaluate(img => getComputedStyle(img).pointerEvents), "none");
    await historyImages.first().click();
    await page.getByText("Image from your character history.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Copy prompt", exact: true }).locator("..").locator("p").textContent(), "Generated influencer");
    assert.equal(await page.getByRole("article", { name: /Influencer candidate/ }).count(), 1);
    await page.getByRole("button", { name: "Back to session", exact: true }).click();
    await page.getByText("Your creator starts here.", { exact: true }).waitFor();
    await page.reload();
    await page.getByText("Your creator starts here.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Generate", exact: true }).waitFor();
    assert.equal(await page.getByRole("article", { name: /Influencer candidate/ }).count(), 0);
    await page.getByRole("button", { name: "Influencer image history", exact: true }).click();
    await historyImages.first().waitFor();
    assert.equal(await historyImages.count(), 4);
    assert.equal(requests.length, 5, "re-entry, History and reload never regenerate an image");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "history-after-reload-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    console.log("Checking multiple saved references, generation context, image downloads and workspace dismissal…");
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.getByRole("button", { name: "My influencers", exact: true }).click();
    const savedImages = page.getByRole("dialog").getByRole("button", { name: /Select saved image/ });
    await savedImages.nth(0).click(); await savedImages.nth(1).click();
    assert.equal(await savedImages.nth(0).getAttribute("aria-pressed"), "true");
    assert.equal(await savedImages.nth(1).getAttribute("aria-pressed"), "true");
    await page.screenshot({ path: path.join(out, "multi-select-library-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "Use 2 images as references", exact: true }).click();
    await page.getByRole("button", { name: "Preview Ref 1: influencer reference 1", exact: true }).waitFor();
    await page.getByRole("button", { name: "Preview Ref 2: influencer reference 2", exact: true }).waitFor();
    await prompt.fill("Use image 1 for the person and image 2 for the setting.");
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByRole("button", { name: /Enlarge influencer image/ }).last().waitFor();
    assert.deepEqual(requests.at(-1).referenceCharacterIds, [...generated.values()].slice(0, 2).map(job => job.output.mediaAssetId));
    assert.equal(requests.at(-1).referenceImageAssetId, undefined);
    await page.screenshot({ path: path.join(out, "multi-reference-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "multi-reference-mobile.png"), fullPage: true });
    await page.route("**/api/characters/*/download", route => {
      const url = new URL("https://storage.googleapis.com/fixture/image.png");
      url.searchParams.set("response-content-disposition", 'attachment; filename="my-influencer.png"');
      return route.fulfill({ json: { ok: true, url: url.href, fileName: "my-influencer.png" } });
    });
    await page.route("https://storage.googleapis.com/fixture/**", route => route.fulfill({ headers: { "Content-Type": "image/png", "Content-Disposition": 'attachment; filename="my-influencer.png"' }, body: png }));
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download image 1", exact: true }).click();
    assert.equal((await download).suggestedFilename(), "my-influencer.png");
    const savedCount = generated.size;
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5_000));
    await page.getByRole("button", { name: "Remove image 1 from workspace", exact: true }).click();
    await page.getByText("Your creator starts here.", { exact: true }).waitFor();
    assert.equal(await page.getByRole("article", { name: /Influencer candidate/ }).count(), 0);
    const removalNotice = page.getByRole("status").filter({ hasText: "Image removed from this workspace." });
    await removalNotice.waitFor();
    await page.screenshot({ path: path.join(out, "dismissible-notice-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Dismiss notification", exact: true }).click();
    assert.equal(await removalNotice.count(), 0, "the close control immediately dismisses the notice");
    const removeHistoryImage = async () => {
      await page.getByRole("button", { name: "Influencer image history", exact: true }).click();
      await historyImages.first().click();
      await page.clock.runFor(300); // Let the History dialog finish its exit animation.
      await page.getByRole("button", { name: "Remove image 1 from workspace", exact: true }).click();
      await removalNotice.waitFor();
    };
    await removeHistoryImage();
    await page.clock.runFor(2_000);
    await removeHistoryImage();
    await page.clock.runFor(2_999);
    assert.equal(await removalNotice.count(), 1, "repeating the same notice restarts its full three-second lifetime");
    await page.clock.runFor(1);
    assert.equal(await removalNotice.count(), 0, "the notice dismisses automatically after three seconds");
    await page.clock.resume();
    await page.getByRole("button", { name: "My influencers", exact: true }).click();
    assert.equal(await savedImages.count(), savedCount);
    await page.screenshot({ path: path.join(out, "multi-select-library-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Influencer image history", exact: true }).click();
    await historyImages.nth(savedCount - 1).waitFor();
    assert.equal(await historyImages.count(), savedCount);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Clear references", exact: true }).click();
    while (generated.size < 11) {
      const id = uuid();
      generated.set(id, { id, status: "completed", model: "gpt_image", isTerminal: true, output: { url: `${base}/generated.png`, mediaAssetId: uuid(), generationId: uuid(), ratio: "9:16" } });
    }
    await page.getByRole("button", { name: "My influencers", exact: true }).click();
    await savedImages.nth(10).waitFor();
    for (let index = 0; index < 10; index++) await savedImages.nth(index).click();
    assert.equal(await savedImages.nth(10).isDisabled(), true, "the gallery enforces the ten-reference limit");
    await page.getByRole("button", { name: "Use 10 images as references", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: /^Preview Ref \d+:/ }).count(), 10);
    assert.ok((await prompt.boundingBox()).width > 100, "reference thumbnails leave room for the prompt on mobile");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "ten-references-mobile.png"), fullPage: true });
    console.log("Checking multiple chooser uploads preserve My influencers references and the combined limit…");
    await page.getByRole("button", { name: "Clear references", exact: true }).click();
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.getByRole("button", { name: "My influencers", exact: true }).click();
    for (let index = 0; index < 3; index++) await savedImages.nth(index).click();
    await page.getByRole("button", { name: "Use 3 images as references", exact: true }).click();
    assert.equal(await input.getAttribute("multiple"), "");
    await input.setInputFiles([
      { name: "first.png", mimeType: "image/png", buffer: png },
      { name: "second.png", mimeType: "image/png", buffer: png },
    ]);
    await page.getByRole("button", { name: "Preview Ref 5: reference image 2", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: /^Preview Ref \d+: influencer reference/ }).count(), 3);
    const longPrompt = "Keep all three influencer references.\n" + "Use both uploaded images for the setting, lighting and wardrobe.\n".repeat(40);
    await prompt.fill(longPrompt);
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByRole("button", { name: /Enlarge influencer image/ }).last().waitFor();
    const mixedRequest = requests.at(-1);
    assert.equal(mixedRequest.referenceCharacterIds.length, 3);
    assert.equal(mixedRequest.referenceImageAssetIds.length, 2);
    const lastCopy = page.getByRole("button", { name: "Copy prompt", exact: true }).last();
    await lastCopy.click();
    await page.getByRole("status").filter({ hasText: "Prompt copied" }).waitFor();
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n"), longPrompt.trim(), "Copy preserves the whole multiline submitted prompt, allowing native Windows line endings");
    const assertFullPrompt = async () => {
      const promptBounds = await lastCopy.locator("..").evaluate(element => {
        const text = element.querySelector("p"), copy = element.querySelector("button");
        const textRect = text.getBoundingClientRect(), copyRect = copy.getBoundingClientRect();
        return { height: text.clientHeight, total: text.scrollHeight, maxHeight: getComputedStyle(text).maxHeight, overflow: getComputedStyle(text).overflowY,
          copyBesideText: copyRect.left >= textRect.right && Math.abs(copyRect.top - textRect.top) < 8 };
      });
      assert.ok(promptBounds.height <= 42 && promptBounds.total > promptBounds.height, "long prompt is clamped to two lines");
      assert.equal(promptBounds.overflow, "hidden");
      assert.equal(promptBounds.copyBesideText, true, "Copy stays beside the top of the prompt");
    };
    await assertFullPrompt();
    await page.screenshot({ path: path.join(out, "mixed-references-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await assertFullPrompt();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "mixed-references-mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "My influencers", exact: true }).click();
    for (let index = 3; index < 8; index++) await savedImages.nth(index).click();
    assert.equal(await savedImages.nth(8).isDisabled(), true, "eight saved plus two uploads fill the shared ten-image limit");
    await page.getByRole("button", { name: "Use 8 images as references", exact: true }).click();
    await page.clock.runFor(100);
    assert.equal(await page.getByRole("button", { name: /^Preview Ref \d+:/ }).count(), 10);
    assert.equal(await page.getByRole("button", { name: "Add reference image", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Remove reference image 1", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: /^Preview Ref \d+: influencer reference/ }).count(), 8);
    assert.equal(await page.getByRole("button", { name: "Add reference image", exact: true }).isEnabled(), true);
    await page.getByRole("button", { name: "Remove influencer reference 1", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: /^Preview Ref \d+: reference image/ }).count(), 1);
    await page.clock.runFor(2_001);
    await page.evaluate(() => {
      window.fixtureClipboardWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
      Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async () => { throw Error("Clipboard denied"); } });
    });
    await page.getByRole("button", { name: "Copy prompt", exact: true }).last().click();
    await page.getByRole("status").filter({ hasText: "Could not copy the prompt." }).waitFor();
    assert.equal(await page.getByRole("status").filter({ hasText: "Prompt copied" }).count(), 0, "clipboard denial does not claim a successful copy");
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: window.fixtureClipboardWriteText }));
    await page.getByRole("button", { name: "Dismiss notification", exact: true }).click();
    const railBeforePending = await page.getByRole("region", { name: "Generated influencer images" }).evaluate(rail => ({ height: rail.clientHeight, pageHeight: document.documentElement.scrollHeight, width: rail.scrollWidth }));
    mode = "pending-output";
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByText(/Creating candidate/).waitFor();
    const railPending = await page.getByRole("region", { name: "Generated influencer images" }).evaluate(rail => ({ height: rail.clientHeight, pageHeight: document.documentElement.scrollHeight, width: rail.scrollWidth }));
    assert.equal(railPending.height, railBeforePending.height, "appending a pending batch keeps the rail height");
    assert.equal(railPending.pageHeight, railBeforePending.pageHeight, "new generations do not grow the page vertically");
    assert.ok(railPending.width > railBeforePending.width, "new generation extends horizontally");
    await page.getByText(/Creating candidate/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, "pending-rail-mobile.png"), fullPage: true });
    mode = "success";
    await page.clock.runFor(10_000);
    await page.getByText(/Creating candidate/).waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("region", { name: "Generated influencer images" }).evaluate(rail => rail.clientHeight), railPending.height, "completed result retains placeholder geometry");
    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await touch.goto(base);
    await touch.getByRole("button", { name: "Influencer image history", exact: true }).click();
    await touch.getByRole("dialog").getByRole("button", { name: /Generated influencer/ }).first().click();
    await touch.locator('[data-slot="dialog-overlay"]').waitFor({ state: "hidden" });
    const expand = touch.getByRole("button", { name: "Enlarge influencer image 1", exact: true });
    await expand.waitFor();
    assert.equal(await expand.evaluate(button => getComputedStyle(button).opacity), "1", "touch devices always show expand");
    const expandBounds = await expand.evaluate(button => {
      const rect = button.getBoundingClientRect(), portrait = button.parentElement.querySelector('button[aria-label^="Select influencer"]').getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, portraitTop: portrait.top, portraitBottom: portrait.bottom, computedTop: getComputedStyle(button).top };
    });

    assert.ok(expandBounds.top >= expandBounds.portraitTop && expandBounds.bottom <= expandBounds.portraitBottom, "expand stays inside the image corner");
    assert.equal(await expand.evaluate(button => {
      const rect = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    }), true, "expand receives touch hits above the portrait");
    await touch.screenshot({ path: path.join(out, "touch-rail-mobile.png"), fullPage: true });
    await expand.click();
    await touch.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await touch.close();
    console.log("Checking prompt Skills and frozen result/history presentation…");
    const skin = CHARACTER_PROMPT_SKILLS[0];
    await page.setViewportSize({ width: 1100, height: 900 });
    await prompt.fill("An adult creator sitting by the window.");
    const authoredPrompt = await prompt.inputValue();
    await page.getByRole("button", { name: "Skills", exact: true }).click();
    const skillToggle = page.getByRole("checkbox", { name: "Realistic Skin", exact: true });
    await skillToggle.click();
    assert.equal(await skillToggle.getAttribute("aria-checked"), "true");
    assert.equal(await prompt.inputValue(), authoredPrompt);
    await page.screenshot({ path: path.join(out, "skills-picker-desktop.png"), fullPage: true, animations: "disabled" });
    await page.keyboard.press("Escape"); await page.clock.runFor(200);
    await page.getByRole("button", { name: "Remove Realistic Skin skill", exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, "skills-selected-desktop.png"), fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Skills (1)", exact: true }).click();
    await skillToggle.waitFor();
    await page.screenshot({ path: path.join(out, "skills-picker-mobile.png"), fullPage: true, animations: "disabled" });
    await page.keyboard.press("Escape"); await page.clock.runFor(200);
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Generate"]:disabled'));
    const skillRequest = requests.at(-1);
    assert.deepEqual(skillRequest.skillIds, ["realistic-skin"]);
    assert.equal(skillRequest.prompt, authoredPrompt);
    await page.getByRole("region", { name: "Generated influencer images" }).getByText(authoredPrompt, { exact: true }).waitFor();
    const skillCopy = page.getByRole("button", { name: "Copy prompt", exact: true }).last();
    assert.equal(await skillCopy.locator("..").locator("p").textContent(), authoredPrompt);
    assert.equal(await skillCopy.locator("..").getAttribute("title"), authoredPrompt);
    await skillCopy.click(); await page.clock.runFor(100);
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n"), composeCharacterPrompt(authoredPrompt, [skin]));
    assert.equal(await page.getByText(skin.instruction, { exact: true }).count(), 0, "raw skill instruction never renders in the UI");
    await page.getByRole("button", { name: "Remove Realistic Skin skill", exact: true }).click();
    assert.equal(await prompt.inputValue(), authoredPrompt);
    await page.screenshot({ path: path.join(out, "skills-result-mobile.png"), fullPage: true, animations: "disabled" });
    await page.reload();
    await page.getByRole("button", { name: "Influencer image history", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: /An adult creator sitting by the window/ }).click();
    await page.clock.runFor(200);
    const historyCopy = page.getByRole("button", { name: "Copy prompt", exact: true });
    assert.equal(await historyCopy.locator("..").locator("p").textContent(), authoredPrompt);
    await historyCopy.click(); await page.clock.runFor(100);
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n"), composeCharacterPrompt(authoredPrompt, [skin]));
    assert.equal(await page.getByRole("region", { name: "Generated influencer images" }).getByText("Realistic Skin", { exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "skills-history-mobile.png"), fullPage: true, animations: "disabled" });
    await page.getByRole("button", { name: "My influencers", exact: true }).click();
    const savedPromptIndex = [...generated.values()].findIndex(job => job.displayPrompt === authoredPrompt) + 1;
    assert.ok(savedPromptIndex > 0);
    const savedPromptCopy = page.getByRole("dialog").getByRole("button", { name: `Copy prompt for saved image ${savedPromptIndex}`, exact: true });
    await savedPromptCopy.waitFor();
    const beforeSelection = await page.getByRole("dialog").getByRole("button", { name: /Select saved image/ }).evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-pressed")));
    await savedPromptCopy.click(); await page.clock.runFor(100);
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n"), composeCharacterPrompt(authoredPrompt, [skin]));
    assert.equal(await savedPromptCopy.getAttribute("title"), "Copied");
    assert.deepEqual(await savedPromptCopy.locator("..").locator("button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label"))), [`Download saved image ${savedPromptIndex}`, `Copy prompt for saved image ${savedPromptIndex}`]);
    assert.deepEqual(await page.getByRole("dialog").getByRole("button", { name: /Select saved image/ }).evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-pressed"))), beforeSelection);
    assert.equal(await page.getByRole("dialog").getByText("My AI influencer", { exact: true }).count(), 0, "names are hidden from the card UI");
    const checkSavedFooter = async () => {
      assert.equal(await page.getByRole("dialog").locator(".savedCharacterCard").evaluateAll(cards => {
        const boxes = cards.map(card => card.getBoundingClientRect());
        return boxes.every((a, index) => boxes.slice(index + 1).every(b => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top));
      }), true, "saved cards and their footers never overlap adjacent rows");
      const geometry = await savedPromptCopy.evaluate(copy => {
        const footer = copy.parentElement, card = footer.parentElement;
        const image = card.querySelector('button[aria-label^="Select saved"]');
        const download = footer.querySelector('button[aria-label^="Download saved"]');
        const f = footer.getBoundingClientRect(), c = card.getBoundingClientRect(), i = image.getBoundingClientRect(), d = download.getBoundingClientRect(), p = copy.getBoundingClientRect();
        return { inside: f.left >= c.left && f.right <= c.right && f.bottom <= c.bottom,
          attached: Math.abs(f.top - i.bottom) < 2,
          sameRow: Math.abs(d.top - p.top) < 1,
          copyFits: p.right <= c.right && p.left >= c.left,
          labels: [download.textContent, copy.textContent] };
      });
      assert.equal(geometry.inside, true); assert.equal(geometry.attached, true);
      assert.equal(geometry.sameRow, true); assert.equal(geometry.copyFits, true);
      assert.deepEqual(geometry.labels.map(text => text.trim()), ["Download", "Copied"]);
    };
    await checkSavedFooter();
    await savedPromptCopy.locator("../..").evaluate(card => card.scrollIntoView({ block: "center" }));
    await page.clock.runFor(100);
    await savedPromptCopy.locator("../..").screenshot({ path: path.join(out, "library-copy-card-mobile.png"), animations: "disabled" });
    await page.screenshot({ path: path.join(out, "library-copy-mobile.png"), fullPage: true, animations: "disabled" });
    await page.clock.runFor(2_001);
    assert.equal(await savedPromptCopy.getAttribute("title"), "Copy prompt");
    await page.setViewportSize({ width: 1100, height: 900 });
    await savedPromptCopy.locator("../..").evaluate(card => card.scrollIntoView({ block: "center" }));
    await page.clock.runFor(100);
    await page.screenshot({ path: path.join(out, "library-copy-desktop.png"), fullPage: true, animations: "disabled" });
    await page.evaluate(() => {
      window.fixtureClipboardWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
      Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async () => { throw Error("Denied"); } });
    });
    await savedPromptCopy.click(); await page.clock.runFor(100);
    await page.getByRole("dialog").getByRole("alert").filter({ hasText: "Allow clipboard access" }).waitFor();
    assert.equal(await savedPromptCopy.getAttribute("title"), "Copy prompt");
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: window.fixtureClipboardWriteText }));
    await savedPromptCopy.click(); await page.clock.runFor(100);
    await checkSavedFooter();
    await page.screenshot({ path: path.join(out, "library-labelled-footer-desktop.png"), fullPage: true, animations: "disabled" });
    assert.equal(await page.getByRole("dialog").getByRole("alert").count(), 0);
    assert.equal(await page.getByRole("dialog").count(), 1, "copy keeps My influencers open");
    assert.deepEqual(errors, []);
    console.log("PASS: multiple references reach generation in order; image downloads save a file; workspace dismissal preserves My influencers and History; pointer/keyboard selection, upload/paste/drop, continuous generation, idle reset and uncertain-request recovery work; desktop and mobile fit.");
  } finally {
    releaseUpload?.();
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
