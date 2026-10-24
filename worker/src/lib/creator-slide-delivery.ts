import { createHmac, timingSafeEqual } from "node:crypto";
import { creatorSceneOrigin } from "./creator-scene-delivery.ts";

const PATTERN = /^\/api\/explore\/creator-slide-provider\/(creator-slideshow-\d{2})\/(slide-\d+-[a-f0-9]{12})\/([a-f0-9]{64})\.(jpg|png|webp)$/;
const TTL = 600;
function sign(path: string, expires: number) {
  const secret = process.env.CREATOR_REFERENCE_SIGNING_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error("Private creator delivery is not configured.");
  return createHmac("sha256", secret).update(`ugc-private-creator-slide:v1:${path}:${expires}`).digest("hex");
}
export function parseCreatorSlideUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (![creatorSceneOrigin(), "https://www.getugcpilot.com", "https://getugcpilot.com"].includes(url.origin) || url.username || url.password || url.hash) return null;
    const match = PATTERN.exec(url.pathname);
    return match ? { referenceId: match[1], slideId: match[2], sha256: match[3], extension: match[4], canonicalUrl: `${url.origin}${url.pathname}` } : null;
  } catch { return null; }
}
export function creatorSlideUrl(referenceId: string, slide: { id: string; sha256: string; extension: string }) {
  const value = `${creatorSceneOrigin()}/api/explore/creator-slide-provider/${referenceId}/${slide.id}/${slide.sha256}.${slide.extension}`;
  if (!parseCreatorSlideUrl(value)) throw new Error("Invalid private slide identity.");
  return value;
}
/** Trusted jobs keep canonical identities and refresh only their read capability. */
export function resolveCreatorSlideDelivery(value: string, now = Date.now()) {
  const identity = parseCreatorSlideUrl(value);
  if (!identity) return value;
  const url = new URL(identity.canonicalUrl), expires = Math.floor(now / 1000) + TTL;
  url.searchParams.set("expires", String(expires)); url.searchParams.set("signature", sign(url.pathname, expires));
  return url.toString();
}
export function verifyCreatorSlideDelivery(value: string, now = Date.now()) {
  const identity = parseCreatorSlideUrl(value);
  if (!identity) return null;
  const url = new URL(value), expires = Number(url.searchParams.get("expires")), token = url.searchParams.get("signature"), seconds = Math.floor(now / 1000);
  if (!Number.isSafeInteger(expires) || expires <= seconds || expires > seconds + TTL || !token || !/^[a-f0-9]{64}$/.test(token)) return null;
  try { return timingSafeEqual(Buffer.from(token,"hex"), Buffer.from(sign(url.pathname,expires),"hex")) ? identity : null; } catch { return null; }
}
