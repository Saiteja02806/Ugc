import { z } from "zod";
import { ReferenceTextSchema, RemixRequestSchema, remixSourceMatches, isWallHeadingBodySource } from "./reference-text";

const DraftSchema = RemixRequestSchema.extend({
  version: z.literal(1), outcome: z.enum(["uncertain", "failed", "completed"]), source: ReferenceTextSchema.optional(),
  // Empty fields are valid unfinished edits; application still validates nonempty copy.
  reviewedDraft: z.object({ blocks: z.array(z.string().max(6000)).max(20), heading: z.string().max(180), body: z.string().max(6000) }).strict().optional(),
}).strict().refine(value => value.outcome !== "completed" || Boolean(value.source && value.reviewedDraft))
  .refine(value => !value.source || remixSourceMatches(value.source, value, value.format ?? value.source.format))
  .refine(value => !value.reviewedDraft || value.source?.format === "wall_text" || value.reviewedDraft.blocks.every(block => block.length <= 600))
  .refine(value => !value.reviewedDraft || value.reviewedDraft.body.length <= 600 || Boolean(value.source && isWallHeadingBodySource(value.source) && value.reviewedDraft.blocks.length === 0))
  .refine(value => !value.reviewedDraft || Boolean(value.source && (value.source.format === "slideshow"
    ? value.reviewedDraft.blocks.length === 0 : isWallHeadingBodySource(value.source) && value.reviewedDraft.blocks.length === 0 || value.reviewedDraft.blocks.length === value.source.blocks.length && !value.reviewedDraft.heading && !value.reviewedDraft.body)));
export type RemixTextDraft = z.infer<typeof DraftSchema>;

export function readRemixTextDraft(raw: string | null): RemixTextDraft | null {
  if (!raw || raw.length > 64000) return null;
  try { return DraftSchema.parse(JSON.parse(raw)); } catch { return null; }
}
