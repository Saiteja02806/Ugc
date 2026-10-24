import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.join(root, "outputs", "hook-motion-rewrite-2026-10-21");
const homePath = "/outputs/hook-motion-rewrite-2026-10-21/index.html";

/** Only the exact prepared review page, source videos and sheets are readable. */
export async function createHookReviewServer() {
  const summary = JSON.parse(await readFile(path.join(directory, "review-summary.json"), "utf8"));
  if (!Array.isArray(summary.entries) || summary.entries.length !== 98) throw Error("Build the complete local review page first.");
  const allowed = new Map();
  const publicPath = value => `/${path.relative(root, value).split(path.sep).map(encodeURIComponent).join("/")}`;
  for (const name of [path.join(directory, "index.html"), ...summary.entries.flatMap(item => [item.sourcePath, item.contactSheet])]) {
    const resolved = await realpath(name), relative = path.relative(root, resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !/\.(?:html|mp4|jpg|png)$/i.test(resolved)) {
      throw Error("Unexpected review file.");
    }
    allowed.set(publicPath(path.resolve(name)), resolved);
  }
  return createServer(async (request, response) => {
    const reply = (status, message, extra = {}) => { response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(message); };
    const host = request.headers.host ?? "";
    if (!/^(?:127\.0\.0\.1|localhost):\d+$/.test(host)) return reply(403, "Local review only.");
    if (!["GET", "HEAD"].includes(request.method ?? "")) return reply(405, "Read-only review.", { Allow: "GET, HEAD" });
    let url;
    try { url = new URL(request.url, `http://${host}`); } catch { return reply(400, "Invalid request."); }
    if (url.host !== host || url.search) return reply(404, "Not found.");
    if (url.pathname === "/") { response.writeHead(302, { Location: homePath, "Cache-Control": "no-store" }); response.end(); return; }
    const file = allowed.get(url.pathname);
    if (!file) return reply(404, "Not found.");
    try {
      const meta = await stat(file);
      if (!meta.isFile()) return reply(404, "Not found.");
      let start = 0, end = meta.size - 1, code = 200;
      if (request.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
        if (!match) return reply(416, "Invalid range.", { "Content-Range": `bytes */${meta.size}` });
        start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= meta.size) {
          return reply(416, "Invalid range.", { "Content-Range": `bytes */${meta.size}` });
        }
        code = 206;
      }
      const mime = file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".mp4") ? "video/mp4" : file.endsWith(".png") ? "image/png" : "image/jpeg";
      response.writeHead(code, { "Content-Type": mime, "Content-Length": end - start + 1, "Accept-Ranges": "bytes",
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        ...(code === 206 ? { "Content-Range": `bytes ${start}-${end}/${meta.size}` } : {}) });
      if (request.method === "HEAD") { response.end(); return; }
      const stream = createReadStream(file, { start, end });
      response.once("close", () => stream.destroy());
      stream.once("error", () => response.destroy()); stream.pipe(response);
    } catch { if (response.headersSent) response.destroy(); else reply(404, "Not found."); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 8188);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw Error("Choose a local port between 1024 and 65535.");
  const server = await createHookReviewServer();
  server.on("error", error => { console.error(`Local review could not start: ${error.code ?? error.message}`); process.exitCode = 1; });
  server.listen(port, "127.0.0.1", () => console.log(`Hook review ready: http://127.0.0.1:${port}${homePath}`));
}
