import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";

test("live Explore covers use small fingerprinted fast-start 960px derivatives", () => {
  const sources = ["lib/explore/workflows.ts", "components/explore/ai-character-card.tsx"].map(file => readFileSync(file, "utf8")).join("\n");
  const covers = [...new Set([...sources.matchAll(/"(\/explore\/covers\/[^"\n]+\.mp4)"/g)].map(match => match[1]))];
  assert.equal(covers.length, 5);
  let total = 0;
  for (const cover of covers) {
    const digest = /-([a-f0-9]{12})\.mp4$/.exec(cover)?.[1];
    assert.ok(digest, `Use a content-versioned filename: ${cover}`);
    const bytes = readFileSync(path.join("public", cover)); total += bytes.length;
    assert.equal(createHash("sha256").update(bytes).digest("hex").slice(0, 12), digest);
    assert(bytes.length < 1500000, `${cover} exceeds the landing-preview size budget`);
    const moov = bytes.indexOf(Buffer.from("moov")), mdat = bytes.indexOf(Buffer.from("mdat"));
    assert(moov > 0 && moov < mdat, "Metadata must precede video bytes for early playback");
    const tkhd = bytes.indexOf(Buffer.from("tkhd")), tkhdStart = tkhd - 4, tkhdSize = bytes.readUInt32BE(tkhdStart);
    assert.equal(bytes.readUInt32BE(tkhdStart + tkhdSize - 8) / 65536, 960);
    assert.equal(bytes.readUInt32BE(tkhdStart + tkhdSize - 4) / 65536, 540);
  }
  assert(total < 4000000, "Combined visible preview files must stay below 4 MB");
});
