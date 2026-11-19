import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "25 SaaS Video Ideas Founders Can Actually Produce";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "25 ideas you can ship.",
    subtitle: "Problem, proof, product, founder and format.",
  });
}
