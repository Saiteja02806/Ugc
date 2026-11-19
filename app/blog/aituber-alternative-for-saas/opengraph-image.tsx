import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AITuber Alternative for SaaS: Faceless Automation vs Product Video";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake comparison",
    title: "Faceless channel or product video?",
    subtitle: "AITuber and Vidmake answer different questions.",
  });
}
