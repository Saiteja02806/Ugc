import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Pass the creator slideshow folder.");
const destination = path.resolve("lib/explore/creator-slideshow-media");
await fs.mkdir(destination, { recursive: true });
const folders = (await fs.readdir(source, { withFileTypes: true })).filter(item => item.isDirectory()).sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
const items = [];
for (const [index, folder] of folders.entries()) {
  const directory = path.join(source, folder.name);
  const files = (await fs.readdir(directory)).filter(file => /\.(jpe?g|png|webp)$/i.test(file)).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
  if (files.length < 2 || files.length > 10) throw new Error(`Invalid slide count: ${folder.name}`);
  const id = `creator-slideshow-${String(index + 1).padStart(2,"0")}`, slides = [];
  for (const [position, file] of files.entries()) {
    const bytes = await fs.readFile(path.join(directory, file)), metadata = await sharp(bytes).metadata();
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (!["jpeg","png","webp"].includes(metadata.format) || !metadata.width || !metadata.height || bytes.length > 25 * 1024 ** 2) throw new Error("Unsupported image");
    const extension = metadata.format === "jpeg" ? "jpg" : metadata.format, contentType = `image/${metadata.format}`;
    await fs.writeFile(path.join(destination, `${sha256}.${extension}`), bytes);
    slides.push({ id: `slide-${position + 1}-${sha256.slice(0,12)}`, sourceFile: file, sha256, width: metadata.width, height: metadata.height, bytes: bytes.length, extension, contentType });
  }
  let sourceUrl;
  try { const value = (await fs.readFile(path.join(directory,"New Text Document.txt"),"utf8")).trim(); if (/^https:\/\/www\.tiktok\.com\/@[^/]+\/photo\/\d+$/.test(value)) sourceUrl = value; } catch {}
  items.push({ id, sourceFolder: folder.name, title: "Marketing", ...(sourceUrl ? { sourceUrl } : {}), slides });
}
await fs.writeFile("lib/explore/creator-slideshows.json", JSON.stringify({ version: 1, id: "creator-slideshow-account-1", label: "TikTok Creator Account", items },null,2)+"\n");
console.log(JSON.stringify({ slideshows: items.length, slides: items.reduce((sum,item)=>sum+item.slides.length,0) }));
