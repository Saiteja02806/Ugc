import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Problem-Solution Video Ad for SaaS: A 25-Second Structure";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "Problem, turn, proof.",
    subtitle: "A 25-second SaaS ad structure.",
  });
}
