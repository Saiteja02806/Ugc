import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

// These assets are deliberately packaged outside public/ and public storage.
const folders = process.argv.slice(2);
if (folders.length !== 2) throw new Error("Pass the two creator source folders in account order.");
const destination = path.resolve("lib/explore/creator-account-media");
const review = path.resolve(".tmp/creator-account-review");
fs.mkdirSync(destination, { recursive: true });
fs.mkdirSync(review, { recursive: true });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const previous = fs.existsSync("lib/explore/creator-accounts.json") ? JSON.parse(fs.readFileSync("lib/explore/creator-accounts.json","utf8")) : null;
const accounts = folders.map((folder, index) => ({
  id: `creator-account-${index + 1}`, label: `Creator Account ${index + 1}`,
  items: fs.readdirSync(folder).filter(file => /\.mp4$/i.test(file)).sort().map((file, position) => {
    const source = path.join(folder, file), bytes = fs.readFileSync(source), sourceSha256 = sha(bytes);
    const probe = JSON.parse(execFileSync(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", source], { windowsHide: true }));
    const video = probe.streams.find(stream => stream.codec_type === "video");
    const durationSeconds = Number(probe.format.duration);
    if (!video || !Number.isFinite(durationSeconds) || bytes.length > 64 * 1024 ** 2) throw new Error(`Invalid clip: ${file}`);
    const id = `creator-account-${index + 1}-${String(position + 1).padStart(2, "0")}`;
    fs.writeFileSync(path.join(destination, `${sourceSha256}.mp4`), bytes);
    const poster = execFileSync(ffmpeg, ["-v", "error", "-i", source, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"], { windowsHide: true, maxBuffer: 16 * 1024 ** 2 });
    fs.writeFileSync(path.join(destination, `${sourceSha256}.png`), poster);
    execFileSync(ffmpeg, ["-v", "error", "-y", "-i", source, "-vf", `fps=${4 / durationSeconds},scale=220:-1,tile=4x1`, "-frames:v", "1", path.join(review, `${id}.jpg`)], { windowsHide: true });
    const reviewed = previous?.accounts.flatMap(account=>account.items).find(item=>item.id===id);
    if (reviewed && reviewed.sourceSha256 !== sourceSha256) throw new Error("Source changed; preserve saved frame bindings and review a new reference identity before importing.");
    return { id, sourceFile: file, sourceSha256, posterSha256: sha(poster), width: video.width, height: video.height, durationSeconds, videoBytes: bytes.length, posterBytes: poster.length,
      ...(reviewed?.startingFrame ? {startingFrame:reviewed.startingFrame} : {}) };
  }),
}));
fs.writeFileSync("lib/explore/creator-accounts.json", JSON.stringify({ version: 1, accounts }, null, 2) + "\n");
console.log(JSON.stringify(accounts.map(account => ({ id: account.id, videos: account.items.length, durationSeconds: account.items.map(item => item.durationSeconds) }))));
