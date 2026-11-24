import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = 'Faceless videos for apps';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: 'Formats',
    title: 'Faceless videos for apps',
    subtitle: 'No face. The screen stays real.',
  });
}
