import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "node:fs";
import path from "node:path";

const queries = [
  {
    key: "cozy-living-room",
    query: "cozy modern living room interior sofa",
    targetFile: "cozy-living-room.jpg",
  },
  {
    key: "office-desk",
    query: "home office desk chair laptop",
    targetFile: "office-desk.jpg",
  },
  {
    key: "cozy-bedroom",
    query: "cozy bedroom bed morning light",
    targetFile: "cozy-bedroom.jpg",
  },
  {
    key: "modern-kitchen",
    query: "modern kitchen island interior daylight",
    targetFile: "modern-kitchen.jpg",
  },
  {
    key: "car-interior",
    query: "car interior driver seat windshield",
    targetFile: "car-interior.jpg",
  },
  {
    key: "clean-studio",
    query: "minimalist interior clean light wall neutral",
    targetFile: "clean-studio.jpg",
  },
];

async function downloadPhoto(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

async function main() {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) {
    console.error("Missing PEXELS_API_KEY");
    process.exit(1);
  }

  const outDir = path.resolve("public/explore/influencer-studio/backgrounds");
  fs.mkdirSync(outDir, { recursive: true });

  for (const item of queries) {
    console.log(`Searching Pexels for: "${item.query}"...`);
    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(item.query)}&orientation=square&per_page=5`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: pexelsKey },
    });

    if (!res.ok) {
      console.warn(`Query failed for ${item.key}:`, res.status);
      continue;
    }

    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) {
      console.warn(`No photos found for ${item.key}`);
      continue;
    }

    const imgUrl = photo.src.large || photo.src.medium || photo.src.original;
    const dest = path.join(outDir, item.targetFile);
    console.log(`Downloading ${imgUrl} to ${dest}...`);
    await downloadPhoto(imgUrl, dest);
    console.log(`Saved ${item.targetFile} (${photo.width}x${photo.height})`);
  }

  console.log("All backgrounds downloaded successfully!");
}

main().catch(console.error);
