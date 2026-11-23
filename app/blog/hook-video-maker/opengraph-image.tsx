import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Hook Video Maker: From a Reference Opening to a Video You Approve";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Make the hook. Review it.",
    subtitle: "Reference for the shot. Your words for the claim.",
  });
}
