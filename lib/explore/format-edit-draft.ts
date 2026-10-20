import { parseExploreFormatEdit, type ExploreFormatEdit } from "../../worker/src/lib/explore-format-edit.ts";

/** Empty UI blocks are draft state, never render requests. Preserve old receipts. */
export function prepareFormatEditForExport(edit: ExploreFormatEdit): ExploreFormatEdit {
  if (!edit.textOverlays?.some(text => !text.value.trim())) return edit;
  const textOverlays = edit.textOverlays.filter(text => text.value.trim());
  if (textOverlays.length) return { ...edit, textOverlays };
  const result: ExploreFormatEdit = { ...edit, text: null };
  delete result.textOverlays;
  return result;
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const unsafeText = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u;

/** Apply the export parser's complete rules while retaining local empty blocks. */
export function readFormatEditDraft(value: unknown): ExploreFormatEdit {
  if (!record(value) || !Array.isArray(value.textOverlays)) return parseExploreFormatEdit(value);
  const blanks = new Map<number, string>();
  const textOverlays = value.textOverlays.map((text: unknown, index: number) => {
    if (!record(text) || typeof text.value !== "string" || text.value.trim()) return text;
    // Replacing blank text must not conceal oversized strings or control chars.
    if (text.value.length > 600 || unsafeText.test(text.value)) throw new Error("Choose valid text, position, and timing within your trimmed video.");
    blanks.set(index, text.value);
    return { ...text, value: "Draft text" };
  });
  const parsed = parseExploreFormatEdit({ ...value, textOverlays });
  if (!blanks.size) return parsed;
  return { ...parsed, textOverlays: parsed.textOverlays!.map((text, index) => blanks.has(index) ? { ...text, value: blanks.get(index)! } : text) };
}
