import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 10 * 60;
const PATH = /^\/api\/explore\/creator-scene\/(creator-account-[12]-0[1-6])\/explore\/hook-starting-frames\/v1\/([a-f0-9]{64})\/([a-f0-9]{64})\.png$/;
type Source = { referenceId: string; sourceSha256: string; sourceFrame: { sha256: string } };

export function creatorSceneOrigin() {
  const url = new URL(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.getugcpilot.com");
  if (url.username || url.password || url.protocol !== "https:") throw new Error("Creator scene delivery requires HTTPS.");
  return url.origin;
}

function signingKey() {
  // Domain separation keeps this capability separate from the existing server
  // credential. A dedicated shared secret can be configured independently.
  const secret = process.env.CREATOR_REFERENCE_SIGNING_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error("Creator scene delivery is not configured.");
  return createHmac("sha256", secret).update("ugc-private-creator-scene-signing:v1").digest();
}

function sign(path: string, expires: number) {
  return createHmac("sha256", signingKey()).update(`ugc-private-creator-scene:v1:${path}:${expires}`).digest("hex");
}

export function creatorSceneCanonicalUrl(source: Source) {
  const path = `/api/explore/creator-scene/${source.referenceId}/explore/hook-starting-frames/v1/${source.sourceSha256}/${source.sourceFrame.sha256}.png`;
  if (!PATH.test(path)) throw new Error("Invalid creator scene identity.");
  return `${creatorSceneOrigin()}${path}`;
}

/** Called only after validating the owned generation receipt. Persist the
 * canonical URL; sign immediately before provider submission on each attempt. */
export function resolveCreatorSceneDelivery(url: string, receipt: Source, now = Date.now()) {
  if (!receipt.referenceId.startsWith("creator-account-")) return url;
  const signed = new URL(url), canonical = new URL(creatorSceneCanonicalUrl(receipt));
  // Website and worker can use the two canonical production host aliases.
  // The frozen origin stays intact; arbitrary provider/third-party hosts fail.
  if (![creatorSceneOrigin(), "https://www.getugcpilot.com", "https://getugcpilot.com"].includes(signed.origin)
    || signed.pathname !== canonical.pathname || signed.search || signed.hash || signed.username || signed.password) throw new Error("Creator scene identity changed.");
  const expires = Math.floor(now / 1000) + TTL_SECONDS;
  signed.searchParams.set("expires", String(expires));
  signed.searchParams.set("signature", sign(signed.pathname, expires));
  return signed.toString();
}

/** The capability grants only one hash-bound PNG, never a source video or
 * catalogue. It expires and cannot authorize any other path or variant. */
export function verifyCreatorSceneDelivery(url: URL, now = Date.now()) {
  const match = PATH.exec(url.pathname), expires = Number(url.searchParams.get("expires")), signature = url.searchParams.get("signature");
  const seconds = Math.floor(now / 1000);
  if (!match || !Number.isSafeInteger(expires) || expires <= seconds || expires > seconds + TTL_SECONDS || !signature || !/^[a-f0-9]{64}$/.test(signature)) return null;
  try {
    if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(url.pathname, expires), "hex"))) return null;
    return { referenceId: match[1], sourceSha256: match[2], frameSha256: match[3] };
  } catch { return null; }
}
