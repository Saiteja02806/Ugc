import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET() {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  // Exact allowlisted local review asset; no request path is read from the user.
  const bytes = await readFile(join(process.cwd(), "outputs/hook-motion-rewrite-2026-10-21/a/013/frame-001.jpg"));
  return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
}
