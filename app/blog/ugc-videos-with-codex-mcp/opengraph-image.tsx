import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "How to Make UGC Videos with Codex Using an MCP Server";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "UGC Pilot MCP",
    title: "Make UGC videos with Codex.",
    subtitle: "Connect the server, write from the repo, then review the file.",
  });
}
