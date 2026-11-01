import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "MakeUGC Alternative for B2B SaaS: Studio Quality vs Script Automation";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake",
    title: "MakeUGC alternative for B2B SaaS.",
    subtitle: "Studio quality vs script automation for technical software.",
  });
}
