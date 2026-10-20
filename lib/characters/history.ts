import { z } from "zod";
import type { CharacterHistoryImage } from "./types.ts";

const cursorSchema = z.object({ createdAt: z.iso.datetime({ offset: true }), id: z.uuid() }).strict();
export class CharacterHistoryCursorError extends Error {}

export function parseCharacterHistoryCursor(value: string | null) {
  if (value === null) return null;
  try { return cursorSchema.parse(JSON.parse(value)); }
  catch { throw new CharacterHistoryCursorError("Invalid history page. Open History again."); }
}

export function mergeCharacterHistoryPages(pages: readonly { images: CharacterHistoryImage[] }[]) {
  return [...new Map(pages.flatMap((page) => page.images).map((image) => [image.jobId, image])).values()];
}
