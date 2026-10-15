import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { sourceInventory } from "./explore-reference-text-inventory.mjs";
import { ReferenceTextSchema } from "../lib/explore/reference-text.ts";
import { LOCAL_TEXT_PIPELINE_VERSION, assertTranscript, catalogueDraft, exactTranscript, proposeCaptionBlocks, shouldExtract, textKey, transcriptHash } from "./explore-reference-text-processing.mjs";
import { atomicJsonSync as atomicJson } from "./reference-text-atomic-write.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = path.join(root, ".tmp/explore-reference-text-local");
const cataloguePath = path.join(root, "lib/explore/reference-text-catalog.json");
const transcriptPath = path.join(root, "lib/explore/reference-text-transcripts.json");
const checkpointPath = path.join(work, "checkpoint-v2.json");
const runFile = promisify(execFile);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = (file, fallback) => existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
const relative = file => path.relative(root, file).replaceAll("\\", "/");
function argument(args, name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Missing value for ${name}.`);
  return args[i + 1];
}
function localFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? localFiles(file) : /\.(mp4|jpg|jpeg|png|webp)$/iu.test(entry.name) ? [file] : [];
  });
}
function lineBox(words) {
  if (!words.length) return null;
  const x = Math.min(...words.map(w => w.x)), y = Math.min(...words.map(w => w.y));
  return { x, y, width: Math.max(...words.map(w => w.x + w.width)) - x, height: Math.max(...words.map(w => w.y + w.height)) - y };
}
async function ocr(paths, directory, name) {
  const manifest = path.join(directory, `${name}-frames.json`), rawPath = path.join(directory, `${name}-ocr.json`);
  atomicJson(manifest, paths);
  await runFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "scripts/windows-reference-ocr.ps1"), "-ManifestPath", manifest, "-OutputPath", rawPath], { timeout: 600000, maxBuffer: 1024 * 1024, windowsHide: true });
  const raw = json(rawPath);
  if (!Array.isArray(raw) || raw.length !== paths.length || raw.some((frame, i) => path.resolve(frame.path) !== paths[i])) throw new Error("OCR frame inventory mismatch.");
  return { raw, rawPath };
}
async function extract(job, pipelineHash) {
  const { ref, unit, file } = job;
  if (hash(readFileSync(file)) !== unit.hash) throw new Error("Source fingerprint mismatch.");
  const directory = path.join(work, unit.hash, `pass-v2-${pipelineHash.slice(0, 12)}`);
  mkdirSync(directory, { recursive: true });
  let durationMs = null, timestamps = [null], paths;
  if (ref.format === "slideshow") {
    const target = path.join(directory, "source.png");
    await sharp(file).rotate().resize({ width: 2000, height: 2400, fit: "inside", withoutEnlargement: true }).png().toFile(target);
    paths = [target];
  } else {
    const { stdout } = await runFile(ffprobe.path, ["-v", "error", "-select_streams", "v:0", "-show_frames", "-show_entries", "frame=best_effort_timestamp_time:format=duration", "-of", "json", file], { maxBuffer: 16 * 1024 * 1024, timeout: 120000, windowsHide: true });
    const probe = JSON.parse(stdout), lastFrame = probe.frames.length - 1;
    durationMs = Math.ceil(Number(probe.format.duration) * 1000);
    if (!(durationMs > 0 && durationMs <= 120000 && lastFrame >= 0)) throw new Error("Unsupported source duration or missing video frames.");
    // Select real source frames, retaining the final frame even between samples.
    const filter = `setpts=PTS-STARTPTS,select='isnan(prev_selected_t)+gte(t-prev_selected_t,0.25)+eq(n,${lastFrame})',scale=1080:-2,showinfo`;
    const { stderr } = await runFile(ffmpeg, ["-hide_banner", "-loglevel", "info", "-y", "-i", file, "-an", "-vf", filter, "-fps_mode", "vfr", "-q:v", "2", path.join(directory, "%05d.jpg")], { maxBuffer: 16 * 1024 * 1024, timeout: 120000, windowsHide: true });
    timestamps = [...stderr.matchAll(/\bn:\s*\d+\s+pts:\s*-?\d+\s+pts_time:([\d.e+-]+)/gu)].map(match => Math.round(Number(match[1]) * 1000));
    if (!timestamps.length || timestamps[0] !== 0 || timestamps.some((t, i) => !Number.isFinite(t) || t >= durationMs || i > 0 && t <= timestamps[i - 1])) throw new Error("Invalid sampled source timestamps.");
    paths = timestamps.map((_, i) => path.join(directory, `${String(i + 1).padStart(5, "0")}.jpg`));
    if (paths.some(p => !existsSync(p))) throw new Error("Sampled source frame missing.");
  }
  const { raw, rawPath } = await ocr(paths, directory, "source");
  const frames = raw.map((frame, i) => ({ path: relative(frame.path), timestampMs: timestamps[i], lines: frame.lines.map(line => ({ text: line.text, box: lineBox(line.words) })) }));
  const rawBlocks = exactTranscript(frames, durationMs), proposedBlocks = proposeCaptionBlocks(rawBlocks);
  // Alternate crops are evidence only. Do not silently replace an original reading.
  const indices = [...new Set(proposedBlocks.map(block => block.variants.find(v => v.text === block.text).frameIndices[0]))];
  const selected = indices.length <= 24 ? indices : Array.from({ length: 24 }, (_, i) => indices[Math.round(i * (indices.length - 1) / 23)]);
  const cropPaths = [], cropFrames = [];
  for (const i of selected) {
    const boxes = frames[i].lines.map(l => l.box).filter(Boolean);
    if (!boxes.length) continue;
    const meta = await sharp(paths[i]).metadata(), box = lineBox(boxes);
    const left = Math.max(0, Math.floor(box.x) - 16), top = Math.max(0, Math.floor(box.y) - 16);
    const width = Math.min(meta.width - left, Math.ceil(box.x + box.width + 16) - left), height = Math.min(meta.height - top, Math.ceil(box.y + box.height + 16) - top);
    const cropPath = path.join(directory, `crop-${String(i).padStart(5, "0")}.png`);
    await sharp(paths[i]).extract({ left, top, width, height }).grayscale().normalize().resize({ width: 1800, height: 2400, fit: "inside" }).png().toFile(cropPath);
    cropPaths.push(cropPath); cropFrames.push({ frameIndex: i, region: { left, top, width, height } });
  }
  const alternate = cropPaths.length ? await ocr(cropPaths, directory, "alternate") : { raw: [], rawPath: null };
  return assertTranscript({ referenceId: ref.referenceId, slideId: unit.slideId, sourceSha256: unit.hash, format: ref.format,
    pipelineVersion: LOCAL_TEXT_PIPELINE_VERSION, pipelineHash, extractedAt: new Date().toISOString(), durationMs,
    sampleIntervalMs: durationMs === null ? null : 250, captionPolicy: "creator-added-captions-only", rawOcrPath: relative(rawPath), rawOcrSha256: hash(readFileSync(rawPath)),
    frames, rawBlocks, proposedBlocks, alternateReadings: alternate.raw.map((frame, i) => ({ ...cropFrames[i], path: relative(frame.path), text: frame.lines.map(l => l.text).join("\n") })) });
}

export async function main(args = process.argv.slice(2)) {
  if (process.platform !== "win32") throw new Error("Local OCR requires Windows with English OCR installed.");
  const knownArgs = new Set(["--execute", "--reextract-unreviewed", "--force", "--limit", "--concurrency", "--review-set", "--reference-ids", "--hook-release", "--hook-addition-release"]);
  for (const arg of args.filter(a => a.startsWith("--"))) if (!knownArgs.has(arg)) throw new Error(`Unknown option ${arg}.`);
  const options = { execute: args.includes("--execute"), reextractUnreviewed: args.includes("--reextract-unreviewed"), force: args.includes("--force") };
  const limit = Number(argument(args, "--limit", Infinity)), concurrency = Number(argument(args, "--concurrency", 2));
  if (!(limit > 0 && (limit === Infinity || Number.isInteger(limit))) || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw new Error("Choose a positive limit and concurrency 1–3.");
  const pipelineHash = hash(Buffer.concat([readFileSync(fileURLToPath(import.meta.url)), readFileSync(path.join(root, "scripts/explore-reference-text-processing.mjs")), readFileSync(path.join(root, "scripts/windows-reference-ocr.ps1")), readFileSync(path.join(root, "scripts/reference-text-atomic-write.mjs"))]));
  const includeStagedHookRelease = args.includes("--hook-release") || args.includes("--hook-addition-release");
  const refs = sourceInventory({ includeStagedHookRelease }), catalogue = json(cataloguePath), current = new Map(catalogue.items.map(item => [textKey(item), ReferenceTextSchema.parse(item)]));
  const checkpoints = json(checkpointPath, { version: 2, items: {} });
  const reviewSet = argument(args, "--review-set", null), ids = argument(args, "--reference-ids", null);
  const selectedKeys = reviewSet ? new Set(json(path.resolve(root, reviewSet)).findings.map(textKey)) : null;
  const selectedIds = ids ? new Set(ids.split(",")) : args.includes("--hook-release") ? new Set(json(path.join(root, "worker/src/lib/explore-hook-reference-release.json")).items.map(item => item.id)) : args.includes("--hook-addition-release") ? new Set(json(path.join(root, "worker/src/lib/explore-hook-reference-addition-release.json")).items.map(item => item.id)) : null;
  const allUnits = refs.flatMap(ref => ref.units.map(unit => ({ ref, unit, key: textKey({ referenceId: ref.referenceId, slideId: unit.slideId }) })));
  if (selectedKeys && [...selectedKeys].some(key => !allUnits.some(job => job.key === key)) || selectedIds && [...selectedIds].some(id => !refs.some(ref => ref.referenceId === id))) throw new Error("Selection contains an unknown source identity.");
  const files = new Map();
  for (const directory of [".tmp/explore-catalog/media", ".tmp/explore-paired-references/media"]) for (const file of localFiles(path.join(root, directory))) {
    const original = path.basename(file).match(/^([a-f0-9]{64})\.(?:mp4|jpg|jpeg|png|webp)$/iu);
    if (original) files.set(original[1], file);
  }
  const eligible = allUnits.filter(job => (!selectedKeys || selectedKeys.has(job.key)) && (!selectedIds || selectedIds.has(job.ref.referenceId)) && shouldExtract(current.get(job.key), job.unit, options, checkpoints.items[job.key], pipelineHash));
  const jobs = eligible.slice(0, limit).map(job => ({ ...job, file: files.get(job.unit.hash) }));
  console.log(JSON.stringify({ mode: options.execute ? "local-windows-ocr-v2" : "dry-run", pipelineHash, eligible: eligible.length, selected: jobs.length, unavailable: jobs.filter(job => !job.file).length, reviewedProtected: catalogue.items.filter(item => item.status !== "needs_review").length, externalRequests: 0 }));
  if (!options.execute || !jobs.length) return;
  if (jobs.some(job => !job.file)) throw new Error("Selected sources are unavailable locally; catalogue not modified.");
  mkdirSync(work, { recursive: true });
  const lock = path.join(work, "extract-v2.lock");
  try { writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: "wx" }); }
  catch { throw new Error("An extraction lock exists. Check that process before resuming; no concurrent extractor was started."); }
  const runDirectory = path.join(work, "runs", new Date().toISOString().replaceAll(/[:.]/gu, "-"));
  const results = []; let next = 0, commitChain = Promise.resolve();
  try {
    mkdirSync(runDirectory, { recursive: true }); atomicJson(path.join(runDirectory, "catalogue-before.json"), catalogue);
    const transcripts = json(transcriptPath, { version: 2, items: [] });
    atomicJson(path.join(runDirectory, "transcripts-before.json"), transcripts, true);
    const saved = new Map(transcripts.items.map(item => [textKey(item), item]));
    const commit = (job, transcript) => {
      // Serialize writes; reread catalogue so a completed manual review wins.
      const action = commitChain.then(() => {
        const fresh = json(cataloguePath), items = new Map(fresh.items.map(item => [textKey(item), item])), existing = items.get(job.key);
        if (existing && existing.sourceSha256 !== job.unit.hash) throw new Error("Source changed during extraction; draft not published.");
        saved.set(job.key, transcript); atomicJson(transcriptPath, { version: 2, items: [...saved.values()] }, true);
        items.set(job.key, ReferenceTextSchema.parse(catalogueDraft(transcript, existing)));
        atomicJson(cataloguePath, { version: 1, items: [...items.values()] });
        checkpoints.items[job.key] = { status: "completed", sourceSha256: job.unit.hash, pipelineHash, transcriptSha256: transcriptHash(transcript), completedAt: new Date().toISOString() };
        atomicJson(checkpointPath, checkpoints);
      });
      commitChain = action.catch(() => {}); return action;
    };
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        try {
          const transcript = await extract(job, pipelineHash); await commit(job, transcript);
          const result = { referenceId: job.ref.referenceId, slideId: job.unit.slideId, status: "completed", frames: transcript.frames.length, rawBlocks: transcript.rawBlocks.length, proposedBlocks: transcript.proposedBlocks.length };
          results.push(result); console.log(JSON.stringify(result));
        } catch (error) {
          const result = { referenceId: job.ref.referenceId, slideId: job.unit.slideId, status: "failed", error: error.message };
          results.push(result); checkpoints.items[job.key] = { ...result, sourceSha256: job.unit.hash, pipelineHash }; atomicJson(checkpointPath, checkpoints); console.error(JSON.stringify(result));
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    atomicJson(path.join(runDirectory, "result.json"), { pipelineHash, results });
    console.log(JSON.stringify({ saved: results.filter(r => r.status === "completed").length, failed: results.filter(r => r.status === "failed").length, snapshot: relative(runDirectory), externalRequests: 0 }));
    if (results.some(r => r.status === "failed")) process.exitCode = 1;
  } finally { unlinkSync(lock); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
