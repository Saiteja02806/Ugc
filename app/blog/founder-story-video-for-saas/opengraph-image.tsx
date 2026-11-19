import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Founder Story Video for SaaS: Structure That Earns Trust";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Start at the moment.",
    subtitle: "A founder story structure that earns trust.",
  });
}
