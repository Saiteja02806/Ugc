import manifest from "./explore-emoji-manifest.json" with { type: "json" };

export const EXPLORE_EMOJI_PACK_FILE = `${manifest.version}.json.gz`;
export const EXPLORE_EMOJI_VERSION = `${manifest.version}-${manifest.packSha256.slice(0, 12)}`;
export const EXPLORE_EMOJI_PACK_SHA256 = manifest.packSha256;
export const EXPLORE_EMOJI_ATTRIBUTION = "Emoji artwork: Twemoji (Twitter, Inc. and other contributors), CC BY 4.0. https://github.com/jdecked/twemoji / https://creativecommons.org/licenses/by/4.0/";
const ids = new Set(manifest.ids);
export const isExploreEmojiId = (id: string) => ids.has(id);

/** Selectors affect presentation, never the stored/returned caption string. */
export function exploreEmojiId(value: string): string | undefined {
  if (value.includes("\ufe0e")) return undefined;
  const id = Array.from(value).filter(character => character !== "\ufe0f").map(character => character.codePointAt(0)!.toString(16)).join("-");
  return ids.has(id) ? id : undefined;
}
export const exploreEmojiUrl = (id: string) => `/api/explore/emoji/${EXPLORE_EMOJI_VERSION}/${id}`;

