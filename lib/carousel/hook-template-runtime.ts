import "server-only";

export type CarouselHookTemplateMode = "enabled" | "off" | "shadow";

/**
 * `shadow` makes a deterministic selection and logs it, but keeps the durable
 * assignment null so the worker receives the pre-template prompt. `off` skips
 * selection entirely. Missing or unknown values fail closed to `off`, so a
 * deployment must explicitly opt into the optional overlay.
 */
export function getCarouselHookTemplateMode(): CarouselHookTemplateMode {
  const value = process.env.CAROUSEL_HOOK_TEMPLATES_MODE?.trim().toLowerCase();

  return value === "enabled" || value === "shadow" ? value : "off";
}
