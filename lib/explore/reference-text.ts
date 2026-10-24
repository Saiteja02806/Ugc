import { z } from "zod";

export const ReferenceTextBlockSchema = z.object({
  text: z.string().trim().min(1).max(6000),
  startMs: z.number().int().min(0).nullable(),
  endMs: z.number().int().min(1).nullable(),
}).strict().refine(b => b.startMs === null && b.endMs === null || b.startMs !== null && b.endMs !== null && b.endMs > b.startMs, "Invalid text timing.");
export const ReferenceTextSchema = z.object({
  referenceId: z.string().min(1).max(160),
  slideId: z.string().min(1).max(160).nullable(),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  format: z.enum(["hook", "wall_text", "slideshow"]),
  status: z.enum(["ready", "needs_review", "no_text"]),
  blocks: z.array(ReferenceTextBlockSchema).max(20),
  extractedAt: z.string().datetime(),
  model: z.string().min(1).max(100),
  notes: z.string().max(1000),
}).strict().refine(r => r.status !== "ready" || r.blocks.length > 0, "Ready extraction needs text.")
  .refine(r => r.format === "slideshow" ? r.slideId !== null && r.blocks.every(b => b.startMs === null) : r.slideId === null && r.blocks.every(b => b.startMs !== null), "Source and text timing do not match.");
export type ReferenceText = z.infer<typeof ReferenceTextSchema>;
const remixFormat = z.enum(["hook", "wall_text", "slideshow"]);
export const RemixRequestSchema = z.object({
  requestKey: z.string().uuid(), referenceId: z.string().min(1).max(160).nullable(),
  slideId: z.string().min(1).max(160).nullable(), instructions: z.string().trim().max(6000),
  format: remixFormat.optional(),
  referenceBlocks: z.array(z.string().trim().min(1).max(6000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u)).min(1).max(20)
    .refine(blocks => blocks.join("").length <= 6000, "Keep the starting text within 6,000 characters.").optional(),
}).strict();
export type RemixRequest = z.infer<typeof RemixRequestSchema>;
/** Custom ideas have a stable identity, separate from catalogue references. */
export function remixSourceMatches(source: ReferenceText, request: Pick<RemixRequest, "referenceId" | "slideId" | "format">, format: ReferenceText["format"]): boolean {
  return source.format === format && source.referenceId === (request.referenceId ?? `manual:${format}`)
    && source.slideId === (format === "slideshow" && !request.referenceId ? request.slideId ?? "manual-slide" : request.slideId);
}
export const RemixOutputSchema = z.object({
  blocks: z.array(z.string().trim().min(1).max(600).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u)).max(20),
  heading: z.string().trim().max(180).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u),
  body: z.string().trim().max(600).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u),
}).strict();
export type RemixOutput = z.infer<typeof RemixOutputSchema>;
export type ReferenceTextResponse = { source: ReferenceText | null; message?: string };

/** User-reviewed copy keeps editor bounds; users may expand the AI's draft. */
export function validateRemixDraft(value: unknown, source: ReferenceText): RemixOutput {
  const output = RemixOutputSchema.parse(value);
  if (source.format === "slideshow") {
    if (output.blocks.length || !output.heading.trim() && !output.body.trim()) throw new Error("The remixed slide is empty.");
  } else if (output.blocks.length !== source.blocks.length || output.heading || output.body) {
    throw new Error("The remixed text does not match this reference's text blocks.");
  }
  return output;
}

export function validateRemixOutput(value: unknown, source: ReferenceText): RemixOutput {
  const output = validateRemixDraft(value, source);
  const originalLength = source.blocks.reduce((sum, b) => sum + b.text.length, 0);
  const generatedLength = source.format === "slideshow" ? output.heading.length + output.body.length : output.blocks.join("").length;
  if (generatedLength > Math.max(80, Math.ceil(originalLength * 1.3))) throw new Error("The remix is too long for this reference. Try a shorter instruction.");
  return output;
}

export function referenceTextKey(referenceId: string, slideId: string | null) {
  return JSON.stringify([referenceId, slideId]);
}
