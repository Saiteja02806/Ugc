import { NextResponse } from "next/server";
import { getCarouselGenerationStatus, listActiveCarouselCategoryHooks } from "@/lib/carousel/db";
import { resolveCarouselImageLibraryCategory } from "@/lib/carousel/image-library-category";
import { mergeCarouselHookChoices } from "@/lib/carousel/hook-choices";

import {
  CAROUSEL_HYPER_HOOK_ASSETS,
  CAROUSEL_HYPER_HOOK_FOLDER,
  getCarouselHyperHookAssetUrl,
} from "@/lib/carousel/hyper-hook-library";
import {
  FirebaseAuthRequestError,
  requireFirebaseUser,
} from "@/lib/firebase/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseUser(request);
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const carouselId = requestUrl.searchParams.get("carouselId");
    let categoryHooks: Awaited<ReturnType<typeof listActiveCarouselCategoryHooks>> = [];
    if (carouselId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(carouselId)) {
        return NextResponse.json({ ok: false, error: "Choose a valid Carousel." }, { status: 400 });
      }
      const status = await getCarouselGenerationStatus(carouselId);
      if (!status || status.generation.userId !== user.uid || status.generation.status !== "completed") {
        return NextResponse.json({ ok: false, error: "This Carousel is not available." }, { status: 404 });
      }
      categoryHooks = await listActiveCarouselCategoryHooks(
        resolveCarouselImageLibraryCategory({ categorySlug: status.generation.categorySlug }),
      );
    }
    const assets = mergeCarouselHookChoices(
      categoryHooks,
      CAROUSEL_HYPER_HOOK_ASSETS.map(entry => ({
        ...entry, url: getCarouselHyperHookAssetUrl(entry, origin),
      })),
    );

    return NextResponse.json(
      {
        assets,
        folder: {
          ...CAROUSEL_HYPER_HOOK_FOLDER,
          assetCount: assets.length,
        },
        ok: true,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError) {
      return NextResponse.json(
        { error: error.message, ok: false },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Could not load Hyper Hooks.", ok: false },
      { status: 500 },
    );
  }
}
