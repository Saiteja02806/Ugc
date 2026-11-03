import { studioCatalogUrl } from "@/lib/characters/studio-catalog";

/** Preserve saved public catalog links without retaining the original binary files in the website. */
export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await params;
  try {
    const url = studioCatalogUrl(`/explore/influencer-studio/${asset.join("/")}`);
    return new Response(null, { status: 308, headers: { Location: url, "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
