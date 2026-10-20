import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import opentype from "opentype.js";
import sharp from "sharp";
import { serializeGlyphPath } from "./svg-glyph-path.js";

test("SVG coordinates remain finite near positive/negative integer boundaries and preserve every command", () => {
  const result = serializeGlyphPath({ commands: [
    { type: "M", x: 83.00000000000001, y: -1e-14 },
    { type: "L", x: -2.00000000000001, y: 5e-14 },
    { type: "Q", x1: 191.00000000000003, y1: 1, x: 0, y: -1 },
    { type: "C", x1: 0, y1: 1, x2: 2, y2: 3, x: 4, y: 5 }, { type: "Z" },
  ] });
  assert.equal(result, "M83 0L-2 0Q191 1 0 -1C0 1 2 3 4 5Z");
  for (const x of [NaN, Infinity, -Infinity]) assert.throws(() => serializeGlyphPath({ commands: [{ type: "M", x, y: 0 }] }), /invalid coordinates/);
});

for (const font of ["inter", "dmsans", "robotocondensed", "montserrat"]) for (const weight of [400, 500, 700]) {
  test(`${font} ${weight}: alphabet, numbers, accents and punctuation retain glyph ink at fractional positions`, async () => {
    const bytes = await readFile(new URL(`../../src/assets/fonts/explore-text/${font}-${weight}.ttf`, import.meta.url));
    const face = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    const characters = [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?:;&’\"()-éàö"];
    const cell = 80, columns = 12, rows = Math.ceil(characters.length / columns);
    const paths = characters.map((character, index) => {
      assert.ok(face.hasChar(character), `${font} supports ${character}`);
      const glyph = face.charToGlyph(character);
      // Exercise coordinates that broke the library serializer, plus ordinary
      // fractional positions encountered after accumulated character advances.
      const x = index % columns * cell + 10.00000000000001;
      const y = Math.floor(index / columns) * cell + 58.00000000000001;
      return `<path d="${serializeGlyphPath(glyph.getPath(x, y, 40))}"/>`;
    }).join("");
    assert.doesNotMatch(paths, /NaN|Infinity|undefined/);
    const { data, info } = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${columns * cell}" height="${rows * cell}"><g fill="#ffea00">${paths}</g></svg>`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    characters.forEach((character, index) => {
      let ink = 0;
      const left = index % columns * cell, top = Math.floor(index / columns) * cell;
      for (let y = top; y < top + cell; y++) for (let x = left; x < left + cell; x++) if (data[(y * info.width + x) * 4 + 3]! > 64) ink++;
      assert.ok(ink > 8, `${font} ${weight} ${character} has visible rasterized ink (${ink})`);
    });
  });
}
