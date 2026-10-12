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
file("button.tsx", `export const Button=({size,variant,nativeButton,render,...props})=><button {...props}/>;`);
file("dialog.tsx", `export const Dialog=({open,children})=>open?<div>{children}</div>:null;export const DialogContent=({children})=><div>{children}</div>;export const DialogHeader=DialogContent;export const DialogTitle=DialogContent;export const DialogDescription=DialogContent;`);
file("history.tsx", `export const CharacterHistory=()=>null;`);
file("entry.tsx", `import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {CharacterWorkspace} from '@/components/characters/character-workspace';const client=new QueryClient({defaultOptions:{queries:{retry:false}}});createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><CharacterWorkspace/></QueryClientProvider>);`);

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const requests = [], uploads = [], receipts = new Map(), assets = new Map();
let mode = "hold-upload", releaseUpload, base;
let reachedUpload;
const uploadReached = new Promise(resolve => { reachedUpload = resolve; });
const uuid = () => require("node:crypto").randomUUID();
const readBody = async req => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString()); };

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "bundle.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
        "@/contexts/auth-context": path.join(out, "auth.tsx"), "@/lib/firebase/auth": path.join(out, "token.ts"),
        "@/components/ui/button": path.join(out, "button.tsx"), "@/components/ui/dialog": path.join(out, "dialog.tsx"),
        "./character-history": path.join(out, "history.tsx"), "next/image": path.join(out, "next.tsx"), "next/link": path.join(out, "next.tsx"), "@": root,
      } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }, { test: /\.css$/, use: path.join(out, "css-loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, base || "http://fixture.test");
    const json = (body, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
    if (url.pathname === "/bundle.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); res.end(fs.readFileSync(path.join(out, "bundle.js"))); return; }
    if (url.pathname.endsWith(".png") || url.pathname.endsWith(".webp")) { res.writeHead(200, { "Content-Type": "image/png" }); res.end(png); return; }
    if (url.pathname.startsWith("/api/")) assert.equal(req.headers.authorization, "Bearer fixture-token");
    if (url.pathname === "/api/characters/access") { json({ ok: true, access: { affordableImageCount: 3, creditsRemaining: 20, imageCreditCost: 1, isPaid: true } }); return; }
    if (url.pathname === "/api/characters") { json({ ok: true, characters: [] }); return; }
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
      assert.ok(assets.has(body.referenceImageAssetId));
      assert.equal(body.referenceImageUrl, undefined); assert.equal(body.referenceCharacterId, undefined);
      let receipt = receipts.get(body.idempotencyKey);
      if (!receipt) { receipt = { ok: true, requestedCount: 1, partial: false, jobs: [{ jobId: uuid(), generationId: uuid() }] }; receipts.set(body.idempotencyKey, receipt); }
      if (mode === "uncertain") { json({ ok: false, message: "Could not confirm this request" }, 503); return; }
      json(receipt, 202); return;
    }
    if (url.pathname === "/api/characters/status") {
      json({ ok: true, job: { id: url.searchParams.get("jobId"), status: "completed", isTerminal: true, output: { url: `${base}/generated.png`, mediaAssetId: uuid(), generationId: uuid(), ratio: "9:16" } } }); return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial;background:#f7f7f7;--background:#f7f7f7;--foreground:#222;--card:white;--border:#ddd;--primary:#444}button{cursor:pointer}button:disabled{cursor:default}textarea{box-sizing:border-box}svg{width:16px;height:16px}.hidden{display:none}.sr-only{position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden}.size-12{width:48px;height:48px}.size-full{width:100%;height:100%}.relative{position:relative}.absolute{position:absolute}.flex{display:flex}.flex-col{flex-direction:column}.gap-2{gap:8px}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(base);
    const prompt = page.getByRole("textbox", { name: "Describe your AI influencer" });
    const input = page.locator('input[type="file"]');
    await prompt.fill("Give me an influencer image in a similar style to this reference.");
    await input.setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: png });
    await uploadReached;
    assert.equal(await page.getByRole("button", { name: "Generate", exact: true }).isDisabled(), true);
    await prompt.press("Enter"); assert.equal(requests.length, 0);
    mode = "success"; releaseUpload(); releaseUpload = null;
    await page.getByRole("button", { name: "Preview Reference: reference image" }).waitFor();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByRole("button", { name: "New session", exact: true }).waitFor();
    assert.equal(requests[0].referenceImageAssetId, [...assets.keys()][0]);
    assert.equal(requests[0].prompt, "Give me an influencer image in a similar style to this reference.");
    await page.getByRole("button", { name: "New session", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Preview Reference: reference image" }).count(), 0);

    // Real clipboard and drag/drop events bubble from the prompt to its form.
    for (const event of ["paste", "drop"]) {
      await prompt.fill("Use this attached image as a style reference.");
      await prompt.evaluate((target, { event, data }) => {
        const transfer = new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], "reference.png", { type: "image/png" }));
        target.dispatchEvent(event === "paste" ? new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }) : new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
      }, { event, data: png.toString("base64") });
      await page.getByRole("button", { name: "Preview Reference: reference image" }).waitFor();
      await page.getByRole("button", { name: "Generate", exact: true }).click();
      await page.getByRole("button", { name: "New session", exact: true }).waitFor();
      await page.getByRole("button", { name: "New session", exact: true }).click();
    }
    assert.equal(requests.length, 3); assert.equal(new Set(requests.map(body => body.referenceImageAssetId)).size, 3);
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
    await page.getByRole("button", { name: "Preview Reference: reference image" }).waitFor();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    await page.getByRole("button", { name: "Retry request", exact: true }).waitFor();
    const original = requests.at(-1);
    assert.equal(await input.isDisabled(), true);
    await page.reload();
    await page.getByRole("button", { name: "Retry request", exact: true }).waitFor();
    mode = "success";
    await page.getByRole("button", { name: "Retry request", exact: true }).click();
    await page.getByRole("button", { name: "New session", exact: true }).waitFor();
    assert.deepEqual(requests.at(-1), original); assert.equal(receipts.size, 4);
    await page.screenshot({ path: path.join(out, "desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(out, "mobile.png"), fullPage: true });
    assert.deepEqual(errors, []);
    console.log("PASS: image upload/paste/drop reach character requests; pending/errors block generation; refresh retries the identical attached image and request key; mobile fits.");
  } finally {
    releaseUpload?.();
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
