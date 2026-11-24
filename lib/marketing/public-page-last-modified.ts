import pageDates from "./public-page-dates.json";

const dates = pageDates as Record<string, string>;

export function publicPageLastModified(path: string): Date {
  const value = dates[path];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    throw new Error(`Sitemap lastmod missing for ${path}`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}
