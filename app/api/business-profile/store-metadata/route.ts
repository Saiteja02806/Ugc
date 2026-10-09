import { resolveStoreProductMetadata } from "@/lib/business-profiles/store-product-metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sourceUrl = new URL(request.url).searchParams.get("sourceUrl") ?? undefined;

  try {
    const product = await resolveStoreProductMetadata(sourceUrl);
    return Response.json(
      { ok: true, product },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    console.warn("Could not resolve store product metadata", error);
    return Response.json(
      { ok: true, product: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
