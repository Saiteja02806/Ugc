import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC Video MCP Server: Ask Claude, Codex, or Cursor to Make the Clip";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake guide",
    title: "One MCP server.",
    subtitle: "Your account. Your credits. A file you review.",
  });
}
