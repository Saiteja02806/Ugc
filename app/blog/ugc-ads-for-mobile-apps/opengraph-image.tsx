import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC Ads for Mobile Apps: One Feature, Real Proof, Short Variants";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "App ads with real proof.",
    subtitle: "One feature. A real screen. Short variants.",
  });
}
