import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC video MCP server for Claude, Codex, and ChatGPT";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Vidmake MCP",
    title: "UGC video MCP server for your agent.",
    subtitle: "105 tools. OAuth sign-in. One hosted URL for Claude, Codex, and ChatGPT.",
  });
}
