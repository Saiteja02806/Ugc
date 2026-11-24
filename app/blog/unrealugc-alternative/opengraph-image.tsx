import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = 'UnrealUGC, checked';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: 'Comparison',
    title: 'UnrealUGC, checked',
    subtitle: 'Pricing page facts. Claims left out.',
  });
}
