/** Offline runtime artwork: run this deliberately to update the pinned pack. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const commit = "b6b55fef1e8636b540a6d016a4729ca8cdf2e60b";
const version = "twemoji-17.0.3";
const root = resolve(".tmp/explore-emoji-source"), assets = resolve("worker/src/assets/emoji");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const key = text => text.toLowerCase().split("-").filter(part => part !== "fe0f").map(part => parseInt(part, 16).toString(16)).join("-");
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Could not read ${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 100 * 1024 * 1024) throw new Error("Emoji source exceeds the preparation limit.");
  return bytes;
}
await mkdir(root, { recursive: true });
await mkdir(assets, { recursive: true });
const archive = await download(`https://codeload.github.com/jdecked/twemoji/tar.gz/${commit}`);
const archivePath = join(root, "source.tar.gz");
await writeFile(archivePath, archive);
const prefix = `twemoji-${commit}/assets/svg`;
const entries = execFileSync("tar", ["-tzf", archivePath], { encoding: "utf8", windowsHide: true }).split(/\r?\n/).filter(name => name.startsWith(prefix + "/"));
if (!entries.length || entries.some(name => !new RegExp(`^${prefix}/(?:[a-f0-9-]+\\.svg)?$`).test(name))) throw new Error("Unexpected emoji archive paths.");
execFileSync("tar", ["-xzf", archivePath, "-C", root, prefix], { windowsHide: true });
const artwork = {};
for (const name of (await readdir(join(root, prefix))).sort()) {
  const svg = (await readFile(join(root, prefix, name), "utf8")).trim();
  if (!svg.startsWith("<svg ") || !svg.endsWith("</svg>") || /<(?:script|foreignObject|image|use|text)\b|\bon\w+\s*=|(?:href|src)\s*=/i.test(svg)) throw new Error(`Unexpected non-vector artwork: ${name}`);
  const id = key(name.slice(0, -4));
  if (artwork[id] && artwork[id] !== svg) throw new Error(`Conflicting emoji presentation: ${id}`);
  artwork[id] = svg;
}
const unicodeUrl = "https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt";
const unicode = await download(unicodeUrl);
const sequences = [...unicode.toString().matchAll(/^([0-9A-F ]+)\s*; fully-qualified\s*#/gm)].map(match => match[1].trim().split(/\s+/).map(cp => String.fromCodePoint(parseInt(cp, 16))).join(""));
const variants = [...unicode.toString().matchAll(/^([0-9A-F ]+)\s*; (?:fully-qualified|minimally-qualified|unqualified)\s*#/gm)].map(match => match[1].trim().split(/\s+/).map(cp => String.fromCodePoint(parseInt(cp, 16))).join(""));
const missing = sequences.filter(value => !artwork[key(Array.from(value, ch => ch.codePointAt(0).toString(16)).join("-"))]);
if (sequences.length !== 3944 || missing.length) throw new Error(`Incomplete Unicode 17 coverage: ${sequences.length} sequences, ${missing.length} missing (${missing.slice(0, 5).join(" ")})`);
const pack = gzipSync(Buffer.from(JSON.stringify(artwork)), { level: 9 });
await writeFile(join(assets, `${version}.json.gz`), pack);
const manifest = { version, unicodeVersion: "17.0", sourceCommit: commit, sourceArchiveSha256: sha(archive), packSha256: sha(pack), unicodeTestSha256: sha(unicode), rgiCount: sequences.length, ids: Object.keys(artwork).sort() };
await writeFile("worker/src/lib/explore-emoji-manifest.json", JSON.stringify(manifest) + "\n");
await writeFile(join(assets, "coverage.json"), JSON.stringify({ unicodeUrl, sha256: sha(unicode), sequences, variants }) + "\n");
const unicodeLicense = await download("https://www.unicode.org/license.txt");
await writeFile(join(assets, "LICENSE-UNICODE.txt"), unicodeLicense);
const license = await download(`https://raw.githubusercontent.com/jdecked/twemoji/${commit}/LICENSE-GRAPHICS`);
await writeFile(join(assets, "LICENSE-GRAPHICS.txt"), license);
const attribution = `Emoji artwork: Twemoji, by Twitter, Inc. and other contributors. https://github.com/jdecked/twemoji/tree/${commit}\nLicensed CC BY 4.0: https://creativecommons.org/licenses/by/4.0/\nArtwork is bundled unchanged in a compressed lookup file; variation-selector aliases are normalized for lookup only. Original caption Unicode is preserved.\n`;
await writeFile(join(assets, "ATTRIBUTION.txt"), attribution);
await mkdir("public/licenses", { recursive: true });
await writeFile("public/licenses/explore-emoji.txt", attribution + "\n" + license.toString());
console.log(JSON.stringify({ version, artworkCount: manifest.ids.length, unicodeRgiCount: sequences.length, bytes: pack.length, packSha256: manifest.packSha256 }, null, 2));
