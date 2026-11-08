import catalog from "./talking-head-reference-catalog.json" with { type: "json" };
import sources from "./talking-head-source-manifest.json" with { type: "json" };

/** The clip's own scene prompt. A hash mismatch cannot borrow another clip's actions. */
export function getTalkingHeadSceneDirections(referenceId: string, sourceSha256: string): string | undefined {
  const source = sources.items.find(item => item.id === referenceId);
  if (!source || source.sourceSha256 !== sourceSha256) return undefined;
  const prompt = catalog.items.find(item => item.id === referenceId)?.generationPrompt.trim();
  return prompt || undefined;
}
