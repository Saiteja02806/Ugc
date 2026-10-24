import { marketingOgImage, ogContentType, ogSize } from "@/lib/marketing/og-card";

export const alt = "UGC video MCP server for Codex";
export const size = ogSize;
export const contentType = ogContentType;

export default function OpenGraphImage() {
  return marketingOgImage({
    kicker: "Codex config",
    title: "UGC video MCP server for Codex.",
    subtitle: "Paste the server into ~/.codex/config.toml and sign in with OAuth.",
  });
}
