/** Import the user-supplied static Semibold face without changing its outlines. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(new URL("../worker/package.json", import.meta.url));
const opentype = require("opentype.js");
const archive = process.argv[2];
if (!archive) throw new Error("Usage: node scripts/prepare-proxima-font.mjs <supplied-font.zip>");
const root = resolve(import.meta.dirname, "..");
const destination = resolve(root, "worker/src/assets/fonts/explore-text");
const browser = resolve(root, "public/explore-text-fonts");
// Read only named members; never execute the ZIP's HTML or extract arbitrary paths.
execFileSync("python", ["-c", `import zipfile,pathlib,sys
with zipfile.ZipFile(sys.argv[1]) as z:
 for member,target in [
 ('Proxima Nova A Semibold/Proxima Nova A Semibold.ttf',sys.argv[2]+'/proximanovaa-600.ttf'),
 ('Proxima Nova A Semibold/Web Fonts/264e2ce2df4ac93e29576716c566f827.woff2',sys.argv[3]+'/proximanovaa-600.woff2'),
 ('License.txt',sys.argv[2]+'/proximanovaa-notice.txt')]:
  pathlib.Path(target).write_bytes(z.read(member))
`, resolve(archive), destination, browser], { windowsHide: true });
const ttf = await readFile(resolve(destination, "proximanovaa-600.ttf"));
const woff = await readFile(resolve(browser, "proximanovaa-600.woff2"));
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
const widths = {};
for (const [code, glyph] of Object.entries(font.tables.cmap.glyphIndexMap)) {
  const cp = Number(code);
  if (cp >= 32 && cp <= 0x52f || cp >= 0x2000 && cp <= 0x206f)
    widths[String.fromCodePoint(cp)] = Number(((font.glyphs.get(glyph).advanceWidth ?? font.unitsPerEm) / font.unitsPerEm).toFixed(5));
}
const metricsPath = resolve(root, "worker/src/lib/explore-text-font-metrics.json");
const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
metrics["proximanovaa-600"] = widths;
await writeFile(metricsPath, JSON.stringify(metrics) + "\n");
const family = "UGCExploreProximaNovaASemiboldW600";
const manifestPath = resolve(destination, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
manifest.files.proximanovaa = { source: "User-supplied Proxima Nova A Semibold archive", notice: "proximanovaa-notice.txt", weights: { 600: { family, ttfSha256: digest(ttf), woff2Sha256: digest(woff) } } };
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
const cssPath = resolve(root, "components/explore/explore-text-fonts.css");
const css = (await readFile(cssPath, "utf8")).split("\n").filter(line => !line.includes("/proximanovaa-")).join("\n").trimEnd();
await writeFile(cssPath, css + `\n@font-face { font-family: "${family}"; src: url("/explore-text-fonts/proximanovaa-600.woff2") format("woff2"); font-style: normal; font-weight: 600; font-display: swap; }\n`);
console.log("Prepared Proxima Nova A Semibold: matching supplied TTF/WOFF2 and glyph advances.");
