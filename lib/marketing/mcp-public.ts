import type { Metadata } from "next";

import { ogSize } from "./og-card";
import catalog from "./mcp-tool-catalog.json";

export const mcpToolCatalog = catalog;
export const MCP_TOOL_COUNT = catalog.toolCount;

/** Gated account write for social posting defaults. Posting is unreleased, so the public reference omits it. */
const hiddenPublicToolNames = new Set(["update_publishing_preferences"]);

const publicDescriptionByName: Record<string, string> = {
  list_references:
    "Browse the Hook, Wall-of-Text, and slideshow reference catalogue in the application, including slide IDs and supplied paired soundtrack metadata. Catalogue identities are distinct from owned media IDs; this does not upload, transcribe or render anything.",
  list_operations:
    "Discover owned application and MCP jobs across generation, finishing, and preparation. Returns safe status summaries without inputs, diagnostics or provider/storage identifiers.",
  get_library_item:
    "Read the selected owned Library snapshot, ordered rendered outputs, removal state and exact revision. Does not edit or restore it.",
  remove_library_item:
    "Archive the explicitly selected Library entry at its exact revision, matching the application's metadata-only removal. Preserves source media and saved slide files. Preserve request UUID/inputs for recovery.",
  get_account_settings_capabilities:
    "Read account-default settings support and rollout gate. Does not initialize timezone or change defaults.",
  get_account_settings:
    "Read persisted account settings and the account timezone without initializing either. Returns distinct revisions for settings and timezone.",
  initialize_account_timezone:
    "Initialize an unset persisted account timezone at its saved timezone_revision, matching the application's initialize-once policy. An already initialized timezone is preserved, even when another zone is supplied. Preserve request UUID/inputs for recovery.",
};

const publicMcpGroups = catalog.groups.map((group) => ({
  ...group,
  tools: group.tools
    .filter((tool) => !hiddenPublicToolNames.has(tool.name))
    .map((tool) => ({
      ...tool,
      description: publicDescriptionByName[tool.name] ?? tool.description,
    })),
}));
export const publicMcpToolCount = publicMcpGroups.reduce((count, group) => count + group.tools.length, 0);
export const publicMcpToolCatalog = { toolCount: publicMcpToolCount, groups: publicMcpGroups };

export const publicOrigin = "https://getugcpilot.com";
export const mcpEndpoint = "https://mcp.getugcpilot.com/mcp";
export const mcpIssuer = "https://mcp.getugcpilot.com";

export const mcpSetupScopes = [
  "account:read",
  "brand:read",
  "assets:read",
  "assets:write",
  "generation:write",
  "jobs:read",
  "creative:write",
  "jobs:write",
] as const;

export const mcpOptionalAccountScope = "account:write";

export const connectionCheckPrompt =
  "Use UGC Pilot to check my connection, plan, credits, and available generation options. Do not generate anything yet.";

export const codexConfigToml = `[mcp_servers.ugc-pilot]
url = "https://mcp.getugcpilot.com/mcp"
scopes = [
  "account:read",
  "brand:read",
  "assets:read",
  "assets:write",
  "generation:write",
  "jobs:read",
  "creative:write",
  "jobs:write"
]
`;

export const codexLoginCommands = `codex mcp add ugc-pilot --url https://mcp.getugcpilot.com/mcp
codex mcp login ugc-pilot --scopes account:read,brand:read,assets:read,assets:write,generation:write,jobs:read,creative:write,jobs:write`;

export const claudeCodeCommand = "claude mcp add --transport http ugc-pilot https://mcp.getugcpilot.com/mcp";

export type McpFaq = { question: string; answer: string };

export const mcpWorkflows = [
  {
    title: "Check the connection",
    prompt: connectionCheckPrompt,
    tools: ["get_profile", "get_entitlements", "get_capabilities"],
  },
  {
    title: "Create a product image",
    prompt: "Use UGC Pilot to generate one vertical product image of my skincare bottle on a bathroom shelf.",
    tools: ["generate_image", "get_job"],
  },
  {
    title: "Animate that image",
    prompt: "Animate that image into one five-second vertical video with a slow camera push-in. Return the finished video link.",
    tools: ["generate_video", "get_job", "get_asset"],
  },
  {
    title: "Edit and export a revision",
    prompt: "Open this video in Edit, trim the first half-second, save the hook text, and export that saved revision.",
    tools: ["open_edit_draft", "update_edit_draft", "export_edit_draft", "get_edit_export"],
  },
  {
    title: "Finish a hook and a demo",
    prompt: "Use my hook clip and demo clip, put the hook text on screen, and finish the video.",
    tools: ["get_video_finishing_capabilities", "finish_video", "get_video_finish"],
  },
] as const;

const sharedFaqs: McpFaq[] = [
  {
    question: "Where is the UGC Pilot MCP server?",
    answer: `The hosted server is ${mcpEndpoint}. The transport is Streamable HTTP. Sign-in is OAuth with PKCE on ${mcpIssuer}. Put the URL in the client configuration and approve access in the browser. Do not paste an API key or access token into the chat.`,
  },
  {
    question: "How many tools does the server expose?",
    answer: `The reviewed registry contains ${MCP_TOOL_COUNT} tools, grouped by the job they perform. A client can keep an older cached list until you start a new conversation. The public tool reference lists ${publicMcpToolCount} of them, with each name, description, and OAuth scope.`,
  },
  {
    question: "What does a connected agent do with my account?",
    answer: "It reads the signed-in account, plan, and credits, then creates images, short videos, speech, edit drafts, and exports when you ask. Generation uses that account's UGC Pilot plan and credits. You download the finished file and share it from the channel you already manage.",
  },
];

export const mcpPages = {
  hub: {
    path: "/mcp",
    eyebrow: "MCP server",
    title: "UGC video MCP server",
    h1: "UGC video MCP server for Claude, Codex, and ChatGPT",
    description: "Connect Claude, Codex, or ChatGPT to the hosted UGC Pilot MCP server. OAuth sign-in, 79 tools, and copy-paste setup for UGC images, short video, speech, and edits.",
    lede: "Point your agent at one Streamable HTTP server, approve scoped access for your UGC Pilot account, and ask for the image, video, or edit in the chat.",
    faqs: [
      ...sharedFaqs,
      {
        question: "Which clients can connect?",
        answer: "Claude on the web and desktop uses a custom connector. Codex uses ~/.codex/config.toml and an OAuth login. ChatGPT can add the same URL where custom MCP connections are enabled for the account. Claude Code can add the HTTP server or load the plugin bundle. Each person signs in to their own UGC Pilot account.",
      },
      {
        question: "Does the connector cost extra?",
        answer: "Connecting the server is included with the account. Image, video, speech, and some finishing work spend the credits on that account's plan. Read get_entitlements and get_capabilities before the first paid generation. The pricing page lists the trial and the paid plans.",
      },
    ],
  },
  claude: {
    path: "/mcp/claude",
    eyebrow: "Claude connector",
    title: "UGC video MCP server for Claude",
    h1: "UGC video MCP server for Claude",
    description: "Add the UGC Pilot MCP server in Claude with a custom connector. OAuth sign-in, the hosted server URL, and 79 tools for UGC video, images, speech, and edits.",
    lede: "Claude connects to the hosted server from Customize → Connectors. You sign in to UGC Pilot, approve the scopes, and enable the connector in the conversation.",
    faqs: [
      ...sharedFaqs,
      {
        question: "How do I add UGC Pilot in Claude?",
        answer: "Open Customize, then Connectors, then Add custom connector. Name it UGC Pilot and paste https://mcp.getugcpilot.com/mcp. Finish the detected OAuth sign-in and approve the requested scopes. Enable the connector in the conversation before you send a prompt.",
      },
      {
        question: "Does a Team or Enterprise workspace need an admin?",
        answer: "Yes, when the organization requires an administrator to add custom connectors. After the connector exists, each person still signs in with their own UGC Pilot account. The plugin ZIP is optional. The hosted URL is enough for the tools.",
      },
    ],
  },
  codex: {
    path: "/mcp/codex",
    eyebrow: "Codex config",
    title: "UGC video MCP server for Codex",
    h1: "UGC video MCP server for Codex",
    description: "Add the UGC Pilot MCP server to Codex in ~/.codex/config.toml. Streamable HTTP, OAuth login, and 79 tools for UGC video, images, speech, and edits.",
    lede: "Codex stores the server in ~/.codex/config.toml, then opens a browser so you can sign in to UGC Pilot and approve the scopes.",
    faqs: [
      ...sharedFaqs,
      {
        question: "What goes in ~/.codex/config.toml?",
        answer: "Add a [mcp_servers.ugc-pilot] table with url = \"https://mcp.getugcpilot.com/mcp\" and the eight setup scopes. Leave bearer tokens out of the file. Run codex mcp login ugc-pilot if Codex has not already opened the consent screen.",
      },
      {
        question: "Why does a new Codex thread miss the tools?",
        answer: "An open thread can keep the tool list it discovered at the start. Save the config, complete OAuth, then start a new thread and ask UGC Pilot to call get_profile. Re-authenticate when the sign-in expires or a requested scope is missing.",
      },
    ],
  },
} as const;

export type McpPageKey = keyof typeof mcpPages;

export function publicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  imagePath?: string;
}): Metadata {
  const url = new URL(input.path, publicOrigin).href;
  const image = input.imagePath
    ? [{ url: new URL(input.imagePath, publicOrigin).href, width: ogSize.width, height: ogSize.height, alt: input.title }]
    : undefined;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: "website",
      url,
      siteName: "UGC Pilot",
      title: input.title,
      description: input.description,
      ...(image ? { images: image } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      ...(image ? { images: image.map((item) => item.url) } : {}),
    },
  };
}

export function faqJsonLd(faqs: readonly McpFaq[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function mcpSoftwareJsonLd(path: string, description: string, faqs: readonly McpFaq[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "UGC Pilot MCP Server",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        url: new URL(path, publicOrigin).href,
        installUrl: `${publicOrigin}/connect-ai`,
        description,
        featureList: `${MCP_TOOL_COUNT} MCP tools for account reads, image and video generation, speech, edit drafts, and exports`,
        provider: {
          "@type": "Organization",
          name: "UGC Pilot",
          url: publicOrigin,
          logo: `${publicOrigin}/brand/ugc-pilot-logo.png`,
        },
      },
      faqJsonLd(faqs),
    ],
  };
}

export function homepageJsonLd(description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "UGC Pilot",
        url: publicOrigin,
        logo: `${publicOrigin}/brand/ugc-pilot-logo.png`,
      },
      {
        "@type": "WebSite",
        name: "UGC Pilot",
        url: publicOrigin,
        publisher: { "@type": "Organization", name: "UGC Pilot", url: publicOrigin },
      },
      {
        "@type": "SoftwareApplication",
        name: "UGC Pilot",
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        url: publicOrigin,
        description,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          url: `${publicOrigin}/pricing`,
          description: "Seven-day trial with two one-time AI Studio credits. Paid plans start at $19 per month.",
        },
      },
    ],
  };
}

export function buildLlmsText() {
  const groups = publicMcpToolCatalog.groups
    .map((group) => `- ${group.title} (${group.tools.length}): ${group.tools.map((tool) => tool.name).join(", ")}`)
    .join("\n");
  return `# UGC Pilot

> AI UGC and video marketing studio with a hosted MCP server for Claude, Codex, and ChatGPT.

UGC Pilot creates UGC-style images, short videos, speech, and video edits from the signed-in account. The studio is at ${publicOrigin}. The MCP server is ${mcpEndpoint}.

## MCP setup

- Transport: Streamable HTTP
- Server URL: ${mcpEndpoint}
- Authorization server: ${mcpIssuer}
- Protected resource metadata: ${mcpIssuer}/.well-known/oauth-protected-resource
- Authorization server metadata: ${mcpIssuer}/.well-known/oauth-authorization-server
- Sign-in: OAuth authorization code with PKCE (S256). The consent screen is ${mcpIssuer}/oauth/authorize.
- Registration: dynamic client registration and client ID metadata documents are advertised. Public clients use token endpoint auth method none.
- Default scopes: ${mcpSetupScopes.join(", ")}
- Optional separate scope for account-default updates: ${mcpOptionalAccountScope}
- Tool count: ${publicMcpToolCount}, matching the public reference at ${publicOrigin}/docs/mcp-tools

### Claude

Open Customize → Connectors → Add custom connector. Name it UGC Pilot, paste ${mcpEndpoint}, and finish OAuth. Enable the connector in the conversation.

### Codex

Add this to ~/.codex/config.toml:

\`\`\`toml
${codexConfigToml.trim()}
\`\`\`

Then run:

\`\`\`sh
${codexLoginCommands}
\`\`\`

### First prompt

${connectionCheckPrompt}

## Tools by job

${groups}

## Pages

- ${publicOrigin}/
- ${publicOrigin}/mcp
- ${publicOrigin}/mcp/claude
- ${publicOrigin}/mcp/codex
- ${publicOrigin}/docs/mcp-tools
- ${publicOrigin}/connect-ai
- ${publicOrigin}/pricing
- ${publicOrigin}/guides
- ${publicOrigin}/ai-ugc-video-generator
- ${publicOrigin}/instagram-carousel-maker
`;
}
