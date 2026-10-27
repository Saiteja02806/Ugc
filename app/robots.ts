import type { MetadataRoute } from "next";

const privatePaths = [
  "/api/",
  "/mcp-server",
  "/oauth/",
  "/e2e/",
  "/image-test",
  "/tinder",
  "/ai-studio",
  "/aivideos",
  "/analytics",
  "/audio-generation",
  "/auth/",
  "/avatars",
  "/connected-accounts",
  "/create-content",
  "/dashboard",
  "/demos",
  "/edit",
  "/explore",
  "/image-gen",
  "/library",
  "/onboarding",
  "/projects",
  "/scheduling",
  "/settings",
  "/sign-in",
  "/updates",
  "/verify-email",
  "/video-gen",
  "/viral",
];

const searchAgents = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      ...searchAgents.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: privatePaths,
      })),
    ],
    sitemap: "https://getugcpilot.com/sitemap.xml",
  };
}
