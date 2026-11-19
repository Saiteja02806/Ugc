import type { MetadataRoute } from "next";
import { publicPagePaths, publicPageUrl } from "@/lib/marketing/public-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  // A single build-time timestamp keeps lastmod honest: every entry reflects the
  // last release that could have changed the rendered page.
  const lastModified = new Date();
  return publicPagePaths.map((path) => ({ url: publicPageUrl(path), lastModified }));
}
