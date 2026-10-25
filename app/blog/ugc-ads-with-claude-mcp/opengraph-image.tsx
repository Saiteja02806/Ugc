import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "How to Make UGC Ads with Claude Using an MCP Server";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot MCP",
    title: "Make UGC ads with Claude.",
    subtitle: "Connect the server, write the brief, then review the file.",
  });
}
