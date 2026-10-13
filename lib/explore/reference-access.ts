import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getRecreateReferences } from "./recreate-catalog";
import { getReferenceText } from "./reference-text-store";

export class ReferenceAccessError extends Error {
  constructor(public code: "INVALID_CURSOR" | "NOT_FOUND" | "INVALID_INPUT", message: string) { super(message); }
}
const cursorSchema = z.strictObject({ version: z.literal(1), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), offset: z.number().int().nonnegative() });
type Format = "hook" | "wall_text" | "slideshow";
export function listExploreReferences(input: { format?: Format; query?: string; category?: string; limit: number; cursor?: string }) {
  const query = input.query?.normalize("NFKC").trim().toLowerCase() ?? "";
  const category = input.category ?? null;
  const items = getRecreateReferences().filter(item => (!input.format || item.format === input.format)
    && (!category || item.category === category) && (!query || [item.id,item.title,item.category,item.categoryLabel].join(" ").normalize("NFKC").toLowerCase().includes(query)));
  const fingerprint = createHash("sha256").update(JSON.stringify({ format: input.format ?? null, query, category, items })).digest("hex");
  let offset = 0;
  if (input.cursor) {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(input.cursor)) throw Error();
      const cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor,"base64url").toString("utf8")));
      if (cursor.fingerprint !== fingerprint || cursor.offset > items.length) throw Error();
      offset = cursor.offset;
    } catch { throw new ReferenceAccessError("INVALID_CURSOR", "This reference cursor belongs to different filters or a changed catalogue. Start from the first page."); }
  }
  const next = offset + input.limit;
  return { items: items.slice(offset,next), total: items.length, next_cursor: next < items.length
    ? Buffer.from(JSON.stringify({ version:1, fingerprint, offset:next })).toString("base64url") : null };
}
export function getExploreReference(referenceId: string, slideId: string | null) {
  const reference = getRecreateReferences().find(item => item.id === referenceId);
  if (!reference) throw new ReferenceAccessError("NOT_FOUND", "Choose an available application reference.");
  if (reference.format === "slideshow" && slideId === null) return { reference, source:null, text_status:"slide_required" as const };
  if (reference.format !== "slideshow" && slideId !== null || reference.format === "slideshow" && !reference.slides.some(item => item.id === slideId))
    throw new ReferenceAccessError("INVALID_INPUT", "Choose a slide belonging to this reference; video references do not accept a slide.");
  try {
    const source = getReferenceText(referenceId,slideId,reference.format);
    return { reference, source, text_status:source?.status ?? "not_prepared" as const };
  } catch { return { reference, source:null, text_status:"unavailable" as const }; }
}
