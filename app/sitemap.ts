import type { MetadataRoute } from "next";

import { publicPageLastModified } from "@/lib/marketing/public-page-last-modified";
import { publicPagePaths, publicPageUrl } from "@/lib/marketing/public-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPagePaths.map((path) => ({
    url: publicPageUrl(path),
    lastModified: publicPageLastModified(path),
  }));
}
