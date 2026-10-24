import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

// Measure emitted initial Settings JS, not source size. Includes framework root
// scripts plus SettingsWorkspace's client-reference dependency chunks. Async
// sections are counted only if emitted in this initial reference's chunk list.
const build = path.resolve(process.argv[2] ?? ".next");
const context = { globalThis: {} };
vm.runInNewContext(readFileSync(path.join(build, "server/app/settings/page_client-reference-manifest.js"), "utf8"), context);
const manifest = context.globalThis.__RSC_MANIFEST["/settings/page"];
const entry = Object.entries(manifest.clientModules).find(([name]) => name.replaceAll("\\", "/").endsWith("/components/settings/settings-workspace.tsx"))?.[1];
if (!entry?.chunks?.length) throw new Error("Missing built SettingsWorkspace client reference chunks");
const rootFiles = JSON.parse(readFileSync(path.join(build, "build-manifest.json"), "utf8")).rootMainFiles;
const files = [...new Set([...rootFiles, ...entry.chunks.filter(value => value.endsWith(".js"))])].map(file => {
  const bytes = readFileSync(path.join(build, file));
  return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
});
const html = readFileSync(path.join(build, "server/app/settings.html"), "utf8");
const htmlFiles = [...new Set([...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]).filter(src => src.endsWith(".js")))].map(src => {
  if (!src.startsWith("/_next/")) throw new Error(`Unexpected script source ${src}`);
  const file = src.slice("/_next/".length), bytes = readFileSync(path.join(build, file));
  return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
});
const loadablePath = path.join(build, "react-loadable-manifest.json");
const loadable = existsSync(loadablePath) ? JSON.parse(readFileSync(loadablePath, "utf8")) : {};
const initialNames = new Set(htmlFiles.map(file => file.file));
const deferredSections = Object.entries(loadable).filter(([name]) => name.replaceAll("\\", "/").includes("components/settings/settings-workspace.tsx -> ")).map(([name, entry]) => {
  const files = [...new Set(entry.files.filter(file => file.endsWith(".js")))].map(file => {
    const bytes = readFileSync(path.join(build, file));
    return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, alreadyInitial: initialNames.has(file) };
  });
  return { module: name, files, incrementalBytes: files.filter(file => !file.alreadyInitial).reduce((n, file) => n + file.bytes, 0), incrementalGzipBytes: files.filter(file => !file.alreadyInitial).reduce((n, file) => n + file.gzipBytes, 0) };
});
const result = { buildId: readFileSync(path.join(build, "BUILD_ID"), "utf8").trim(), measuredAt: new Date().toISOString(), method: "SettingsWorkspace client-reference chunks plus rootMainFiles; gzip per file; excludes async sections, CSS, fonts and browser cache", files, totalBytes: files.reduce((n, file) => n + file.bytes, 0), totalGzipBytes: files.reduce((n, file) => n + file.gzipBytes, 0), initialHtmlScripts: { method: "Deduplicated external .js script srcs in built settings.html; emitted file sizes and per-file gzip estimates, not measured wire bytes", files: htmlFiles, totalBytes: htmlFiles.reduce((n, file) => n + file.bytes, 0), totalGzipBytes: htmlFiles.reduce((n, file) => n + file.gzipBytes, 0) }, deferredSections };
if (process.argv[3]) { const out = path.resolve(process.argv[3]); mkdirSync(path.dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(result, null, 2) + "\n"); }
console.log(JSON.stringify(result, null, 2));
