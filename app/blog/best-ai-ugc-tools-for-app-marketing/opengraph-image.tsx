import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = 'Compare app UGC tools';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: 'Checklist',
    title: 'Compare app UGC tools',
    subtitle: 'A checklist, not a ranked winner.',
  });
}
