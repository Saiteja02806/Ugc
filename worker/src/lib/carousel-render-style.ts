export type CarouselRenderStyle = "highlight" | "plain" | "soft-gradient";

export const DEFAULT_CAROUSEL_RENDER_STYLE: CarouselRenderStyle = "highlight";

export function getCarouselRenderStyle(value: unknown): CarouselRenderStyle {
  return value === "plain" || value === "highlight" || value === "soft-gradient"
    ? value
    : DEFAULT_CAROUSEL_RENDER_STYLE;
}
