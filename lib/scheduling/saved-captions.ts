import { z } from "zod";

export const MAX_SAVED_CAPTIONS = 20;
export const POST_CAPTION_MAX_LENGTH = 5000;
const CaptionSchema = z.strictObject({ id: z.string().uuid(), text: z.string().max(POST_CAPTION_MAX_LENGTH).refine(value => Boolean(value.trim()), "Write a caption before saving.") });
const ContentsSchema = z.strictObject({ captions: z.array(CaptionSchema).max(MAX_SAVED_CAPTIONS), defaultId: z.string().uuid().nullable() }).superRefine((value, ctx) => {
  if (new Set(value.captions.map(caption => caption.id)).size !== value.captions.length || new Set(value.captions.map(caption => caption.text)).size !== value.captions.length) ctx.addIssue({ code: "custom", message: "This caption is already saved." });
  if (value.defaultId && !value.captions.some(caption => caption.id === value.defaultId)) ctx.addIssue({ code: "custom", message: "Choose an existing saved caption as the default." });
});
export const SavedCaptionLibrarySchema = ContentsSchema.safeExtend({ revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) });
export type SavedCaptionLibrary = z.infer<typeof SavedCaptionLibrarySchema>;
export type SavedCaption = SavedCaptionLibrary["captions"][number];
export const EMPTY_CAPTION_LIBRARY: SavedCaptionLibrary = { revision: 0, captions: [], defaultId: null };
export const parseSavedCaptionLibrary = (value: unknown) => SavedCaptionLibrarySchema.parse(value);

export function addSavedCaption(library: SavedCaptionLibrary, text: string, id: string): SavedCaptionLibrary {
  if (library.captions.some(caption => caption.text === text)) return library;
  if (!text.trim()) throw new Error("Write a caption before saving.");
  if (text.length > POST_CAPTION_MAX_LENGTH) throw new Error("Use up to 5,000 characters in a saved caption.");
  if (library.captions.length >= MAX_SAVED_CAPTIONS) throw new Error("You have 20 saved captions. Delete one to save another.");
  return parseSavedCaptionLibrary({ ...library, captions: [...library.captions, { id, text }], defaultId: library.captions.length ? library.defaultId : id });
}
export function removeSavedCaption(library: SavedCaptionLibrary, id: string): SavedCaptionLibrary {
  return { ...library, captions: library.captions.filter(caption => caption.id !== id), defaultId: library.defaultId === id ? null : library.defaultId };
}
/** Existing copy and deliberate blank captions always take precedence over defaults. */
export function initialSavedCaption(library: SavedCaptionLibrary, value: string, initialized: boolean): string | null {
  if (initialized || value.length) return null;
  return library.captions.find(caption => caption.id === library.defaultId)?.text ?? "";
}
