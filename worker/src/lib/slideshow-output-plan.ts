/** Frozen per-output instructions. Original identities never depend on provider order. */
export const SLIDESHOW_ATTACHMENT_ROLES = ["screenshot", "product", "person", "background", "style", "other"] as const;
export type SlideshowAttachmentRole = typeof SLIDESHOW_ATTACHMENT_ROLES[number];
export type SlideshowPlanImage = {
  id: string;
  label: string;
  role: SlideshowAttachmentRole | "source" | "edit_base";
  imageIndex: number;
};
export type SlideshowOutputPlan = {
  version: 1;
  targetId: string;
  outputSlideIndex: number;
  sourceSlideNumber: number | null;
  instructions: string;
  preserve: string[];
  images: SlideshowPlanImage[];
};

export function parseSlideshowOutputPlan(value: unknown, referenceCount: number): SlideshowOutputPlan {
  const plan = value as SlideshowOutputPlan;
  const text = (v: unknown, max: number): v is string => typeof v === "string" && Boolean(v.trim()) && v.length <= max;
  if (!plan || plan.version !== 1 || !text(plan.targetId, 200) || !Number.isInteger(plan.outputSlideIndex) || plan.outputSlideIndex < 1 || plan.outputSlideIndex > 10 ||
    !(plan.sourceSlideNumber === null || Number.isInteger(plan.sourceSlideNumber) && plan.sourceSlideNumber >= 1 && plan.sourceSlideNumber <= 100) ||
    !text(plan.instructions, 24000) || !Array.isArray(plan.preserve) || plan.preserve.length > 30 || plan.preserve.some(v => !text(v, 2000)) ||
    !Array.isArray(plan.images) || !plan.images.length || plan.images.length > 30 || plan.images.some(image => !image || !text(image.id, 200) || !text(image.label, 100) ||
      !["source", "edit_base", ...SLIDESHOW_ATTACHMENT_ROLES].includes(image.role) || !Number.isInteger(image.imageIndex) || image.imageIndex < 1 || image.imageIndex > referenceCount) ||
    new Set(plan.images.map(image => image.id)).size !== plan.images.length || new Set(plan.images.map(image => image.label)).size !== plan.images.length || new Set(plan.images.map(image => image.imageIndex)).size !== referenceCount ||
    plan.images.filter(image => image.role === "source" || image.role === "edit_base").length !== 1 ||
    !plan.images.some(image => image.id === plan.targetId && image.imageIndex === 1 && (image.role === "source" || image.role === "edit_base"))) {
    throw new Error("This slide's image assignments could not be verified. Review your instructions before generating.");
  }
  return { version: 1, targetId: plan.targetId, outputSlideIndex: plan.outputSlideIndex, sourceSlideNumber: plan.sourceSlideNumber,
    instructions: plan.instructions, preserve: [...plan.preserve], images: plan.images.map(image => ({ id: image.id, label: image.label, role: image.role, imageIndex: image.imageIndex })) };
}

export function slideshowOutputPlanPrompt(plan: SlideshowOutputPlan, ratio: string) {
  return [
    `Create only output slide ${plan.outputSlideIndex} at ${ratio}. This is a close edit of image 1 (${plan.images.find(image => image.id === plan.targetId)!.label}).`,
    "Image assignments (numbers refer to the actual attached image order):",
    ...plan.images.map(image => `Image ${image.imageIndex} = ${image.label}; role: ${image.role}.`),
    "Use each supplemental image only for its assigned purpose on this slide. Do not borrow another slide's layout. Preserve the base composition, tone and all unrequested details. Business facts do not authorize extra props, claims or calls to action.",
    "For a screenshot replacement, reproduce the supplied interface faithfully within the requested screen; do not invent a different website. Exact pixel placement requires a separate compositing operation.",
    "Reference headlines are editable copy added separately by default. Include visible text in the generated image only when the instructions below explicitly request it; then preserve the base text treatment and exact requested wording.",
    `Instructions for this slide:\n${plan.instructions}`,
    ...plan.preserve.map(item => `Preserve: ${item}`),
  ].join("\n\n");
}
