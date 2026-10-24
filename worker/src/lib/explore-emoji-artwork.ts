import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { EXPLORE_EMOJI_PACK_FILE, EXPLORE_EMOJI_PACK_SHA256, isExploreEmojiId } from "./explore-emoji.ts";

const packs = new Map<string, Promise<Record<string, string>>>();
/** Both preview HTTP and FFmpeg PNG generation read this identical pinned pack. */
export async function readExploreEmojiArtwork(id: string, assetsDir: string) {
  if (!isExploreEmojiId(id)) throw new Error("Choose a supported emoji.");
  const path = join(assetsDir, EXPLORE_EMOJI_PACK_FILE);
  let pending = packs.get(path);
  if (!pending) {
    pending = readFile(path).then(bytes => {
      if (createHash("sha256").update(bytes).digest("hex") !== EXPLORE_EMOJI_PACK_SHA256) throw new Error("The packaged emoji artwork could not be verified.");
      return JSON.parse(gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }).toString()) as Record<string, string>;
    }).catch(error => { packs.delete(path); throw error; });
    packs.set(path, pending);
  }
  const svg = (await pending)[id];
  if (typeof svg !== "string" || !svg.startsWith("<svg ")) throw new Error("The packaged emoji artwork is missing.");
  return svg;
}

