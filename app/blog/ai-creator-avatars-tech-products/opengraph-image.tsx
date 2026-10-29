import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "AI Creator Avatars for Tech Products: Personas That Tech Audiences Trust";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "AI creator avatars for tech products.",
    subtitle: "Personas that developers and software buyers actually trust.",
  });
}
