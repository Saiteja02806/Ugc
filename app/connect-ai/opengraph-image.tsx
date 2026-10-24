import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "Connect Claude, Codex, or ChatGPT to UGC Pilot";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Connect your AI",
    title: "Your next video starts in the chat.",
    subtitle: "Sign in once, then create images, short videos, and edits from Codex, Claude, or ChatGPT.",
  });
}
