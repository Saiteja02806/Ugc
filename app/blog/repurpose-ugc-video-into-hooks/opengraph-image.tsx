import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = 'One video, more hooks';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: 'Editing',
    title: 'One video, more hooks',
    subtitle: 'Same proof. A new opening.',
  });
}
