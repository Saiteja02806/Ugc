import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = 'ClipUGC, checked';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: 'Comparison',
    title: 'ClipUGC, checked',
    subtitle: 'Public pages only. No quality ranking.',
  });
}
