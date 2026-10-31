import pagePaths from "./public-page-paths.json";

import { publicOrigin } from "./public-origin";

// Sitemap generation and release verification share the same public inventory.
// Account/workspace routes stay out.
export const publicPagePaths = pagePaths;

export { publicOrigin };

export function publicPageUrl(path: string): string {
  return new URL(path, publicOrigin).href;
}
