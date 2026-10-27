import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import sharp from "sharp";

// Prepare compact, content-hashed landing copies from the exact public Explore
// references approved for the hero. Run after refreshing .tmp/explore-hero-selected.
const sourceRoot = ".tmp/explore-hero-selected";
const outputRoot = "public/marketing/hero-gallery";
const staging = mkdtempSync(path.resolve(".tmp/landing-hero-gallery-"));
mkdirSync(outputRoot, { recursive: true });

const videos = [
  ["outerLeft", "explore-paired-hook-3cddc94937cdb32947f9e0c2"],
  ["wallLeft", "explore-wall-text-05"],
  ["hookPrimary", "explore-paired-hook-2a74d53ba481fd0f99b84179"],
  ["wallRight", "explore-wall-text-61"],
  ["outerRight", "explore-paired-hook-44d165d51084f977f5146f69"],
];
const slideshows = [
  ["slideshowLeft", "explore-slideshow-fitness-1e937e8be4486b45", "slides-a", [
    "4f04e98471a975f8161518e827745bfef2e671597b1952adb184c8231fdb8a28.jpg",
    "61d7773e921beb26fe7522b0fcdb2c2c7e3c90bd43dc73177cc5affd93fd53c6.jpg",
    "14f4b6057c691d2a2af0a2d6ddd3b86732302894d6516d1fcf6ba5c3bfb92bf3.jpg",
    "52b6498f1537877a36c811ce1aba40e92326909241f6c17c8d3a333252935c72.jpg",
    "10e843d7c154e754d76bfd24ac687208e9bd70d80e99ac45c11ef6dc43680e6f.jpg",
    "0a9d947be0e080e16b858295fa20941cdc3f29a2ad68262d59915945f241fcf3.jpg",
  ]],
  ["slideshowRight", "explore-slideshow-fitness-6762e151a53d2f5c", "slides-b", [
    "d3145a5df6ea377bbab3cb2c4a5a6fd17dc78e1c69ee5ad2a04807d3363d52f9.jpg",
    "d29e57f98d360d24c6b40428a521c649128763375541d3ffc82b5e0233d3168c.jpg",
    "b646002e9837a6a57a01949422ac64220b9cf1024cd55b6af3b25c6c5756aebf.jpg",
    "e4adb4df7caf91b867a5c3edd2ff465e498a11161cde449f796b816efc770857.jpg",
    "3b550957cab594baa92435da63c29857121505dd5922d59d08dbcdeed1005144.jpg",
    "8cdad7e9b2fa350b0ff9983ab319d36276a37ace2dfe837438f9940da2c80437.jpg",
  ]],
];
// Keep the separately curated loop additions when refreshing the original seven.
// Refresh those sources with prepare-landing-loop-additions.mjs.
const manifest = { videos: JSON.parse(readFileSync("lib/marketing/landing-preview-assets.json")).videos, slideshows: {} };

for (const [id, sourceId] of videos) {
  const source = path.join(sourceRoot, "sources", `${sourceId}.mp4`);
  const sourcePoster = path.join(sourceRoot, "sources", `${sourceId}.webp`);
  const encoded = path.join(staging, `${id}.mp4`);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", source,
    "-map", "0:v:0", "-an", "-map_metadata", "-1", "-vf", "scale=w='min(540,iw)':h=-2:flags=lanczos",
    "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p", "-threads", "2",
    "-movflags", "+faststart", encoded], { windowsHide: true, stdio: "inherit" });
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-xerror", "-i", encoded,
    "-map", "0:v:0", "-f", "null", "-"], { windowsHide: true, stdio: "inherit" });
  const video = publish(encoded, id, "mp4");
  const poster = publish(sourcePoster, `${id}-poster`, "webp");
  const probe = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", encoded], { windowsHide: true, encoding: "utf8" }));
  const stream = probe.streams.find((entry) => entry.codec_type === "video");
  manifest.videos[id] = { sourceId, src: video.src, poster: poster.src, bytes: video.bytes };
  console.log(JSON.stringify({ id, sourceId, width: stream.width, height: stream.height, duration: probe.format.duration, bytes: video.bytes }));
}

for (const [id, sourceId, directory, files] of slideshows) {
  const slides = [];
  for (const [index, file] of files.entries()) {
    const encoded = path.join(staging, `${id}-${index + 1}.webp`);
    await sharp(path.join(sourceRoot, directory, file)).rotate().resize({ width: 540, withoutEnlargement: true }).webp({ quality: 78 }).toFile(encoded);
    const published = publish(encoded, `${id}-${index + 1}`, "webp");
    const metadata = await sharp(encoded).metadata();
    slides.push({ src: published.src, width: metadata.width, height: metadata.height });
  }
  manifest.slideshows[id] = { sourceId, slides };
}

writeFileSync("lib/marketing/landing-preview-assets.json", `${JSON.stringify(manifest, null, 2)}\n`);

function publish(source, id, extension) {
  const bytes = readFileSync(source);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const name = `${id}.${hash.slice(0, 16)}.${extension}`;
  copyFileSync(source, path.join(outputRoot, name));
  return { src: `/marketing/hero-gallery/${name}`, bytes: bytes.length };
}
