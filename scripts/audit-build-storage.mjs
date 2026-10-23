import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// Read-only local emitted-file audit. Trace totals are candidate packaging
// logical bytes, not Vercel function grouping, deduplicated billing or wire size.
const root = process.cwd();
const slash = value => value.replaceAll("\\", "/");
const relative = value => slash(path.relative(root, value));
function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? files(target) : entry.isFile() ? [target] : [];
  });
}
function directorySummary(dir) {
  const list = files(path.join(root, dir)).map(file => ({ file: relative(file), bytes: statSync(file).size }));
  return { directory: dir, count: list.length, bytes: list.reduce((n, file) => n + file.bytes, 0), largest: list.sort((a, b) => b.bytes - a.bytes).slice(0, 20) };
}
const buildRoot = path.join(root, process.argv[2] ?? ".next");
const tracePaths = [...files(path.join(buildRoot, "server")), ...readdirSync(buildRoot).filter(name => name.endsWith(".nft.json")).map(name => path.join(buildRoot, name))].filter(file => file.endsWith(".nft.json"));
const seen = new Map();
const traces = tracePaths.map(trace => {
  const input = JSON.parse(readFileSync(trace, "utf8"));
  const paths = [...new Set(input.files.map(file => path.resolve(path.dirname(trace), file)))];
  let bytes = 0, missing = 0;
  for (const file of paths) {
    if (!existsSync(file)) { missing++; continue; }
    const stat = statSync(file); if (!stat.isFile()) continue;
    bytes += stat.size;
    const existing = seen.get(file);
    if (existing) existing.traceCount++;
    else seen.set(file, { file: relative(file), bytes: stat.size, traceCount: 1 });
  }
  return { trace: relative(trace), count: paths.length, bytes, missing };
}).sort((a, b) => b.bytes - a.bytes);
const traced = [...seen.values()];
const native = traced.filter(file => /\.(node|dll|exe)$|\/(ffmpeg|ffprobe)$/.test(file.file));
const hashGroups = new Map();
for (const file of traced.filter(file => file.bytes >= 100000 && /\.(ttf|woff2?|node|dll|exe)$|\/(ffmpeg|ffprobe)$/.test(file.file))) {
  const hash = createHash("sha256").update(readFileSync(path.join(root, file.file))).digest("hex");
  const group = hashGroups.get(hash) ?? []; group.push(file); hashGroups.set(hash, group);
}
const exactDuplicateAssets = [...hashGroups.entries()].filter(([, group]) => group.length > 1).map(([sha256, group]) => ({ sha256, files: group, redundantPathBytes: group[0].bytes * (group.length - 1) }));
const result = {
  measuredAt: new Date().toISOString(), buildId: existsSync(path.join(buildRoot, "BUILD_ID")) ? readFileSync(path.join(buildRoot, "BUILD_ID"), "utf8").trim() : null,
  scope: "Local build traces and local files; Windows native binaries differ from Linux hosted builds. No deployment grouping, storage deduplication or billing inference.",
  traces: { count: traces.length, logicalBytesAcrossTraces: traces.reduce((n, file) => n + file.bytes, 0), uniquePathBytes: traced.reduce((n, file) => n + file.bytes, 0), uniqueFileCount: traced.length, largest: traces.slice(0, 30), topRepeatedFiles: [...traced].sort((a, b) => b.bytes * b.traceCount - a.bytes * a.traceCount).slice(0, 35), native, exactDuplicateAssets },
  directories: [relative(buildRoot), `${relative(buildRoot)}/cache`, ".vercel/output", "public", "public/try-ugcpilot/media", "public/fonts", "worker/src/assets/fonts", "lib/trending/fonts"].map(directorySummary),
};
if (process.argv[3]) { const out = path.resolve(process.argv[3]); mkdirSync(path.dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(result, null, 2) + "\n"); }
console.log(JSON.stringify({ buildId: result.buildId, traceCount: result.traces.count, logicalTraceBytes: result.traces.logicalBytesAcrossTraces, uniqueTracedBytes: result.traces.uniquePathBytes, directories: result.directories.map(({ directory, bytes, count }) => ({ directory, bytes, count })), native: result.traces.native, duplicateAssets: exactDuplicateAssets }, null, 2));
