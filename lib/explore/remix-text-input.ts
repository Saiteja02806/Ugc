import { createHash } from "node:crypto";
import { ReferenceTextSchema, type ReferenceText, type RemixRequest } from "./reference-text.ts";

/** Keep catalogue timing for unchanged blocks; edited prose becomes one clip-local block. */
export function remixInputSource(request: RemixRequest, original: ReferenceText | null): ReferenceText {
  const format = original?.format ?? request.format;
  if (!format || request.format && request.format !== format) throw new Error("Choose text from this workflow.");
  if (!request.referenceId && (!request.referenceBlocks || format !== "slideshow" && request.slideId)) throw new Error("Enter reference text or your own details first.");
  if (request.referenceId && !request.referenceBlocks) {
    if (!original || original.status !== "ready") throw new Error("This reference text has not been prepared for remixing yet.");
    return original;
  }
  const copy = request.referenceBlocks;
  if (!copy?.length) throw new Error("Enter reference text or your own details first.");
  const duration = Math.max(copy.length, ...(original?.blocks.map(block => block.endMs ?? 1) ?? [1000]));
  const blocks = copy.map((text, i) => {
    const previous = original?.blocks.length === copy.length ? original.blocks[i] : null;
    return { text, startMs: format === "slideshow" ? null : previous?.startMs ?? Math.floor(i / copy.length * duration),
      endMs: format === "slideshow" ? null : previous?.endMs ?? Math.floor((i + 1) / copy.length * duration) };
  });
  return ReferenceTextSchema.parse({ referenceId: request.referenceId ?? `manual:${format}`,
    slideId: format === "slideshow" ? request.slideId ?? "manual-slide" : null, format, status: "ready", blocks,
    sourceSha256: createHash("sha256").update(JSON.stringify(copy)).digest("hex"),
    extractedAt: new Date().toISOString(), model: "user-text", notes: "Starting text reviewed or entered by the user." });
}
