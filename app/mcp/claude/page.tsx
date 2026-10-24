import { McpMarketingPage } from "@/components/marketing/mcp-marketing-page";
import { mcpPages, publicPageMetadata } from "@/lib/marketing/mcp-public";

const page = mcpPages.claude;

export const metadata = publicPageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
});

export default function McpClaudePage() {
  return <McpMarketingPage pageKey="claude" />;
}
