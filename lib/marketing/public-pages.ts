import pagePaths from "./public-page-paths.json";

// Sitemap generation and release verification share the same public inventory.
// Account/workspace routes stay out.
export const publicPagePaths = pagePaths;

export const publicOrigin = "https://getugcpilot.com";

export function publicPageUrl(path: string): string {
  return new URL(path, publicOrigin).href;
}
