import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI Influencer Video Generator: Reusable Identity Without the Drift";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Same face, every video.",
    subtitle: "Identity references, role separation and review.",
  });
}
