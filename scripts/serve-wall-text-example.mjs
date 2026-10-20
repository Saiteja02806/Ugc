// Serves only the generated example; never exposes the repository or credentials.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const directory = resolve("output/wall-text-shared-overlay");
createServer(async (req, res) => {
  try {
    const name = new URL(req.url, "http://localhost").pathname.slice(1) || "index.html";
    if (!/^[a-zA-Z0-9.-]+\.(html|png|mp4|json)$/.test(name)) { res.writeHead(404).end(); return; }
    const path = join(directory, name), info = await stat(path);
    const mime = { html: "text/html", png: "image/png", mp4: "video/mp4", json: "application/json" }[name.split(".").at(-1)];
    res.setHeader("Content-Type", mime); res.setHeader("Cache-Control", "no-store");
    // Local fault injection exercises the visible error state without deleting assets.
    if (name === "index.html" && new URL(req.url, "http://localhost").searchParams.get("fail") === "video") {
      const html = (await readFile(path, "utf8")).replaceAll('src="source.mp4"', 'src="missing.mp4"');
      res.end(html); return;
    }
    if (name === "index.html" && new URL(req.url, "http://localhost").searchParams.get("fail") === "1") {
      const html = (await readFile(path, "utf8")).replace(/fetch\('[a-f0-9]{64}\.png'\)/, "fetch('missing.png')");
      res.end(html); return;
    }
    res.setHeader("Accept-Ranges", "bytes");
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) { res.writeHead(416).end(); return; }
    if (range) { res.statusCode = 206; res.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`); }
    res.setHeader("Content-Length", end - start + 1);
    if (req.method === "HEAD") res.end(); else createReadStream(path, { start, end }).pipe(res);
  } catch { res.writeHead(404).end(); }
}).listen(8766, "127.0.0.1", () => console.log("http://127.0.0.1:8766"));
