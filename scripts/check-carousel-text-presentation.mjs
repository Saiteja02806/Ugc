// Offline visual canary. No database, model calls, image matcher or uploads.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { CAROUSEL_STRUCTURE_2_STORY_ROLES } from "../worker/dist/lib/carousel-structure-2-formats.js";

const output = path.resolve(".tmp/carousel-text-presentation");
await mkdir(output, { recursive: true });
if (!process.env.FONTCONFIG_FILE) {
  const fontConfig = path.join(output, "fonts.conf");
  await writeFile(fontConfig, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir prefix="cwd">worker/src/assets/fonts</dir>
  <dir prefix="cwd">lib/trending/fonts</dir>
  <cachedir prefix="cwd">.tmp/carousel-font-cache</cachedir>
</fontconfig>
`);
  process.env.FONTCONFIG_FILE = fontConfig;
}
// Use the worker's exact native Sharp build; mixing the web and worker copies
// in one Windows process can load incompatible libvips libraries.
const sharp = createRequire(new URL("../worker/package.json", import.meta.url))("sharp");
const { renderCarouselSlideWithDiagnostics } = await import("../worker/dist/lib/carousel-render-slide.js");
const { renderCarouselStructure2SlideFromBuffer } = await import("../worker/dist/lib/carousel-structure-2-render-slide.js");
const background = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#435254" } }).png().toBuffer();
const assetUrl = `data:image/png;base64,${background.toString("base64")}`;
const body = "i used to wait until i felt ready\n\nnow i show up for ten minutes every morning";
const heading = "i stopped waiting for motivation";
const cases = [
  { id: "s1-hook", structure: 1, cover: true },
  { id: "s2-hook", structure: 2, cover: true },
  { id: "s1-heading-two-blocks", structure: 1, headline: heading },
  { id: "s1-body-only", structure: 1, headline: null },
  { id: "s2-heading-two-blocks", structure: 2, headline: heading },
  { id: "s2-body-only", structure: 2, headline: null },
  { id: "s2-screenshot-cta", structure: 2, headline: "one small step made it easier", cta: "try one small step today", product: true },
];
const diagnostics = [];
const panels = [];
for (const format of ["4:5", "1:1"]) {
  for (const entry of cases) {
    const slideNumber = entry.cover ? 1 : entry.cta ? 6 : 2;
    const hook = "i kept running out of things to post";
    const rendered = entry.structure === 1
      ? await renderCarouselSlideWithDiagnostics({
          assetUrl, businessName: "Canary", format, textStyle: "plain",
          slide: { body: entry.cover ? null : body, ctaText: entry.cta ?? null, headline: entry.cover ? hook : entry.headline, imageDirection: "existing background unchanged", layoutPreset: "middle-statement", listItems: [], slideNumber, slideType: entry.cover ? "hook" : "solution", subtext: entry.cover ? null : body, textMode: entry.cover ? "single_statement" : entry.headline ? "headline_body" : "body_only", textPosition: "center" },
        })
      : await renderCarouselStructure2SlideFromBuffer({
          assetBuffer: entry.product ? await sharp(Buffer.from('<svg width="600" height="1000" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="1000" fill="#f5f5f5"/><rect x="24" y="30" width="552" height="100" rx="16" fill="#1f3d34"/><rect x="24" y="160" width="552" height="260" rx="16" fill="#d9e4dd"/><rect x="24" y="450" width="552" height="460" rx="16" fill="#e6e6e6"/></svg>')).png().toBuffer() : background,
          format,
          spec: { assetId: "offline-canary", assetUrl: "https://example.test/not-fetched", ctaText: entry.cta ?? null, headline: entry.cover ? null : entry.headline, layoutVariant: entry.product ? "story_product_reveal" : "story_overlay_only", productVisualEligibility: entry.product ? "preferred" : "forbidden", slideNumber, storyFormatId: "wrong_belief", storyRole: entry.cover ? CAROUSEL_STRUCTURE_2_STORY_ROLES[0] : entry.cta ? "takeaway_cta" : "failure_scene", storyText: entry.cover ? hook : body, textPosition: "center", textTreatment: "overlay", visualContext: "existing composition", visualRole: entry.product ? "product_asset" : "human" },
        });
    const name = `${entry.id}-${format.replace(":", "x")}.webp`;
    await writeFile(path.join(output, name), rendered.buffer);
    diagnostics.push({ name, ...rendered.diagnostics });
    const thumbnail = await sharp(rendered.buffer).resize(270, 338, { fit: "contain", background: "#171d1d" }).png().toBuffer();
    const label = Buffer.from(`<svg width="270" height="30" xmlns="http://www.w3.org/2000/svg"><rect width="270" height="30" fill="#fff"/><text x="12" y="20" font-family="Arial" font-size="12" fill="#111">${entry.id} ${format}</text></svg>`);
    panels.push(await sharp({ create: { width: 270, height: 368, channels: 3, background: "#fff" } }).composite([{ input: label, left: 0, top: 0 }, { input: thumbnail, left: 0, top: 30 }]).png().toBuffer());
  }
}
await sharp({ create: { width: 1080, height: Math.ceil(panels.length / 4) * 368, channels: 3, background: "#fff" } }).composite(panels.map((input, index) => ({ input, left: index % 4 * 270, top: Math.floor(index / 4) * 368 }))).png().toFile(path.join(output, "contact-sheet.png"));
await writeFile(path.join(output, "diagnostics.json"), JSON.stringify(diagnostics, null, 2));
console.log(`Offline canary: ${diagnostics.length} slides; ${path.join(output, "contact-sheet.png")}`);
