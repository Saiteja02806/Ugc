import type { NextRequest } from "next/server";

import { getStorageObject } from "@/lib/storage/storage";
import {
  HOOK_VIDEO_PREVIEW_COOKIE,
  verifyHookVideoPreviewSession,
} from "@/lib/trending/hook-video-preview-session";
import { resolveHookVideoSource } from "@/lib/trending/hook-video-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const claims = verifyHookVideoPreviewSession(
    request.cookies.get(HOOK_VIDEO_PREVIEW_COOKIE)?.value,
    videoId,
  );

  if (!claims) {
    return new Response("Preview session expired.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const range = request.headers.get("range")?.trim() || undefined;

  if (range && !/^bytes=\d*-\d*$/.test(range)) {
    return new Response("Unsupported range.", {
      status: 416,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const source = await resolveHookVideoSource({
      influencerId: claims.influencerId,
      sourceKind: claims.sourceKind,
      userId: claims.userId,
      videoId: claims.videoId,
    });
    const object = await getStorageObject({ key: source.storageKey, range });

    if (!object.Body) {
      return new Response("Preview unavailable.", { status: 404 });
    }

    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Type": object.ContentType || source.mimeType,
    });

    if (object.ContentLength !== undefined) {
      headers.set("Content-Length", String(object.ContentLength));
    }

    if (object.ContentRange) {
      headers.set("Content-Range", object.ContentRange);
    }

    return new Response(object.Body.transformToWebStream(), {
      headers,
      status: range ? 206 : 200,
    });
  } catch (error) {
    console.error("Could not stream protected Hook video preview:", error);
    return new Response("Preview unavailable.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
