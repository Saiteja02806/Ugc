import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI UGC Video Maker for Software: Transform Features into Viral Clips";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "AI UGC video maker for software.",
    subtitle: "Turn technical features and changelogs into viral social clips.",
  });
}
