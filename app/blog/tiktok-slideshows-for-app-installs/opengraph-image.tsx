import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = 'Slideshows and installs';
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: 'Slideshows',
    title: 'Slideshows and installs',
    subtitle: 'One feature, a real last slide.',
  });
}
