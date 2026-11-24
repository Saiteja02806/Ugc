import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = 'Schedule after you review';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: 'Publishing',
    title: 'Schedule after you review',
    subtitle: 'A queue is a server record.',
  });
}
