import { type NextRequest, NextResponse } from "next/server";

import { normalizeCategorySlug } from "@/lib/carousel/category-resolver";
import {
  getCategoryImageAssetReadiness,
  getMissingCarouselSupabaseEnvVars,
  type CategoryImageAssetSample,
} from "@/lib/carousel/supabase";

export const runtime = "nodejs";

const DEFAULT_CATEGORY_SLUG = "productivity-saas";
const DEFAULT_SAMPLE_LIMIT = 8;
const MIN_READY_FOR_CAROUSEL = 6;
const URL_CHECK_TIMEOUT_MS = 5_000;

type UrlCheck = {
  assetId: string;
  error: string | null;
  ok: boolean;
  status: number | null;
  type: "base" | "thumb";
  url: string;
};

function getSampleLimit(value: string | null) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return DEFAULT_SAMPLE_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(numberValue), 1), 20);
}

function shouldVerifyUrls(value: string | null) {
  return value === "1" || value === "true";
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function checkUrl(params: {
  assetId: string;
  type: UrlCheck["type"];
  url: string;
}): Promise<UrlCheck> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(params.url, {
      cache: "no-store",
      method: "HEAD",
      signal: controller.signal,
    });

    return {
      assetId: params.assetId,
      error: null,
      ok: response.ok,
      status: response.status,
      type: params.type,
      url: params.url,
    };
  } catch {
    return {
      assetId: params.assetId,
      error: "URL check failed.",
      ok: false,
      status: null,
      type: params.type,
      url: params.url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkAssetUrls(assets: CategoryImageAssetSample[]) {
  return Promise.all(
    assets.flatMap((asset) => [
      checkUrl({
        assetId: asset.id,
        type: "base",
        url: asset.baseUrl,
      }),
      ...(asset.thumbUrl
        ? [
            checkUrl({
              assetId: asset.id,
              type: "thumb" as const,
              url: asset.thumbUrl,
            }),
          ]
        : []),
    ]),
  );
}

export async function GET(request: NextRequest) {
  const missingRuntimeEnv = getMissingCarouselSupabaseEnvVars();

  if (missingRuntimeEnv.length > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Category image status is not configured. Add ${missingRuntimeEnv.join(
          ", ",
        )} in server environment variables.`,
      },
      501,
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const categorySlug = normalizeCategorySlug(
    searchParams.get("categorySlug") ?? DEFAULT_CATEGORY_SLUG,
  );
  const sampleLimit = getSampleLimit(searchParams.get("limit"));
  const verifyUrls = shouldVerifyUrls(searchParams.get("verifyUrls"));

  try {
    const readiness = await getCategoryImageAssetReadiness({
      categorySlug,
      sampleLimit,
    });
    const urlChecks = verifyUrls ? await checkAssetUrls(readiness.assets) : [];

    return jsonResponse({
      ok: true,
      categorySlug,
      counts: readiness.counts,
      hasEnoughForCarousel: readiness.counts.ready >= MIN_READY_FOR_CAROUSEL,
      requiredReadyForCarousel: MIN_READY_FOR_CAROUSEL,
      sampleLimit,
      assets: readiness.assets,
      urlChecks,
    });
  } catch (error) {
    console.error("Failed to read category image status:", error);

    return jsonResponse(
      {
        ok: false,
        message: "Could not read category image status right now.",
      },
      500,
    );
  }
}

