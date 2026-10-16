export type SlideshowComposerDraft = { version: 1; prompt: string; imageIds: string[] };
export function slideshowComposerDraftKey(owner: string, scope: string) {
  // Include the full context: different selections must never share attachments.
  return `ugc-explore:slideshow-composer:v1:${owner}:${scope}`;
}
export function readSlideshowComposerDraft(raw: string | null): SlideshowComposerDraft {
  if (!raw) return { version: 1, prompt: "", imageIds: [] };
  if (raw.length > 40000) throw new Error("The saved instructions are invalid. Reset this draft to continue.");
  const value = JSON.parse(raw);
  if (value?.version !== 1 || typeof value.prompt !== "string" || value.prompt.length > 32000 || !Array.isArray(value.imageIds) || value.imageIds.length > 14 ||
    value.imageIds.some((id: unknown) => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) || new Set(value.imageIds).size !== value.imageIds.length) {
    throw new Error("The saved instructions are invalid. Reset this draft to continue.");
  }
  return { version: 1, prompt: value.prompt, imageIds: value.imageIds };
}

/** Conservative preflight for an explicit uploaded-screen request, not a prompt interpreter. */
export function requiresScreenshotAttachment(prompt: string) {
  return prompt.split(/[.!?;\n]/).some(clause => {
    if (/\b(?:do not|don't|without|never)\b/i.test(clause)) return false;
    return /\b(?:use|place|put|insert|keep|add|show|replace)\b/i.test(clause) &&
      /\b(?:uploaded|attached|provided|supplied|my|given)\b/i.test(clause) &&
      /\b(?:screenshot|screen\s+image)\b/i.test(clause);
  });
}
