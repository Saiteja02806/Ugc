import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC Pilot, an AI UGC video and content studio";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot",
    title: "AI UGC video, from the chat you already use.",
    subtitle: "Create, review, and edit short videos with Claude, Codex, or ChatGPT.",
  });
}
