import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "App Marketing Videos for SaaS: Which Format to Make First";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "One feature. One format.",
    subtitle: "Hook, text, slideshow, or a real demo.",
  });
}
