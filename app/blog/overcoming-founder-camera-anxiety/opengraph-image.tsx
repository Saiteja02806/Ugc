import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Overcoming Founder Camera Anxiety: Scaling Video Marketing Anonymously";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "Overcoming founder camera anxiety.",
    subtitle: "Scale short-form video marketing without recording yourself on camera.",
  });
}
