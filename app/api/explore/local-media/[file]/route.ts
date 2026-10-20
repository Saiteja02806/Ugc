import { readFile } from "node:fs/promises";
import path from "node:path";
import catalog from "@/lib/explore/imported-catalog.json";

export const runtime = "nodejs";

const allowedFiles = new Set(catalog.items.flatMap((item) => [
  item.posterFile,
  ...("videoFile" in item ? [item.videoFile] : []),
  ...item.slides.map((slide) => slide.file),
]));

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const { file } = await params;
  if (!/^[a-f0-9]{64}(?:-poster)?\.(jpg|jpeg|png|webp|mp4)$/.test(file) || !allowedFiles.has(file)) {
    return new Response(null, { status: 404 });
  }
  let data: Buffer;
  try {
    data = await readFile(path.join(process.cwd(), ".tmp", "explore-catalog", "media", file));
  } catch {
    return new Response(null, { status: 404 });
  }
  const types: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4" };
  const headers = new Headers({
    "Content-Type": types[path.extname(file)],
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    const start = match ? Number(match[1]) : NaN;
    const end = match?.[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
    if (!Number.isSafeInteger(start) || start < 0 || start >= data.length || end < start) {
      headers.set("Content-Range", `bytes */${data.length}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${data.length}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers });
  }
  headers.set("Content-Length", String(data.length));
  return new Response(new Uint8Array(data), { headers });
}
