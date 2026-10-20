import type { MetadataRoute } from "next";
import { publicPagePaths, publicPageUrl } from "@/lib/marketing/public-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPagePaths.map((path) => ({ url: publicPageUrl(path) }));
}
