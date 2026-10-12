import { z } from "zod";
import { normalizeEditableVideoDraftInput, type EditableVideoDraftInput } from "./video-library";

export const editDraftRevision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const editDraftInput = z.strictObject({
  trimStartSeconds: z.number().nonnegative(),
  trimEndSeconds: z.number().nonnegative().nullable(),
  textOverlays: z.array(z.strictObject({
    id: z.string().min(1).max(96), position: z.enum(["top", "middle", "bottom"]),
    style: z.enum(["clean", "minimal", "bubble"]), text: z.string().max(100),
  })).max(3),
}).superRefine((draft, ctx) => {
  if (draft.trimEndSeconds !== null && draft.trimEndSeconds <= draft.trimStartSeconds)
    ctx.addIssue({ code: "custom", message: "The trim end must follow the trim start." });
  if (new Set(draft.textOverlays.map(item => item.position)).size !== draft.textOverlays.length ||
      new Set(draft.textOverlays.map(item => item.id)).size !== draft.textOverlays.length)
    ctx.addIssue({ code: "custom", message: "Use unique text blocks and positions." });
});

export class EditDraftError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}

export function parseEditDraft(value: unknown, duration?: number | null): EditableVideoDraftInput {
  const parsed = editDraftInput.safeParse(value);
  if (!parsed.success) throw new EditDraftError("INVALID_DRAFT", "Review the trim range and the three supported text blocks (up to 100 characters each).");
  if (typeof duration === "number" && duration > 0 &&
      (parsed.data.trimStartSeconds >= duration || (parsed.data.trimEndSeconds !== null && parsed.data.trimEndSeconds > duration + .05)))
    throw new EditDraftError("INVALID_DRAFT", "Keep the trim range inside the source video.");
  return normalizeEditableVideoDraftInput(parsed.data)!;
}
