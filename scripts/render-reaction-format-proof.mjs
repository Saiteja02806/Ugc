import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const args = parseArgs(process.argv.slice(2));
const repositoryRoot = process.cwd();
const backgroundPath = path.resolve(
  String(
    args.background ??
      "C:/Users/chund/OneDrive/Desktop/green_images/download (1).jpg",
  ),
);
const foregroundPath = path.resolve(
  String(
    args.foreground ?? "D:/green_mat/mov/green_removed_clean/01_green_removed_clean.mov",
  ),
);
const outputPath = path.resolve(
  String(
    args.output ?? path.join(repositoryRoot, "artifacts", "reaction-format-proof.mp4"),
  ),
);
const treatment = args.treatment === "white_card" ? "white_card" : "outlined_text";
const text = String(
  args.text ??
    "POV: when your calendar is packed\nand your content is already done",
);
const durationSeconds = parsePositiveNumber(args.duration, 6);
const foregroundHeight = parsePositiveNumber(args["foreground-height"], 1_250);

if (!ffmpegPath) {
  throw new Error("ffmpeg-static is required to render a reaction proof.");
}

mkdirSync(path.dirname(outputPath), { recursive: true });
const captionPath = path.join(path.dirname(outputPath), "reaction-format-proof-caption.png");
await buildCaption({ outputPath: captionPath, text, treatment });

const filter = [
  "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[background]",
  `[1:v]setpts=PTS-STARTPTS,format=rgba,scale=-2:${foregroundHeight}[foreground]`,
  "[background][foreground]overlay=(W-w)/2:H-h:format=auto[composite]",
  "[2:v]format=rgba[caption]",
  "[composite][caption]overlay=0:0:format=auto,format=yuv420p[output]",
].join(";");

run(ffmpegPath, [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-loop",
  "1",
  "-framerate",
  "30",
  "-i",
  backgroundPath,
  "-i",
  foregroundPath,
  "-loop",
  "1",
  "-framerate",
  "30",
  "-i",
  captionPath,
  "-filter_complex",
  filter,
  "-map",
  "[output]",
  "-t",
  String(durationSeconds),
  "-r",
  "30",
  "-c:v",
  "libx264",
  "-crf",
  "19",
  "-movflags",
  "+faststart",
  outputPath,
]);

console.log(`Rendered reaction-format proof: ${outputPath}`);

async function buildCaption({ outputPath, text, treatment }) {
  const lines = text
    .replaceAll("\\n", "\n")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  const lineHeight = treatment === "white_card" ? 72 : 66;
  const fontSize = treatment === "white_card" ? 52 : 48;
  const top = treatment === "white_card" ? 145 : 165;
  const textBlockHeight = lines.length * lineHeight;
  const cardTop = top - 34;
  const cardHeight = textBlockHeight + 68;
  const renderedLines = lines
    .map(
      (line, index) =>
        `<text x="540" y="${top + fontSize + index * lineHeight}" text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join("");
  const card =
    treatment === "white_card"
      ? `<rect x="90" y="${cardTop}" width="900" height="${cardHeight}" rx="30" fill="#ffffff"/>`
      : "";
  const colors =
    treatment === "white_card"
      ? 'fill="#111827" stroke="none"'
      : 'fill="#ffffff" stroke="#111111" stroke-width="10" paint-order="stroke fill" stroke-linejoin="round"';
  const svg = [
    '<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">',
    card,
    `<g ${colors} font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800">`,
    renderedLines,
    "</g>",
    "</svg>",
  ].join("");

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

function run(command, commandArgs) {
  try {
    execFileSync(command, commandArgs, { stdio: "pipe" });
  } catch (error) {
    const detail = error instanceof Error && "stderr" in error
      ? Buffer.from(error.stderr ?? "").toString("utf8").trim()
      : "";
    throw new Error(`Reaction proof rendering failed. ${detail}`.trim());
  }
}

function parsePositiveNumber(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected a positive numeric rendering option.");
  }
  return parsed;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index];
    if (!argument.startsWith("--")) continue;
    const key = argument.slice(2);
    const value = rawArgs[index + 1];
    if (!value || value.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}
