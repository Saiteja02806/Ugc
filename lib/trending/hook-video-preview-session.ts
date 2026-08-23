import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  isHookVideoSourceKind,
  type HookVideoSourceKind,
} from "@/lib/trending/hook-video-types";

export const HOOK_VIDEO_PREVIEW_TTL_SECONDS = 5 * 60;

export function getHookVideoPreviewCookieName(videoId: string) {
  const videoKey = createHash("sha256")
    .update(videoId)
    .digest("hex")
    .slice(0, 20);

  return `ugc_hook_preview_${videoKey}`;
}

type HookVideoPreviewClaims = {
  exp: number;
  influencerId: string;
  sourceKind: HookVideoSourceKind;
  userId: string;
  videoId: string;
};

export function createHookVideoPreviewSession(params: {
  influencerId: string;
  sourceKind: HookVideoSourceKind;
  userId: string;
  videoId: string;
}) {
  const expiresAt = Date.now() + HOOK_VIDEO_PREVIEW_TTL_SECONDS * 1000;
  const claims: HookVideoPreviewClaims = {
    exp: expiresAt,
    influencerId: params.influencerId,
    sourceKind: params.sourceKind,
    userId: params.userId,
    videoId: params.videoId,
  };
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString(
    "base64url",
  );
  const signature = sign(encodedClaims);

  return {
    expiresAt: new Date(expiresAt).toISOString(),
    token: `${encodedClaims}.${signature}`,
  };
}

export function verifyHookVideoPreviewSession(
  token: string | undefined,
  expectedVideoId: string,
) {
  if (!token) {
    return null;
  }

  const [encodedClaims, suppliedSignature, extra] = token.split(".");

  if (!encodedClaims || !suppliedSignature || extra) {
    return null;
  }

  const expectedSignature = sign(encodedClaims);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const claims = JSON.parse(
      Buffer.from(encodedClaims, "base64url").toString("utf8"),
    ) as Partial<HookVideoPreviewClaims>;

    if (
      claims.videoId !== expectedVideoId ||
      typeof claims.userId !== "string" ||
      !claims.userId ||
      typeof claims.influencerId !== "string" ||
      !claims.influencerId ||
      !isHookVideoSourceKind(claims.sourceKind) ||
      typeof claims.exp !== "number" ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= Date.now()
    ) {
      return null;
    }

    return claims as HookVideoPreviewClaims;
  } catch {
    return null;
  }
}

export function hasHookVideoPreviewSecret() {
  return Boolean(getPreviewSecret());
}

function sign(value: string) {
  const secret = getPreviewSecret();

  if (!secret) {
    throw new Error("Hook video preview sessions are not configured.");
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function getPreviewSecret() {
  return (
    process.env.HOOK_VIDEO_PREVIEW_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}
