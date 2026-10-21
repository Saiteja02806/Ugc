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
    const actions = [...clause.matchAll(/\b(?:use|place|put|insert|keep|add|show|replace)\b/gi)];
    return actions.some((action, index) => {
      const before = clause.slice(0, action.index);
      // Negation belongs to this action, not unrelated preservation instructions
      // such as "use my screenshot, do not change anything else".
      if (/\b(?:do\s+not|don['’]t|never|without|not(?:\s+(?:want|need)\s+to)?)\s+(?:(?:ever|also|even|please)\s+)*$/i.test(before)) return false;
      const request = clause.slice(action.index, actions[index + 1]?.index);
      return /\b(?:uploaded|attached|provided|supplied|my|given)\b/i.test(request) &&
        /\b(?:screenshot|screen\s+image)\b/i.test(request);
    });
  });
}
