import { McpMarketingPage } from "@/components/marketing/mcp-marketing-page";
import { mcpPages, publicPageMetadata } from "@/lib/marketing/mcp-public";

const page = mcpPages.hub;

export const metadata = publicPageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
  imagePath: "/mcp/opengraph-image",
});

export default function McpHubPage() {
  return <McpMarketingPage pageKey="hub" />;
}
