import { parseSlideshowOutputPlan, slideshowOutputPlanPrompt, type SlideshowOutputPlan } from "./slideshow-output-plan.ts";
/** Versioned roles/prompt policy keep already-admitted provider retries stable. */
export type SlideshowReferenceContract = {
  version: 2 | 3 | 4;
  styleReferenceIndices: number[];
  attachmentReferenceIndices: number[];
  regenerationReferenceIndex?: number;
  plan?: SlideshowOutputPlan;
};

export function parseSlideshowReferenceContract(value: unknown, referenceCount: number): SlideshowReferenceContract {
  const invalid = () => new Error("Choose valid slideshow style, attachment and edit-target references.");
  if (!value || typeof value !== "object" || Array.isArray(value) || referenceCount < 1) throw invalid();
  const roles = value as Record<string, unknown>;
  const validIndex = (index: unknown): index is number => typeof index === "number" && Number.isInteger(index) && index >= 1 && index <= referenceCount;
  const validIndices = (indices: unknown): indices is number[] => Array.isArray(indices) && indices.every(validIndex);
  if ((roles.version !== 2 && roles.version !== 3 && roles.version !== 4) || !validIndices(roles.styleReferenceIndices) || new Set(roles.styleReferenceIndices).size !== roles.styleReferenceIndices.length || !validIndices(roles.attachmentReferenceIndices) || (roles.regenerationReferenceIndex !== undefined && !validIndex(roles.regenerationReferenceIndex))) throw invalid();
  const covered = new Set([...roles.styleReferenceIndices, ...roles.attachmentReferenceIndices, ...(roles.regenerationReferenceIndex === undefined ? [] : [roles.regenerationReferenceIndex])]);
  if (covered.size !== referenceCount) throw invalid();
  const plan = roles.version === 4 ? parseSlideshowOutputPlan(roles.plan, referenceCount) : undefined;
  if (plan) {
    const source = plan.images.filter(image => image.role === "source").map(image => image.imageIndex);
    const uploads = plan.images.filter(image => image.role !== "source" && image.role !== "edit_base").map(image => image.imageIndex);
    if (JSON.stringify(source) !== JSON.stringify(roles.styleReferenceIndices) || JSON.stringify(uploads) !== JSON.stringify(roles.attachmentReferenceIndices) ||
      plan.images.find(image => image.role === "edit_base")?.imageIndex !== roles.regenerationReferenceIndex) throw invalid();
  }
  return {
    version: roles.version,
    styleReferenceIndices: [...roles.styleReferenceIndices],
    attachmentReferenceIndices: [...roles.attachmentReferenceIndices],
    ...(roles.regenerationReferenceIndex === undefined ? {} : { regenerationReferenceIndex: roles.regenerationReferenceIndex }),
    ...(plan ? { plan } : {}),
  };
}

export function slideshowGenerationPrompt(prompt: string, ratio: string, roles: SlideshowReferenceContract) {
  if (roles.version === 4) return slideshowOutputPlanPrompt(roles.plan!, ratio);
  if (roles.version === 3) return referencePreservingPrompt(prompt, ratio, roles);
  const instructions = [`Generate one slideshow image composed directly for the ${ratio} aspect ratio. Keep the complete subject and important visual elements inside the canvas with comfortable margins.`];
  if (roles.styleReferenceIndices.length) {
    instructions.push(`Selected slideshow style references: ${roles.styleReferenceIndices.map(index => `image ${index}`).join(", ")}. Take inspiration from their visual style, composition, lighting and atmosphere. ${roles.regenerationReferenceIndex ? "They guide the style of the edit; they do not replace the existing slide." : `Image ${roles.styleReferenceIndices[0]} is the selected slide whose visual composition guides this output; the other selected slides, if any, provide the same slideshow's style guidance.`}`);
  }
  if (roles.attachmentReferenceIndices.length) {
    instructions.push(`Images attached to the user's prompt: ${roles.attachmentReferenceIndices.map((index, order) => `attachment ${order + 1} = image ${index}`).join("; ")}. Use the person, product, object, background or other guidance from these attachments as the user's instructions describe, within the selected slideshow style. "My first attached image" means attachment 1, not the first slideshow style reference.`);
  }
  if (roles.regenerationReferenceIndex) {
    instructions.push(`Image ${roles.regenerationReferenceIndex} is the existing slide being edited and is the main edit target. Base the result on this image, preserving its visual content and composition except for changes requested by the user. Use the style references and attachments as guidance for those changes.`);
  }
  instructions.push("By default, generate the visual without reproducing reference captions, headlines or text overlays; editable copy is added separately through Remix Text. If the user's instructions explicitly request visible text inside the image, include the requested text in a clear readable area, preferably near the middle, with comfortable margins and without obscuring the main subject. Preserve incidental product labels unless the user asks to change them. The user's explicit instructions take priority over these defaults.");
  return `${instructions.join("\n\n")}\n\nUser instructions:\n${prompt}`;
}

function referencePreservingPrompt(prompt: string, ratio: string, roles: SlideshowReferenceContract) {
  const instructions = [
    `Generate one slideshow image composed directly for the ${ratio} aspect ratio. Preserve the reference framing and proportions as closely as the requested canvas permits; keep important content inside the canvas.`,
    "This is a close edit of the designated base slide. Reproduce that slide as closely as possible, changing only the details requested by the user and the relevant business-specific copy. Do not reinterpret it, create a new scene or use it merely as a mood board. Keep every unrequested visual detail unchanged. When a background change is requested, replace only that background; do not use it as permission to change the text treatment, camera angle or unrelated objects.",
    "Instruction priority: explicit user-requested changes take priority. Otherwise preserve the selected reference's style and tone. Use saved business facts only to adapt the relevant details; they are not permission to redesign the slide. A request to change one detail does not authorize changing unrelated details. If the user explicitly requests a new style, tone, background or layout, make that change and preserve everything outside its scope.",
  ];
  if (roles.styleReferenceIndices.length) {
    instructions.push(`Selected slideshow reference slides: ${roles.styleReferenceIndices.map(index => `image ${index}`).join(", ")}. ${roles.regenerationReferenceIndex
      ? "Keep these as secondary context; the existing slide identified below remains the base being edited."
      : `Image ${roles.styleReferenceIndices[0]} is the selected slide and the base for this output. The other selected slides are secondary context, not alternative layouts to copy into this output.`}`);
  }
  if (roles.regenerationReferenceIndex) {
    instructions.push(`Image ${roles.regenerationReferenceIndex} is the existing slide being edited and is the main edit target. Use it as the base. Preserve its content and composition except for the requested changes.`);
  }
  if (roles.styleReferenceIndices.length || roles.regenerationReferenceIndex) {
    instructions.push("Preserve the base image's visual style, composition, camera angle, framing, lighting, color palette, atmosphere, objects and background unless the user explicitly asks to change them. Preserve its tone of voice, level of formality, humor and emotional intensity when adapting copy. Make only the small changes needed to fit the user's business and requested content. Do not turn casual or educational content into a polished advertisement, add a sales pitch or insert calls to action just because business context is supplied.");
  }
  if (roles.attachmentReferenceIndices.length) {
    instructions.push(`Images attached to the user's prompt: ${roles.attachmentReferenceIndices.map((index, order) => `attachment ${order + 1} = image ${index}`).join("; ")}. "My first attached image" means attachment 1, not the first slideshow reference. Apply each attachment only where the user's instructions call for it. A product/person/screen replacement must not replace the base slide's overall style, layout or unrelated content. When asked to place an uploaded screenshot inside a screen, use that screenshot's actual visible interface, colors, text and arrangement as faithfully as possible; do not invent a different dashboard or redesign its UI. Retain the base device, screen boundaries, perspective and surrounding scene unless the user explicitly requests changing them. Do not extend a screen replacement to another output slide. Use any other attachment guidance only within its requested scope.`);
  }
  instructions.push("Reference captions and headlines are handled as editable copy through Remix Text by default; do not reproduce them in the generated visual unless the user explicitly requests visible text. When visible text is requested, preserve the base reference's typography, placement, scale, line breaks and text-box shapes unless the user requests changes, and use the exact replacement wording when supplied. Do not move text to the middle or invent a new text treatment by default. Preserve incidental product labels unless the user asks to change them. Do not carry another business's name or claims into the adapted copy.");
  return `${instructions.join("\n\n")}\n\nUser instructions:\n${prompt}`;
}
