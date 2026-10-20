export type StoreProductMetadata = {
  iconUrl: string;
  name: string;
  sourceLabel: "App Store" | "Google Play";
};

type StoreProductSource =
  | { appId: string; kind: "app-store" }
  | { kind: "play-store"; packageId: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<{
  json(): Promise<unknown>;
  ok: boolean;
  text(): Promise<string>;
}>;

const MAX_SOURCE_URL_LENGTH = 2_048;

export function isStoreProductUrl(sourceUrl: string | undefined) {
  return parseStoreProductUrl(sourceUrl) !== null;
}

export function parseStoreProductUrl(sourceUrl: string | undefined): StoreProductSource | null {
  if (!sourceUrl || sourceUrl.length > MAX_SOURCE_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "apps.apple.com" || hostname === "itunes.apple.com") {
    const appId = url.pathname.match(/\/id(\d+)(?:\/|$)/i)?.[1];
    return appId ? { appId, kind: "app-store" } : null;
  }

  if (hostname === "play.google.com" && url.pathname === "/store/apps/details") {
    const packageId = url.searchParams.get("id")?.trim();
    return packageId && /^[a-zA-Z][a-zA-Z0-9_.$-]{1,254}$/.test(packageId)
      ? { kind: "play-store", packageId }
      : null;
  }

  return null;
}

export async function resolveStoreProductMetadata(
  sourceUrl: string | undefined,
  fetchImpl: FetchLike = fetch,
): Promise<StoreProductMetadata | null> {
  const source = parseStoreProductUrl(sourceUrl);
  if (!source) return null;

  return source.kind === "app-store"
    ? resolveAppStoreProduct(source.appId, fetchImpl)
    : resolvePlayStoreProduct(source.packageId, fetchImpl);
}

async function resolveAppStoreProduct(appId: string, fetchImpl: FetchLike) {
  const response = await fetchImpl(
    `https://itunes.apple.com/lookup?id=${encodeURIComponent(appId)}&entity=software`,
    { signal: AbortSignal.timeout(5_000) },
  );
  if (!response.ok) return null;

  const payload = await response.json();
  const item = isRecord(payload) && Array.isArray(payload.results) ? payload.results[0] : null;
  if (!isRecord(item)) return null;

  const name = readString(item.trackName);
  const iconUrl = readTrustedIconUrl(item.artworkUrl512, "apple");
  return name && iconUrl ? { iconUrl, name, sourceLabel: "App Store" as const } : null;
}

async function resolvePlayStoreProduct(packageId: string, fetchImpl: FetchLike) {
  const response = await fetchImpl(
    `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&hl=en&gl=US`,
    {
      headers: { "User-Agent": "UGC Pilot product setup" },
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!response.ok) return null;

  const page = await response.text();
  const name = readMetaTag(page, "og:title")?.replace(/\s+-\s+Apps on Google Play$/i, "").trim();
  const iconUrl = readTrustedIconUrl(readMetaTag(page, "og:image"), "google");
  return name && iconUrl ? { iconUrl, name, sourceLabel: "Google Play" as const } : null;
}

function readMetaTag(page: string, target: string) {
  for (const tag of page.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = readHtmlAttributes(tag);
    if ((attributes.property ?? attributes.name)?.toLowerCase() === target.toLowerCase()) {
      return decodeHtmlAttribute(attributes.content);
    }
  }
  return null;
}

function readHtmlAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function decodeHtmlAttribute(value: string | undefined) {
  if (!value) return null;
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'");
}

function readTrustedIconUrl(value: unknown, store: "apple" | "google") {
  const raw = readString(value);
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const isTrusted = store === "apple"
      ? host === "mzstatic.com" || host.endsWith(".mzstatic.com")
      : host === "googleusercontent.com" || host.endsWith(".googleusercontent.com") || host === "play.google.com";
    return isTrusted ? url.toString() : null;
  } catch {
    return null;
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
