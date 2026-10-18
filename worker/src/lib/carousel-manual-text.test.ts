import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { CAROUSEL_EDIT_FONTS, createCarouselManualLayout, defaultCarouselManualTextStyle, resolveCarouselManualTextStyle, parseCarouselManualTextStyle, carouselManualTextMarkup, type CarouselManualSlide } from "./carousel-manual-text.js";
import { createCarouselManualSvg, renderCarouselManualSlide } from "./carousel-manual-render.js";

const slide: CarouselManualSlide = { headline: "Small steps", subtext: "Build one useful thing today.\n\nShare what you learned.", ctaText: "", slideNumber: 2, renderFormat: "4:5", textPosition: { x: .5, y: .5 }, textStyle: defaultCarouselManualTextStyle() };
test("manual typography rejects untrusted fonts, CSS colors and unbounded sizes while legacy edits remain valid", () => {
  assert.equal(parseCarouselManualTextStyle(undefined), null);
  for (const patch of [{ font: "url(https://evil.test)" }, { fontSize: NaN }, { fontSize: 300 }, { headingSize: 24.5 }, { color: 'red" onload="alert(1)' }, { headingColor: "transparent" }, { textWidth: 10 }, { align: "justify" }, { fontWeight: 900 }, { headingWeight: 600 }, { lineHeight: 0 }, { backgroundColor: "red" }, { backgroundOpacity: 2 }, { headingBackground: "url(evil)" }, { outline: "yes" }]) assert.throws(() => parseCarouselManualTextStyle({ ...slide.textStyle, ...patch }));
  assert.equal(parseCarouselManualTextStyle({ ...slide.textStyle, color: "#FF00AA" })?.color, "#ff00aa");
});

test("movement does not introduce a panel; explicit source pills and saved v1 styles retain theirs", () => {
  const source = { ...slide, slideNumber: 1, textStyle: null, storyTextTreatment: "overlay" };
  const moved = { ...source, textStyle: resolveCarouselManualTextStyle(source), textPosition: { x: .3, y: .7 } };
  assert.doesNotMatch(carouselManualTextMarkup(createCarouselManualLayout(moved)), /<rect/);
  assert.equal(resolveCarouselManualTextStyle({ storyTextTreatment: "pill" }).headingBackground, "line");
  const legacy = { font: "inter" as const, fontSize: 60, headingSize: 72, color: "#ffffff", headingColor: "#111316" };
  assert.match(carouselManualTextMarkup(createCarouselManualLayout({ ...source, textStyle: legacy })), /<rect/);
  assert.doesNotMatch(carouselManualTextMarkup(createCarouselManualLayout({ ...source, textStyle: { ...legacy, headingBackground: "none" } })), /<rect/);
});

test("explicit three lines, width, alignment, weight and spacing produce matching browser and exported geometry", async () => {
  const input = { ...slide, slideNumber: 1, headline: "This is what I’d do\nTo improve my\nMarketing fast", textStyle: { ...defaultCarouselManualTextStyle(), headingSize: 38, headingWeight: 700 as const, align: "left" as const, textWidth: 800, lineHeight: 1.5 } };
  const { layout, svg } = await createCarouselManualSvg(input);
  assert.deepEqual(layout.rows.map(row => row.text), input.headline.split("\n"));
  assert.ok(layout.rows.every(row => row.weight === 700 && row.lineHeight === 57));
  assert.equal(new Set(layout.rows.map(row => row.x - row.width / 2)).size, 1);
  assert.doesNotMatch(svg, /<rect/);
  const narrow = createCarouselManualLayout({ ...input, textStyle: { ...input.textStyle, textWidth: 240 } });
  assert.ok(narrow.rows.length > 3); assert.ok(narrow.rows.every(row => row.size === 38));
  const right = createCarouselManualLayout({ ...input, textStyle: { ...input.textStyle, align: "right" } });
  assert.equal(new Set(right.rows.map(row => row.x + row.width / 2)).size, 1);
});

test("background choices are explicit, colored and translucent, with one box or per-line panels", async () => {
  for (const background of ["line", "box"] as const) {
    const { svg } = await createCarouselManualSvg({ ...slide, slideNumber: 1, headline: "One\nTwo\nThree", textStyle: { ...defaultCarouselManualTextStyle(), headingBackground: background, backgroundColor: "#112233", backgroundOpacity: .45, headingSize: 120, lineHeight: .95 } });
    assert.equal((svg.match(/<rect /g) ?? []).length, background === "line" ? 3 : 1);
    assert.match(svg, /fill="#112233" fill-opacity="0.45"/);
    await sharp(Buffer.from(svg)).png().toBuffer();
  }
});
for (const font of CAROUSEL_EDIT_FONTS) for (const renderFormat of ["1:1", "4:5"] as const) {
  test(`${font.label} ${renderFormat} exports bundled glyphs with the shared preview layout and full containment`, async () => {
    const input = { ...slide, renderFormat, textPosition: { x: 0, y: 1 }, textStyle: { ...defaultCarouselManualTextStyle(), font: font.id, fontSize: 38, headingSize: 56, color: "#ff00aa" } };
    const expected = createCarouselManualLayout(input), { layout, svg } = await createCarouselManualSvg(input);
    assert.deepEqual(layout, expected); assert.equal(layout.fits, true);
    assert.ok(layout.position.x < .5); assert.ok(layout.position.y > .5);
    assert.ok(layout.position.x * 1080 - layout.width / 2 >= 95.99);
    assert.ok(layout.position.y * layout.frameHeight + layout.height / 2 <= layout.frameHeight - 95.99);
    assert.match(svg, /<path d=/); assert.doesNotMatch(svg, /<text /); assert.match(svg, /#ff00aa/);
    const metadata = await sharp(Buffer.from(svg)).metadata(); assert.equal(metadata.width, 1080); assert.equal(metadata.height, renderFormat === "1:1" ? 1080 : 1350);
    const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let top = info.height, bottom = -1, left = info.width, right = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3]! > 10) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
    assert.ok(left >= 90 && right < 990 && top >= 90 && bottom < info.height - 90, `Visible pixels remain on canvas: ${[left, top, right, bottom]}`);
    assert.equal(layout.rows.map(row => row.text).filter(Boolean).join(" "), "Small steps Build one useful thing today. Share what you learned.");
  });
}
test("large manual copy is not shrunk or truncated; smaller requested typography can make it fit", async () => {
  const crowded = { ...slide, subtext: Array(45).fill("Build useful things.").join(" "), textStyle: { ...defaultCarouselManualTextStyle(), fontSize: 120 } };
  assert.equal(createCarouselManualLayout(crowded).fits, false);
  await assert.rejects(createCarouselManualSvg(crowded), /Reduce the font size/);
  assert.equal(createCarouselManualLayout({ ...crowded, textStyle: { ...crowded.textStyle, fontSize: 24 } }).fits, true);
});
test("manual SVG escapes user markup and cover exports only the requested hook", () => {
  const layout = createCarouselManualLayout({ ...slide, slideNumber: 1, headline: '<script>alert("test")</script>', subtext: "Ignored supporting copy", ctaText: "Ignored CTA" });
  const svg = carouselManualTextMarkup(layout);
  assert.doesNotMatch(svg, /<script>|Ignored supporting copy|Ignored CTA/); assert.match(svg, /&lt;script&gt;/);
});

test("manual image export composites on the source background at the requested dimensions", async () => {
  const source = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: { r: 12, g: 24, b: 36 } } }).png().toBuffer();
  const result = await renderCarouselManualSlide({ assetUrl: `data:image/png;base64,${source.toString("base64")}`, slide });
  const metadata = await sharp(result.buffer).metadata(); assert.equal(metadata.width, 1080); assert.equal(metadata.height, 1350);
  const pixel = await sharp(result.buffer).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  assert.ok(Math.abs(pixel[0]! - 12) < 5 && Math.abs(pixel[1]! - 24) < 5 && Math.abs(pixel[2]! - 36) < 5, "Text rendering retains untouched background pixels");
});
