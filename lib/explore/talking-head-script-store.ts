import "server-only";
import transcripts from "./talking-head-transcripts.json" with { type: "json" };
import { getTalkingHeadReferences } from "./talking-head-reference-catalog";

export function getTalkingHeadScript(referenceId: string) {
  const reference = getTalkingHeadReferences().find(item => item.id === referenceId);
  const source = transcripts.items.find(item => item.referenceId === referenceId);
  if (!reference || !source || reference.sourceSha256 !== source.sourceSha256) throw Error("This source transcript is unavailable or has changed. Choose the reference again.");
  if (source.review === "needs_review") throw Error("This archived source has uncertain speech and needs review before a new script remix.");
  return source;
}
