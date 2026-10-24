import { readFile } from "node:fs/promises";
import path from "node:path";
import release from "@/worker/src/lib/explore-hook-reference-addition-release.json";

/** One fixed local track for the development-only music layout fixture. */
export async function GET() {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const item = release.items.find(value => value.title === "Hook 61");
  if (!item) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), ".tmp/explore-paired-references/media", path.basename(item.audioStorageKey)));
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
