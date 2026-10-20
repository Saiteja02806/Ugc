import "server-only";
import catalog from "./reference-text-catalog.json" with { type: "json" };
import { ReferenceTextSchema, type ReferenceText } from "./reference-text";
import { getRecreateReference } from "./recreate-catalog";

/** Only immutable catalogue identities resolve text; URLs from the client never do. */
export function getReferenceText(referenceId: string, slideId: string | null, format?: ReferenceText["format"]): ReferenceText | null {
  const reference = getRecreateReference(referenceId);
  if (!reference) throw new Error("Choose an available catalogue reference.");
  if (format && reference.format !== format) throw new Error("Choose a reference from this workflow.");
  const sourceUrl = reference.format === "slideshow"
    ? reference.slides.find(s => s.id === slideId)?.url
    : slideId === null ? reference.videoUrl : undefined;
  if (!sourceUrl) throw new Error("Choose a slide belonging to this reference.");
  const hash = new URL(sourceUrl).pathname.match(/\/([a-f0-9]{64})\.[a-z0-9]+$/i)?.[1];
  const raw = (catalog.items as unknown[]).find(value => {
    const item = value as Partial<ReferenceText>;
    return item.referenceId === referenceId && item.slideId === slideId;
  });
  if (!raw) return null;
  const item = ReferenceTextSchema.parse(raw);
  if (!hash || item.sourceSha256 !== hash || item.format !== reference.format) throw new Error("This reference text needs to be re-extracted from its current source.");
  return item;
}
