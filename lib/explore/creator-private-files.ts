import "server-only";
import { createDecipheriv, hkdfSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Plain imports are local review material. Releases contain authenticated ciphertext only. */
export function readCreatorPrivateFile(relativePath: string): Buffer {
  if (!/^(?:creator-(?:accounts|account-reviews|middle-frame-prompts|slideshows|slide-text)\.json|creator-(?:account|slideshow)-media\/[a-f0-9]{64}\.(?:png|mp4|jpg|webp))$/.test(relativePath)) throw new Error("Unknown creator package path.");
  const plain = join(process.cwd(), "lib/explore", relativePath);
  if (process.env.NODE_ENV !== "production" && existsSync(plain)) return readFileSync(plain);
  const secret = process.env.CREATOR_PRIVATE_PACKAGE_KEY?.trim();
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw new Error("Private creator package is not configured.");
  const encrypted = readFileSync(plain + ".enc");
  if (encrypted.length < 32 || encrypted.subarray(0, 4).toString() !== "UCP1") throw new Error("Invalid creator package.");
  const key = Buffer.from(hkdfSync("sha256", Buffer.from(secret, "hex"), "ugc-creator-private-package-v1", relativePath, 32));
  const decipher = createDecipheriv("aes-256-gcm", key, encrypted.subarray(4, 16));
  decipher.setAAD(Buffer.from(relativePath));
  decipher.setAuthTag(encrypted.subarray(16, 32));
  return Buffer.concat([decipher.update(encrypted.subarray(32)), decipher.final()]);
}

export function readCreatorPrivateJson<T>(relativePath: string, empty: T): T {
  const local = process.env.NODE_ENV !== "production" && existsSync(join(process.cwd(), "lib/explore", relativePath));
  // An older deployed package lacks only the newly assigned prompt file. Keep
  // unrelated galleries/routes readable; full-recreation admission rejects a
  // missing assignment before billing rather than using a later pose silently.
  if (relativePath === "creator-middle-frame-prompts.json" && !local && !existsSync(join(process.cwd(), "lib/explore", relativePath + ".enc"))) return empty;
  // Public-clone tests and builds have no customer package key. Collections stay absent.
  if (!local && !process.env.CREATOR_PRIVATE_PACKAGE_KEY?.trim()) return empty;
  return JSON.parse(readCreatorPrivateFile(relativePath).toString("utf8")) as T;
}

export type CreatorFrame = {index: number; timeSeconds: number; sha256: string; width: number; height: number; bytes: number; reviewNote: string};
export type CreatorVideo = {id: string; sourceFile: string; sourceSha256: string; posterSha256: string; width: number; height: number; durationSeconds: number; videoBytes: number; posterBytes: number; startingFrame: CreatorFrame};
export type CreatorCatalog = {version: number; accounts: {id: string; label: string; items: CreatorVideo[]}[]};
export type CreatorReviews = {reviewedAt: string; method: string; items: {id: string; caption: string; directions: string; sourceSha256: string; selectedFrameDirections: string; selectedFrameSha256: string}[]};
export type CreatorSlide = {id: string; sourceFile: string; sha256: string; width: number; height: number; bytes: number; extension: "jpg" | "webp" | "png"; contentType: string};
export type CreatorSlideshows = {version: number; id: string; label: string; items: {id: string; sourceFolder: string; title: string; sourceUrl?: string; slides: CreatorSlide[]}[]};
