import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function classifyChange({ base, local, main, integrated }) {
  if (local === main) return "already-on-main";
  if (local === base) return "no-local-change";
  if (!local) return "deletion-needs-confirmation";
  if (integrated === local) return "integrated-exactly";
  if (integrated !== main) return "adapted-integration-needs-review";
  if (!base) return main ? "overlapping-addition" : "local-addition";
  return main === base ? "local-only-change" : "overlapping-change";
}

// Human review is separate from the raw comparison. A decision closes only
// these exact source/target blobs; any later edit reopens the review.
export function applyReviewDecisions(rows, ledger, { sourceHead, mainRevision }) {
  if (!ledger) return rows.map((row) => ({ ...row, reviewStatus: "unreviewed" }));
  if (ledger.schemaVersion !== 1 || ledger.sourceHead !== sourceHead ||
      ledger.mainRevision !== mainRevision || !Array.isArray(ledger.decisions)) {
    throw new Error("Review ledger baseline changed; refresh the reviewed decisions");
  }
  const decisions = new Map();
  const candidates = new Set(rows.map((row) => row.path));
  const resolutions = new Set(["included", "adapted", "retained-main", "excluded-local-artifact", "screen-retirement-only"]);
  for (const decision of ledger.decisions) {
    if (!candidates.has(decision.path) || decisions.has(decision.path) ||
        !resolutions.has(decision.resolution) || typeof decision.reason !== "string" || !decision.reason.trim() ||
        ![decision.local, decision.integrated].every((hash) => hash === null || /^[a-f0-9]{40}$/.test(hash))) {
      throw new Error("Invalid, duplicate or out-of-scope reviewed decision");
    }
    decisions.set(decision.path, decision);
  }
  return rows.map((row) => {
    const decision = decisions.get(row.path);
    if (!decision) return { ...row, reviewStatus: "unreviewed" };
    const current = decision.local === row.local && decision.integrated === row.integrated;
    return { ...row, reviewStatus: current ? "reviewed" : "review-stale",
      reviewedResolution: decision.resolution, reviewReason: decision.reason };
  });
}

function git(root, args) {
  return execFileSync("git", ["-c", `safe.directory=${root}`, ...args], {
    cwd: root, windowsHide: true, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function tree(root, revision) {
  const entries = git(root, ["ls-tree", "-r", "-z", revision]).split("\0");
  return new Map(entries.filter(Boolean).map((entry) => {
    const tab = entry.indexOf("\t");
    return [entry.slice(tab + 1), entry.slice(0, tab).split(" ")[2]];
  }));
}

function hashes(root, paths) {
  const found = paths.filter((file) => {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep)) throw new Error("Path outside checkout");
    return existsSync(absolute) && lstatSync(absolute).isFile();
  });
  const results = new Map();
  for (let start = 0; start < found.length; start += 24) {
    const batch = found.slice(start, start + 24);
    const values = git(root, ["hash-object", "--", ...batch]).trim().split(/\r?\n/);
    if (values.length !== batch.length) throw new Error("Incomplete hash capture");
    batch.forEach((file, index) => results.set(file, values[index]));
  }
  return results;
}

function candidatePaths(root, revision) {
  return Array.from(new Set([
    ...git(root, ["diff", "--name-only", "-z", revision]).split("\0"),
    ...git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0"),
  ].filter(Boolean))).sort();
}

export function captureAudit({ sourceRoot, targetRoot, baseRevision, mainRevision, reviewLedger }) {
  sourceRoot = realpathSync(sourceRoot);
  targetRoot = realpathSync(targetRoot);
  if (sourceRoot === targetRoot) throw new Error("Use a separate integration checkout");
  const sourceHead = git(sourceRoot, ["rev-parse", "HEAD"]).trim();
  const targetHead = git(targetRoot, ["rev-parse", "HEAD"]).trim();
  if (sourceHead !== baseRevision) {
    throw new Error("Checkout revision changed; refresh the comparison baseline");
  }
  // A release checkpoint must not invalidate its main baseline. Require the
  // baseline to remain an ancestor, and still detect HEAD changes during capture.
  try {
    git(targetRoot, ["merge-base", "--is-ancestor", mainRevision, targetHead]);
  } catch {
    throw new Error("Release no longer descends from the pinned main baseline");
  }
  // Include integration-only implementation files too. Otherwise a release
  // could contain new worker/API code that never appeared in its review.
  const capturePaths = () => Array.from(new Set([
    ...candidatePaths(sourceRoot, baseRevision),
    ...candidatePaths(targetRoot, mainRevision),
  ])).sort();
  const paths = capturePaths();
  if (paths.some((file) => /(?:^|\/)\.env(?:\.|$)/.test(file) && file !== ".env.example")) {
    throw new Error("Local environment files must not enter reconciliation inventory");
  }
  const base = tree(targetRoot, baseRevision);
  const main = tree(targetRoot, mainRevision);
  const local = hashes(sourceRoot, paths);
  const integrated = hashes(targetRoot, paths);
  const rawRows = paths.map((file) => {
    const state = { base: base.get(file) ?? null, local: local.get(file) ?? null,
      main: main.get(file) ?? null, integrated: integrated.get(file) ?? null };
    const releaseOnly = !base.has(file) && !local.has(file) && !main.has(file) && integrated.has(file);
    return { path: file, ...state, decision: releaseOnly ? "release-only-addition" : classifyChange(state) };
  });
  const rows = applyReviewDecisions(rawRows, reviewLedger, { sourceHead, mainRevision });
  // Detect concurrent edits rather than reporting a mixed snapshot as current.
  const rechecked = hashes(sourceRoot, paths);
  const recheckedTarget = hashes(targetRoot, paths);
  if (paths.some((file) => local.get(file) !== rechecked.get(file)) ||
      paths.some((file) => integrated.get(file) !== recheckedTarget.get(file)) ||
      JSON.stringify(paths) !== JSON.stringify(capturePaths()) ||
      git(sourceRoot, ["rev-parse", "HEAD"]).trim() !== sourceHead ||
      git(targetRoot, ["rev-parse", "HEAD"]).trim() !== targetHead) {
    throw new Error("Checkout changed during capture; retry instead of using stale hashes");
  }
  const counts = {};
  for (const row of rows) counts[row.decision] = (counts[row.decision] ?? 0) + 1;
  const reviewCounts = {};
  for (const row of rows) reviewCounts[row.reviewStatus] = (reviewCounts[row.reviewStatus] ?? 0) + 1;
  return { schemaVersion: 1, kind: "read-only-reconciliation-audit-not-a-backup",
    sourceRoot, targetRoot, sourceHead, targetHead, mainRevision, capturedAt: new Date().toISOString(),
    counts, reviewCounts, rows, stagedSourcePaths: git(sourceRoot, ["diff", "--cached", "--name-only"]).trim(),
    stagedTargetPaths: git(targetRoot, ["diff", "--cached", "--name-only"]).trim() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const file = process.argv[2];
  if (!file) throw new Error("Pass the existing reconciliation inventory path");
  const inventory = JSON.parse(readFileSync(file, "utf8"));
  const reviewLedger = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], "utf8")) : undefined;
  const audit = captureAudit({ sourceRoot: inventory.sourceRoot, targetRoot: inventory.targetRoot,
    baseRevision: inventory.sourceHead, mainRevision: inventory.mainRevision ?? inventory.targetHead, reviewLedger });
  // Metadata only on stdout. No staging, source writes, remote access or migrations.
  console.log(JSON.stringify(audit, null, 2));
}
