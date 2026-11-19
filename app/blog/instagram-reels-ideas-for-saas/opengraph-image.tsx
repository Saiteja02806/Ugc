import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "20 Instagram Reels Ideas for SaaS Teams (With Hooks)";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "20 Reels you can ship.",
    subtitle: "Problem, proof, text-led and carousel ideas.",
  });
}
