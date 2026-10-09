import { createServer } from "node:http";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { join, resolve } from "node:path";
import { SubtitleError, parseStyle, parsePlacement } from "../../worker/dist/subtitles/contracts.js";
import { root, PILOT_MAX_BYTES, runPilotGeneration } from "./pipeline.mjs";

const idPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const terminal = new Set(["completed", "failed", "cancelled"]);
const assets = new Map([["/", ["index.html", "text/html; charset=utf-8"]], ["/client.js", ["client.js", "text/javascript; charset=utf-8"]], ["/styles.css", ["styles.css", "text/css; charset=utf-8"]]]);
const downloads = new Map([["video", ["captioned.mp4", "video/mp4"]], ["srt", ["captions.srt", "text/plain; charset=utf-8"]], ["vtt", ["captions.vtt", "text/vtt; charset=utf-8"]]]);

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(value));
}

function publicJob(job) {
  return { id: job.id, state: job.state, stage: job.stage, style: job.style, placement: job.placement,
    error: job.error, ...(job.state === "completed" ? { result: { wordCount: job.result.wordCount, durationMs: job.result.durationMs,
      elapsedMs: job.result.elapsedMs, transcriptionCacheHit: job.result.transcriptionCacheHit, alignmentCacheHit: job.result.alignmentCacheHit,
      preview: `/api/jobs/${job.id}/video`, download: `/api/jobs/${job.id}/video?download=1`, srt: `/api/jobs/${job.id}/srt`, vtt: `/api/jobs/${job.id}/vtt` } } : {}) };
}

async function serveFile(request, response, path, type, downloadName) {
  const size = (await stat(path)).size;
  let start = 0, end = size - 1, partial = false;
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
    if (!match || (!match[1] && !match[2])) { response.writeHead(416, { "Content-Range": `bytes */${size}` }); response.end(); return; }
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) { response.writeHead(416, { "Content-Range": `bytes */${size}` }); response.end(); return; }
    partial = true;
  }
  response.writeHead(partial ? 206 : 200, { "Content-Type": type, "Content-Length": end - start + 1, "Cache-Control": "no-store",
    "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", ...(partial ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
    ...(downloadName ? { "Content-Disposition": `attachment; filename="${downloadName}"` } : {}) });
  await pipeline(createReadStream(path, { start, end }), response);
}

export async function startSubtitlePilot({ port = 8780, dataDir = resolve(root, ".tmp/subtitle-pilot"), runner = runPilotGeneration,
  samplePath = resolve(root, ".tmp/subtitle-lab/user-video/source.mp4"), apiKey = process.env.OPENAI_API_KEY,
  python, modelDir, maxBytes = PILOT_MAX_BYTES, maxJobs = 20 } = {}) {
  await mkdir(join(dataDir, "jobs"), { recursive: true });
  const jobs = new Map();
  let active, origin, shuttingDown = false;
  const server = createServer((request, response) => { void handle(request, response).catch(error => {
    if (response.headersSent || response.destroyed) { response.destroy(); return; }
    json(response, error instanceof SubtitleError && error.code === "UPLOAD_TOO_LARGE" ? 413 : 400,
      { error: error instanceof SubtitleError ? { code: error.code, message: error.message } : { code: "REQUEST_FAILED", message: "The local request could not be completed." } });
  }); });
  server.requestTimeout = 90000;
  server.headersTimeout = 15000;

  async function handle(request, response) {
    // Exact Host prevents DNS rebinding. No CORS, arbitrary source paths, URLs,
    // shell commands or model settings are accepted from the browser.
    if (request.headers.host !== new URL(origin).host || (request.headers.origin && request.headers.origin !== origin)) {
      json(response, 403, { error: { code: "ORIGIN_REJECTED", message: "Open this pilot directly from its local URL." } }); return;
    }
    const url = new URL(request.url, origin);
    if (request.method === "POST" && (request.headers.origin !== origin || request.headers["x-subtitle-pilot"] !== "1")) {
      json(response, 403, { error: { code: "ORIGIN_REJECTED", message: "Generation must be requested from the local pilot page." } }); return;
    }
    if (request.method === "GET" && assets.has(url.pathname)) {
      const [name, type] = assets.get(url.pathname);
      response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; media-src 'self' blob:; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
      response.end(await readFile(new URL(name, import.meta.url))); return;
    }
    if (request.method === "GET" && url.pathname === "/api/config") {
      json(response, 200, { liveTranscriptionConfigured: !!apiKey?.trim(), maxBytes, maxDurationMs: 30000, sampleAvailable: !!samplePath && await stat(samplePath).then(s => s.isFile()).catch(() => false), activeJob: active ? publicJob(active) : null }); return;
    }
    if (request.method === "GET" && url.pathname === "/api/sample" && samplePath) {
      await serveFile(request, response, samplePath, "video/mp4"); return;
    }
    if (request.method === "POST" && url.pathname === "/api/jobs") {
      const id = request.headers["x-request-id"];
      if (typeof id !== "string" || !idPattern.test(id)) throw new SubtitleError("INVALID_REQUEST", "A valid request ID is required.");
      if (jobs.has(id)) { request.resume(); json(response, 200, publicJob(jobs.get(id))); return; }
      if (shuttingDown || active) { json(response, 409, { error: { code: "ALREADY_RUNNING", message: "A video is already generating. Wait for it to finish or stop it first." } }); return; }
      if (jobs.size >= maxJobs) { json(response, 409, { error: { code: "PILOT_SESSION_FULL", message: "This local pilot session is full. Review its outputs before starting another session." } }); return; }
      const style = parseStyle(url.searchParams.get("style") ?? "clean"), placement = parsePlacement(url.searchParams.get("placement") ?? "bottom");
      const length = Number(request.headers["content-length"]);
      if (!Number.isFinite(length) || length <= 0) throw new SubtitleError("VIDEO_INVALID", "Choose a nonempty video file.");
      if (length > maxBytes) throw new SubtitleError("UPLOAD_TOO_LARGE", "Choose a video smaller than 50 MB.");
      const directory = join(dataDir, "jobs", id);
      const job = { id, directory, style, placement, state: "uploading", stage: "uploading", controller: new AbortController() };
      // Reserve the session synchronously before any filesystem await, so two
      // simultaneous uploads cannot both pass the one-active-job check.
      jobs.set(id, job); active = job;
      try {
        await mkdir(directory);
        let received = 0;
        const limit = new Transform({ transform(chunk, _encoding, callback) {
          received += chunk.length;
          callback(received > maxBytes ? new SubtitleError("UPLOAD_TOO_LARGE", "Choose a video smaller than 50 MB.") : null, chunk);
        } });
        await pipeline(request, limit, createWriteStream(join(directory, "upload.mp4"), { flags: "wx", mode: 0o600 }), { signal: job.controller.signal });
        if (received !== length) throw new SubtitleError("UPLOAD_INCOMPLETE", "The video upload was incomplete. Choose the file again.");
        job.state = "running"; json(response, 202, publicJob(job));
        job.promise = execute(job);
      } catch (error) {
        job.state = job.controller.signal.aborted ? "cancelled" : "failed";
        job.error = { code: error instanceof SubtitleError ? error.code : "UPLOAD_FAILED", message: error instanceof SubtitleError ? error.message : "The video upload did not finish." };
        if (active === job) active = undefined;
        throw error;
      }
      return;
    }
    const match = /^\/api\/jobs\/([a-f0-9-]+)(?:\/(video|srt|vtt|cancel))?$/u.exec(url.pathname);
    if (match && idPattern.test(match[1])) {
      const job = jobs.get(match[1]);
      if (!job) { json(response, 404, { error: { code: "NOT_FOUND", message: "This local result is unavailable." } }); return; }
      if (request.method === "GET" && !match[2]) { json(response, 200, publicJob(job)); return; }
      if (request.method === "POST" && match[2] === "cancel") {
        if (!terminal.has(job.state)) { job.state = "cancelling"; job.controller.abort(); }
        json(response, 200, publicJob(job)); return;
      }
      if (request.method === "GET" && downloads.has(match[2]) && job.state === "completed") {
        const [name, type] = downloads.get(match[2]);
        await serveFile(request, response, join(job.directory, "generation/result", name), type,
          url.searchParams.get("download") === "1" || match[2] !== "video" ? name : undefined); return;
      }
    }
    json(response, 404, { error: { code: "NOT_FOUND", message: "This local result is unavailable." } });
  }

  async function execute(job) {
    try {
      job.result = await runner({ inputPath: join(job.directory, "upload.mp4"), jobDir: join(job.directory, "generation"), cacheDir: join(dataDir, "cache"),
        style: job.style, placement: job.placement, apiKey, python, modelDir, signal: job.controller.signal,
        onStage: stage => { job.stage = stage; } });
      if (job.controller.signal.aborted) job.state = "cancelled";
      else { job.state = "completed"; job.stage = "completed"; }
    } catch (error) {
      job.state = job.controller.signal.aborted ? "cancelled" : "failed";
      job.error = { code: error instanceof SubtitleError ? error.code : "GENERATION_FAILED", message: error instanceof SubtitleError ? error.message : "Subtitles could not be generated. The original video is still available." };
    } finally { if (active === job) active = undefined; }
  }

  await new Promise((accept, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", accept); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, server, jobs, async close() {
    shuttingDown = true;
    for (const job of jobs.values()) if (!terminal.has(job.state)) job.controller.abort();
    await Promise.allSettled([...jobs.values()].map(j => j.promise).filter(Boolean));
    await new Promise(accept => { server.close(accept); server.closeIdleConnections(); });
  } };
}
