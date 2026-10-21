import { join } from "node:path";
import { EXPLORE_EMOJI_VERSION, isExploreEmojiId } from "@/worker/src/lib/explore-emoji";
import { readExploreEmojiArtwork } from "@/worker/src/lib/explore-emoji-artwork";

export const runtime = "nodejs";

/** Public immutable application artwork, never customer text or an external URL. */
export async function GET(_request: Request, context: { params: Promise<{ version: string; id: string }> }) {
  const { version, id } = await context.params;
  if (version !== EXPLORE_EMOJI_VERSION || !isExploreEmojiId(id)) return new Response(null, { status: 404 });
  try {
    const svg = await readExploreEmojiArtwork(id, join(process.cwd(), "worker/src/assets/emoji"));
    return new Response(svg, { headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Link": '</licenses/explore-emoji.txt>; rel="license"',
    } });
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
