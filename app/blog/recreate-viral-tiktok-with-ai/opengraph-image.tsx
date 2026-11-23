import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Recreate a Viral TikTok with AI Without Copying Someone Else's Video";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Recreate the structure.",
    subtitle: "Your words. Your footage. Your claims.",
  });
}
