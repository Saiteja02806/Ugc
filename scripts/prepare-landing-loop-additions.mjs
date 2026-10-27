import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

// Landing-only derivatives. Original Explore catalogues and media stay intact.
const work = ".tmp/landing-loop-additions";
const onlyFlag = process.argv.indexOf("--only");
const only = onlyFlag >= 0 ? process.argv[onlyFlag + 1] : null;
mkdirSync(work, { recursive: true });
const manifestPath = "lib/marketing/landing-preview-assets.json";
const manifest = JSON.parse(readFileSync(manifestPath));
const hooks = JSON.parse(readFileSync("worker/src/lib/explore-hook-reference-release.json"));
const paired = JSON.parse(readFileSync("worker/src/lib/explore-paired-reference-catalog.json"));
const talking = JSON.parse(readFileSync("lib/explore/talking-head-reference-catalog.json"));
const talkingSources = JSON.parse(readFileSync("lib/explore/talking-head-source-manifest.json"));
const additions = [
  ["talkingDemo", talking.items.find(item => item.id === "talking-room-explainer-full")],
  ["demoExample", talking.items.find(item => item.id === "talking-room-explainer-full")],
  ["hookExtra", hooks.items.find(item => item.id === "explore-paired-hook-4585ee949081c4e5cd835cd3")],
  ["wallExtra", paired.items.find(item => item.id === "explore-paired-wall_text-d3259c1239762b2daa319893")],
];
for (const [key, item] of additions) {
  if (only && key !== only) continue;
  if (!item) throw Error(`Missing public Explore reference: ${key}`);
  const source = item.videoUrl ? path.join("public", item.videoUrl) : path.join(work, `${key}-source.mp4`);
  if (!item.videoUrl) {
    const response = await fetch(`https://storage.googleapis.com/ugcsaas-media/${item.videoStorageKey}`);
    if (!response.ok) throw Error(`Download ${key}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== item.videoSha256) throw Error(`Source hash mismatch: ${key}`);
    writeFileSync(source, bytes);
  }
  const sourceSha256 = createHash("sha256").update(readFileSync(source)).digest("hex");
  const expectedHash = item.videoSha256 ?? talkingSources.items.find(entry => entry.id === item.id)?.sourceSha256;
  if (!expectedHash || sourceSha256 !== expectedHash) throw Error(`Canonical source hash mismatch: ${key}`);
  const encoded = path.join(work, `${key}.mp4`);
  const excerpt = key === "demoExample";
  // The combined format must open on the creator, then reach the product demo.
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...(excerpt ? ["-ss", "0"] : []), "-i", source, ...(excerpt ? ["-t", "19"] : []),
    "-map", "0:v:0", "-an", "-map_metadata", "-1", "-vf", "scale=w='min(540,iw)':h=-2:flags=lanczos",
    "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p", "-threads", "2", "-movflags", "+faststart", encoded], { windowsHide: true });
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-xerror", "-i", encoded, "-f", "null", "-"], { windowsHide: true });
  const still = path.join(work, `${key}.png`);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", encoded, "-frames:v", "1", still], { windowsHide: true });
  const poster = path.join(work, `${key}.webp`);
  await sharp(still).webp({ quality: 80 }).toFile(poster);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", source,
    "-vf", `fps=8/${item.durationSeconds},scale=180:-2,tile=4x2`, "-frames:v", "1", path.join(work, `${key}-review.jpg`)], { windowsHide: true });
  const video = publish(encoded, key, "mp4");
  manifest.videos[key] = { sourceId: excerpt ? `${item.id}:demo-0-19` : item.id, src: video.src, poster: publish(poster, `${key}-poster`, "webp").src,
    bytes: video.bytes, sourceUrl: item.sourceUrl ?? item.instagramUrl ?? `https://storage.googleapis.com/ugcsaas-media/${item.videoStorageKey}`,
    sourceSha256, durationSeconds: excerpt ? 19 : item.durationSeconds,
    ...(excerpt ? { parentSourceId: item.id, sourceStartSeconds: 0, sourceEndSeconds: 19 } : {}) };
  console.log(JSON.stringify({ key, ...manifest.videos[key] }));
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

function publish(source, key, extension) {
  const bytes = readFileSync(source);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const name = `${key}.${hash}.${extension}`;
  copyFileSync(source, `public/marketing/hero-gallery/${name}`);
  return { src: `/marketing/hero-gallery/${name}`, bytes: bytes.length };
}
