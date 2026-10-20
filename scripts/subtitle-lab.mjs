/** Local operator harness. No app route, job registry, storage, or screen imports this. */
import { createHash } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { generateSubtitles } from "../worker/dist/subtitles/generate.js";
import { parseStyle, parsePlacement, parseLanguage, SubtitleError, validateTranscript } from "../worker/dist/subtitles/contracts.js";
import { createOpenAITranscriptionProvider, OPENAI_SUBTITLE_RETIREMENT } from "../worker/dist/subtitles/openai-provider.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const usage = `Standalone subtitle evaluation (no app integration)
Build first: npm run worker:build
Live: node --env-file=.env.local scripts/subtitle-lab.mjs --input VIDEO --output-dir NEW_DIRECTORY
Offline: node scripts/subtitle-lab.mjs --input VIDEO --output-dir NEW_DIRECTORY --transcript JSON
Options: --style clean|bold-box|active-word --placement bottom|top --language en --cache-dir DIRECTORY
Outputs: captioned.mp4, captions.ass, captions.srt, captions.vtt, transcript.json, manifest.json
The OpenAI evaluation adapter uses whisper-1, which retires ${OPENAI_SUBTITLE_RETIREMENT}.
`;

function parseArguments(args) {
  const allowed = new Set(["input", "output-dir", "cache-dir", "style", "placement", "language", "transcript"]);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/u, "");
    if (!args[i]?.startsWith("--") || !allowed.has(key) || !args[i + 1] || args[i + 1].startsWith("--") || parsed[key]) {
      throw new SubtitleError("INVALID_ARGUMENTS", "Use --input VIDEO --output-dir NEW_DIRECTORY [--style clean|bold-box|active-word] [--transcript JSON].");
    }
    parsed[key] = args[i + 1];
  }
  if (!parsed.input || !parsed["output-dir"]) throw new SubtitleError("INVALID_ARGUMENTS", "--input and --output-dir are required.");
  return parsed;
}

const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
try {
  if (process.argv.length === 3 && process.argv[2] === "--help") {
    process.stdout.write(usage);
  } else {
  const args = parseArguments(process.argv.slice(2));
  const style = parseStyle(args.style ?? "clean"), placement = parsePlacement(args.placement ?? "bottom");
  const language = parseLanguage(args.language);
  let provider;
  if (args.transcript) {
    const source = await readFile(resolve(args.transcript), "utf8");
    const transcript = JSON.parse(source);
    provider = {
      id: `fixture:${createHash("sha256").update(source).digest("hex")}`,
      transcribe: async (_audioPath, durationMs) => validateTranscript({ ...transcript, provider: "fixture" }, durationMs),
    };
    process.stderr.write("Offline supplied-timestamp mode: this does not test speech recognition.\n");
  } else {
    provider = createOpenAITranscriptionProvider(process.env.OPENAI_API_KEY ?? "", language);
    process.stderr.write(`OpenAI evaluation adapter: whisper-1 retires ${OPENAI_SUBTITLE_RETIREMENT}; no production integration.\n`);
  }
  const outputDir = resolve(args["output-dir"]);
  await mkdir(dirname(outputDir), { recursive: true });
  const result = await generateSubtitles({ inputPath: resolve(args.input), outputDir,
    cacheDir: resolve(args["cache-dir"] ?? resolve(root, ".tmp", "subtitle-cache")), style, placement, provider,
    tools: { ffmpeg: process.env.FFMPEG_PATH ?? ffmpeg, ffprobe: process.env.FFPROBE_PATH ?? ffprobe.path,
      fontsDir: resolve(root, "worker", "src", "assets", "fonts") }, signal: controller.signal,
    onStage: (stage) => process.stderr.write(`${stage}\n`),
  });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }
} catch (error) {
  // Never print raw provider errors/headers, credential values, or raw transcripts.
  const message = error instanceof SubtitleError ? `${error.code}: ${error.message}` : "Subtitle generation failed. Check local input files and tool configuration.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
