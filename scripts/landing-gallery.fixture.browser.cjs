/* eslint-disable @typescript-eslint/no-require-imports -- Local actual-component browser fixture. */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = path.resolve(__dirname, "..");
const out = path.join(root, ".tmp/landing-loop-browser");
fs.mkdirSync(out, { recursive: true });

async function main() {
  fs.writeFileSync(path.join(out, "loader.cjs"), `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
  fs.writeFileSync(path.join(out, "image.tsx"), `export default function Image({fill,sizes,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:undefined}/>}`);
  fs.writeFileSync(path.join(out, "entry.tsx"), `import {createRoot} from 'react-dom/client';import {LandingHeroGallery} from '@/components/marketing/landing-hero-gallery';createRoot(document.getElementById('gallery')).render(<LandingHeroGallery/>);`);
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root,
      entry: path.join(out, "entry.tsx"), output: { path: out, filename: "gallery.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": root, "next/image": path.join(out, "image.tsx") } },
      module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }] },
      plugins: [new webpack.DefinePlugin({ "process.env.NODE_ENV": JSON.stringify("development") })] });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const sources = ["components/marketing/landing-hero-gallery.tsx", "components/marketing/landing-preview-video.tsx", "scripts/landing-gallery.fixture.browser.cjs"]
    .map(file => `@source "${path.join(root, file).replaceAll("\\", "/")}";`).join("\n");
  const scopedCss = fs.readFileSync(path.join(root, "app/globals.css"), "utf8")
    .replace('@import "tailwindcss";', `@import "tailwindcss" source(none);\n${sources}`);
  const css = await require("postcss")([require("@tailwindcss/postcss")({ base: out })])
    .process(scopedCss, { from: path.join(root, "app/globals.css") });
  fs.writeFileSync(path.join(out, "style.css"), css.css);
  const html = `<!doctype html><html class="dark"><head><link rel="stylesheet" href="/style.css"><style>@font-face{font-family:Geist;src:url('/geist.woff2')}body{font-family:Geist,sans-serif;--font-geist-sans:Geist}</style></head><body><main class="instagram-theme min-h-screen overflow-x-hidden bg-background text-foreground"><header class="mx-auto flex h-20 max-w-[1200px] items-center justify-between px-4"><span class="font-semibold">UGCPilot</span><span class="text-sm text-muted">Guides　　Pricing　　Sign in</span></header><section class="px-4 pb-10 pt-16"><div class="relative mx-auto flex max-w-[1200px] flex-col items-center gap-12"><div class="w-full text-center"><p class="mb-7 text-sm text-primary">Made for social　 |　 Instagram　 TikTok　 YouTube</p><h1 class="text-[clamp(2.25rem,5.28vw,4.8rem)] font-semibold leading-[1.08] tracking-[-0.055em]">Find viral content.<br>Recreate for yours</h1><p class="mx-auto mt-7 max-w-[740px] text-lg leading-8 text-muted">Create an AI creator for your SaaS, make videos that show what it does, and review every asset in one studio.</p><div class="mt-8"><a class="inline-flex h-12 items-center rounded-full bg-primary px-7 font-semibold text-primary-foreground">Start Creating →</a><span class="ml-5 text-sm text-muted">See how it works ↓</span></div></div><div id="gallery" class="w-full"></div></div></section></main><script src="/gallery.js"></script></body></html>`;
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/") { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); return; }
    const file = pathname === "/geist.woff2" ? path.join(root, "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2")
      : path.join(pathname.startsWith("/marketing/") ? path.join(root, "public") : out, pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { response.statusCode = 404; response.end(); return; }
    const types = { ".css": "text/css", ".js": "text/javascript", ".mp4": "video/mp4", ".webp": "image/webp", ".woff2": "font/woff2" };
    response.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    let pw; try { pw = require("playwright"); } catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
    browser = await pw.chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage(); const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const { verifyLandingGallery } = await import("./landing-gallery.browser-checks.mjs");
    const receipt = await verifyLandingGallery(page, browser, `http://127.0.0.1:${server.address().port}`, out);
    if (errors.length) throw Error(JSON.stringify(errors));
    fs.writeFileSync(path.join(out, "receipt.json"), JSON.stringify({ ...receipt, pageErrors: errors, boundary: "Actual gallery, actual CSS; native image adapter and static hero shell; no Next.js server or authentication" }, null, 2));
    console.log(JSON.stringify({ ...receipt, output: out }));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
