import "server-only";

import { getSocialConnectionProfileForOwner } from "@/lib/social/oauth";
import type { SocialPlatform } from "@/lib/social/types";

const MAX_PICTURE_BYTES = 1_048_576;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const hosts: Partial<Record<SocialPlatform, string[]>> = {
  instagram: ["cdninstagram.com", "fbcdn.net"],
  tiktok: ["tiktokcdn.com", "tiktokcdn-us.com", "tiktokcdn-eu.com", "tiktok.com", "tiktokv.com", "byteoversea.com", "ibytedtos.com"],
};

function allowedUrl(value: string, platform: SocialPlatform) {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password &&
    (!url.port || url.port === "443") && hosts[platform]?.some(host =>
      url.hostname === host || url.hostname.endsWith(`.${host}`));
}

async function downloadPicture(value: string, platform: SocialPlatform) {
  // Validate every redirect; this endpoint accepts only an owned provider URL.
  let url = value;
  const signal = AbortSignal.timeout(8_000);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (!allowedUrl(url, platform)) throw new Error("Unsupported profile image host.");
    const response = await fetch(url, { cache: "no-store", redirect: "manual", signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Missing profile image redirect.");
      url = new URL(location, url).toString();
      continue;
    }
    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!response.ok || !contentType || !imageTypes.has(contentType) ||
        Number(response.headers.get("content-length")) > MAX_PICTURE_BYTES) {
      await response.body?.cancel();
      throw new Error("Profile image is unavailable.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty profile image.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PICTURE_BYTES) throw new Error("Profile image is too large.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    if (!size) throw new Error("Empty profile image.");
    return { bytes: Buffer.concat(chunks), contentType };
  }
  throw new Error("Too many profile image redirects.");
}

export async function getSocialProfilePictureForOwner(params: { connectionId: string; userId: string }) {
  const profile = await getSocialConnectionProfileForOwner(params);
  if (!profile?.profilePictureUrl || !hosts[profile.platform]) return null;
  try {
    return await downloadPicture(profile.profilePictureUrl, profile.platform);
  } catch {
    // A signed CDN URL can stop working before its scheduled profile refresh.
    const renewed = await getSocialConnectionProfileForOwner({ ...params, force: true });
    if (!renewed?.profilePictureUrl || renewed.profilePictureUrl === profile.profilePictureUrl) return null;
    return downloadPicture(renewed.profilePictureUrl, renewed.platform);
  }
}
