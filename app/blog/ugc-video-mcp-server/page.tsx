import type { Metadata } from "next";

import { VideoMarketingPage, VideoRelatedLinks } from "@/components/marketing/video-marketing-page";
import { ArticleBody, ArticleCode, ArticleH2, ArticleLink, FaqList } from "@/components/marketing/seo-article";
import { articleJsonLd, breadcrumbJsonLd, publicOrigin } from "@/lib/marketing/brand-videos";
import { faqJsonLd } from "@/lib/marketing/mcp-public";

const path = "/blog/ugc-video-mcp-server";
const title = "UGC Video MCP Server: Ask Claude, Codex, or Cursor to Make the Clip";
const description =
  "What a UGC video MCP server does for Claude, Codex, ChatGPT, and other clients: OAuth, credits, a review step, and where to connect the Vidmake server.";
const datePublished = "2026-11-23";

const faqs = [
  {
    question: "What is a UGC video MCP server?",
    answer:
      "A hosted Model Context Protocol server your AI client calls to use your Vidmake account. Vidmake's server is Streamable HTTP at https://vidmake.io/mcp. You sign in with OAuth. The client can then read the account and ask for images, short video, speech, edits, and exports that the signed-in plan allows.",
  },
  {
    question: "Which clients does Vidmake document?",
    answer:
      "Claude, Codex, and ChatGPT, plus Claude Code. Cursor and any other client that can add a remote Streamable HTTP MCP server can use the same URL and the same OAuth sign-in. Vidmake does not ship a separate Cursor-only connector.",
  },
  {
    question: "Does the agent spend money?",
    answer:
      "Connecting is part of the account. Image, video, speech, and some finishing work spend that account's credits. Read the account's entitlements before the first paid generation. The pricing page lists the trial and the paid plans.",
  },
  {
    question: "Will the agent post the video?",
    answer:
      "No. You download the file you approve and share it yourself. The agent should not be treated as a publisher, and a chat reply is not proof the file was generated.",
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    type: "article",
    url: new URL(path, publicOrigin).href,
    siteName: "Vidmake",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function UgcVideoMcpServerPage() {
  return (
    <VideoMarketingPage
      eyebrow="MCP server"
      h1={title}
      lede="An MCP server lets the assistant you already use call Vidmake on your account. The client changes. The account, the credits, and the review do not."
      jsonLd={{
        "@context": "https://schema.org",
        "@graph": [
          { ...articleJsonLd({ path, headline: title, description, imagePath: `${path}/opengraph-image`, datePublished }), "@type": "BlogPosting" },
          faqJsonLd(faqs),
          breadcrumbJsonLd([
            { name: "Vidmake", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: "UGC video MCP server", path },
          ]),
        ],
      }}
    >
      <ArticleBody>
        <ArticleH2>What the server is, and what it is not</ArticleH2>
        <p>
          The public server is <ArticleCode>https://vidmake.io/mcp</ArticleCode>. The setup pages are the <ArticleLink href="/mcp">UGC video MCP server</ArticleLink> hub, <ArticleLink href="/mcp/claude">Claude</ArticleLink>, and <ArticleLink href="/mcp/codex">Codex</ArticleLink>. The <ArticleLink href="/docs/mcp-tools">tool reference</ArticleLink> lists each tool, what it does, and the scope it needs.
        </p>
        <p>
          The server does not invent a customer, a metric, or a right to someone else&apos;s video. It uses the signed-in account. If the plan cannot run a generation, the tool should fail before it spends. Ask the client to read entitlements first.
        </p>

        <ArticleH2>Connect the client you already have</ArticleH2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground-strong">Claude:</strong> add a custom connector, paste the server URL, and finish OAuth. The <ArticleLink href="/blog/ugc-ads-with-claude-mcp">Claude article</ArticleLink> is the click path.</li>
          <li><strong className="text-foreground-strong">Codex:</strong> add the server in config and sign in with OAuth. Leave bearer tokens out of the file. The <ArticleLink href="/blog/ugc-videos-with-codex-mcp">Codex article</ArticleLink> is the terminal path.</li>
          <li><strong className="text-foreground-strong">ChatGPT:</strong> add the same URL where that account can use a custom MCP connection. The hub page states the current client notes.</li>
          <li><strong className="text-foreground-strong">Cursor and other agents:</strong> if the client supports a remote Streamable HTTP server, add <ArticleCode>https://vidmake.io/mcp</ArticleCode> and complete the same OAuth consent. There is no second Vidmake product for Cursor. Use the client&apos;s own MCP settings, then confirm the tool list matches the public reference.</li>
        </ul>
        <p>
          Each person signs in to their own Vidmake account. A shared chat is not a shared login.
        </p>

        <ArticleH2>Ask for a reviewable asset, not a campaign</ArticleH2>
        <p>
          A good first prompt names one feature, the format, and the limit: &quot;Make a hook for a notes app. The only product fact is that a call note has a next-step section. Do not add a time-saved claim. Show me the file when it is ready.&quot; Then watch the file. The <ArticleLink href="/blog/ai-ugc-video-generator-how-it-works">generator guide</ArticleLink> explains where a generated clip stops and a real recording has to start. That rule is the same in a chat as it is in Explore.
        </p>
        <p>
          If you would rather click through it, <ArticleLink href="/explore/hook-video">Hook video</ArticleLink>, <ArticleLink href="/explore/wall-of-text">Text on screen</ArticleLink>, and <ArticleLink href="/explore/slideshows">Slideshows</ArticleLink> are the same jobs without a client in the middle.
        </p>

        <ArticleH2>Keep the registry name and the public site apart</ArticleH2>
        <p>
          The website is vidmake.io. The previous host, getugcpilot.com, redirects there. The MCP registry name on the server manifest remains <ArticleCode>com.getugcpilot/ugc-pilot</ArticleCode> so existing client registrations keep resolving. The public website URL on that manifest is vidmake.io. The remote endpoint published for the registry stays the MCP host already registered. Do not paste a new server name into a client that is already connected unless you mean to add a second server.
        </p>
        <p>
          Paid plans start at $29 a month. Connecting the server does not add a separate fee. Generation spends the credits on the plan. See <ArticleLink href="/pricing">pricing</ArticleLink> and <ArticleLink href="/connect-ai">connect an AI client</ArticleLink>.
        </p>

        <FaqList items={faqs} />
      </ArticleBody>
      <VideoRelatedLinks
        links={[
          { href: "/mcp", title: "MCP server", description: "Claude, Codex, and ChatGPT setup on one page." },
          { href: "/mcp/claude", title: "Connect Claude", description: "Custom connector, OAuth, and the server URL." },
          { href: "/mcp/codex", title: "Connect Codex", description: "The config file and OAuth login." },
          { href: "/blog/ugc-ads-with-claude-mcp", title: "UGC ads with Claude", description: "A full pass from chat to a reviewable ad." },
          { href: "/blog/ugc-videos-with-codex-mcp", title: "UGC videos with Codex", description: "The same server from the terminal." },
          { href: "/docs/mcp-tools", title: "Tool reference", description: "Every public tool and its scope." },
        ]}
      />
    </VideoMarketingPage>
  );
}
