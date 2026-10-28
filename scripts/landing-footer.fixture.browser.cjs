/* eslint-disable @typescript-eslint/no-require-imports -- Actual footer in isolated browser fixture. */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = path.resolve(__dirname, "..");
const out = path.join(root, ".tmp/landing-footer-browser");

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const home = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
  // Use the actual caller's existing arrays, including exact legal and social destinations.
  const arrays = home.slice(home.indexOf("const productFooterLinks"), home.indexOf("export default function Home"));
  fs.writeFileSync(path.join(out, "entry.tsx"), `import {createRoot} from 'react-dom/client';import {LandingFooter} from '@/components/marketing/landing-footer';const authHref='/sign-in';${arrays}createRoot(document.getElementById('root')).render(<LandingFooter legalLinks={legalFooterLinks} moreLinks={[...productFooterLinks,...supportFooterLinks.filter(link=>!link.external)]}/>);`);
  fs.writeFileSync(path.join(out, "loader.cjs"), `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(out, "entry.tsx"), output: { path: out, filename: "footer.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": root } }, module: { rules: [{ test: /\.tsx?$/, use: path.join(out, "loader.cjs") }] }, plugins: [new webpack.DefinePlugin({ "process.env.NODE_ENV": JSON.stringify("development") })] });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const sources = ["components/marketing/landing-footer.tsx", "scripts/landing-footer.fixture.browser.cjs"].map(file => `@source "${path.join(root, file).replaceAll("\\", "/")}";`).join("\n");
  const css = await require("postcss")([require("@tailwindcss/postcss")({ base: out })]).process(fs.readFileSync(path.join(root, "app/globals.css"), "utf8").replace('@import "tailwindcss";', `@import "tailwindcss" source(none);\n${sources}`), { from: path.join(root, "app/globals.css") });
  fs.writeFileSync(path.join(out, "style.css"), css.css);
  const html = `<!doctype html><html><head><link rel="stylesheet" href="/style.css"><style>@font-face{font-family:Geist;src:url('/geist.woff2')}body{margin:0;background:#141414;font-family:Geist,sans-serif}</style></head><body><div id="root"></div><script src="/footer.js"></script></body></html>`;
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/") { res.setHeader("Content-Type", "text/html"); res.end(html); return; }
    const file = pathname === "/geist.woff2" ? path.join(root, "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2") : path.join(out, pathname);
    if (!file.startsWith(out + path.sep) && !file.endsWith("Geist-Variable.woff2")) { res.writeHead(404); res.end(); return; }
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", ({ ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2" })[path.extname(file)] || "application/octet-stream");res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser; const checks = []; const errors = [];
  try {
    let pw; try { pw = require("playwright"); } catch { pw = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")); }
    browser = await pw.chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage();page.on("pageerror", e => errors.push(e.message));
    for (const width of [320,390,768,1050,1440,1920]) {
      await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator("footer").waitFor();await page.evaluate(()=>document.fonts.ready);
      const result = await page.locator("footer").evaluate(footer => {
        const word = footer.querySelector('[data-footer-wordmark]'); const f=footer.getBoundingClientRect();const w=word.getBoundingClientRect();const style=getComputedStyle(footer);const ws=getComputedStyle(word);
        return {background:style.backgroundColor,overflow:style.overflow,wordColor:ws.color,weight:ws.fontWeight,hidden:word.getAttribute('aria-hidden'),pointer:ws.pointerEvents,cropped:w.bottom>f.bottom,noOverflow:document.documentElement.scrollWidth<=innerWidth,font:ws.fontFamily,width:Math.round(w.width),footerHeight:f.height};
      });
      assert.equal(result.background,"rgb(20, 20, 20)");assert.equal(result.wordColor,"rgb(36, 36, 36)");assert.equal(result.hidden,"true");assert.equal(result.pointer,"none");assert(result.cropped);assert(result.noOverflow);assert(+result.weight>=800);
      assert.equal(await page.getByRole('link',{name:'Copyright',exact:true}).getAttribute('href'),'/terms');
      await page.locator("footer").screenshot({path:path.join(out,`footer-${width}.png`)});
      await page.locator('footer summary').click();
      for(const route of ['/privacy','/terms','/data-deletion','/acceptable-use','/cookies']) assert(await page.locator(`footer a[href="${route}"]`).first().isVisible(),route);
      assert.equal(await page.locator('footer a[href^="https://"]').count(),0, 'No social links in footer, including More');
      assert(await page.getByRole('link',{name:'Data Deletion',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+10,r.y+10)?.closest('a')===el}), 'Wordmark does not intercept legal links');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks.push({viewportWidth:width,...result});
    }
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('footer').waitFor();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Privacy');
    assert.deepEqual(errors,[]);const receipt={checks,keyboardFirstLink:true,legalLinksPreserved:true,socialLinksRemoved:true,errors,boundary:'Actual footer and caller arrays, actual CSS/font; isolated shell, not complete Next.js or production acceptance'};fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
