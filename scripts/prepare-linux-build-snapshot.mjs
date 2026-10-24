import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve(".tmp/sibling-linux-check/linux-root/work");
const files = [...new Set(execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }).split("\0").filter(Boolean))];
const manifest = [];
for (const file of files) {
  if (/^(?:\.git\/|node_modules\/|worker\/node_modules\/|\.next\/|\.env(?:\.|$)|\.tools\/|\.tmp\/)/.test(file)) continue;
  if (/\.(?:aep|mp4|mov|webm|zip|7z|tar|gz)$/i.test(file) && file.startsWith("design/")) continue;
  let bytes; try { bytes = await readFile(file); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
  const target = path.resolve(output, file);
  if (!target.startsWith(output + path.sep)) throw new Error("Snapshot path escapes its root");
  await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes);
  manifest.push({ file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
// Build-only public configuration. No service credentials or private environment
// values are copied; actual hosted/authenticated acceptance stays separate.
const publicEnvironment = (await readFile(".env.local", "utf8")).split(/\r?\n/).filter(line => /^NEXT_PUBLIC_[A-Z0-9_]+=/.test(line));
await writeFile(path.join(output, ".env.production.local"), publicEnvironment.join("\n") + "\n");
await writeFile(path.resolve(".tmp/sibling-linux-check/source-manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), root: output, files: manifest, publicEnvironmentKeys: publicEnvironment.map(line => line.split("=")[0]), excluded: ["private/local environments", "node_modules and build output", "Git metadata", "ignored files", "design video/AE/archive binaries"] }, null, 2) + "\n");
console.log(JSON.stringify({ files: manifest.length, bytes: manifest.reduce((sum, file) => sum + file.bytes, 0), privateEnvironmentCopied: false }));
