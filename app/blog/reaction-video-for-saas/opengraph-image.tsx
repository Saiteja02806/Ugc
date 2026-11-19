import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Reaction Video for SaaS: Turn a First Look into a Hook";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Two seconds of reaction.",
    subtitle: "Then the product has to earn the rest.",
  });
}
