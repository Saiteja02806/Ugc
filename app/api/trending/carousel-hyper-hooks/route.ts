import { NextResponse } from "next/server";

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
    await requireFirebaseUser(request);
    const origin = new URL(request.url).origin;

    return NextResponse.json(
      {
        assets: CAROUSEL_HYPER_HOOK_ASSETS.map((entry) => ({
          height: entry.height,
          id: entry.id,
          name: entry.name,
          url: getCarouselHyperHookAssetUrl(entry, origin),
          width: entry.width,
        })),
        folder: {
          ...CAROUSEL_HYPER_HOOK_FOLDER,
          assetCount: CAROUSEL_HYPER_HOOK_ASSETS.length,
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
