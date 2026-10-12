import { readFile } from "node:fs/promises";
import path from "node:path";

/** Serves one fixed, generated QA fixture; unavailable in production. */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = new Uint8Array(await readFile(path.join(process.cwd(), ".tmp/workflow-final-preview.mp4"))); }
  catch { return new Response(null, { status: 404 }); }
  const headers = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "no-store" };
  const range = request.headers.get("Range");
  if (!range) return new Response(bytes, { headers: { ...headers, "Content-Length": String(bytes.length) } });
  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  const start = match ? Number(match[1]) : NaN;
  const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
  if (!Number.isSafeInteger(start) || start < 0 || start >= bytes.length || end < start) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${bytes.length}` } });
  return new Response(bytes.slice(start, end + 1), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${bytes.length}`, "Content-Length": String(end - start + 1) } });
}
