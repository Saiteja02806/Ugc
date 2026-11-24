import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = 'Hook formulas you can film';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: 'Hooks',
    title: 'Hook formulas you can film',
    subtitle: 'Examples, not performance claims.',
  });
}
