import dns from "node:dns/promises";
import { isIP } from "node:net";

import { WebsiteAnalysisError } from "@/lib/website-analysis/errors";

const MAX_URL_LENGTH = 2_048;
const DEFAULT_PROTOCOL = "https://";
const IMPORTANT_PAGE_PATHS = [
  "/features",
  "/pricing",
  "/about",
  "/product",
  "/products",
  "/solutions",
];

type ValidWebsiteUrl = {
  normalizedDomain: string;
  origin: string;
  url: string;
};

function inputToUrl(value: unknown) {
  if (typeof value !== "string") {
    throw new WebsiteAnalysisError("Website URL is required.", 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new WebsiteAnalysisError("Website URL is required.", 400);
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new WebsiteAnalysisError("Website URL is too long.", 400);
  }

  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `${DEFAULT_PROTOCOL}${trimmed}`;

  try {
    return new URL(withProtocol);
  } catch {
    throw new WebsiteAnalysisError("Enter a valid website URL.", 400);
  }
}

function normalizeHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized.slice(1, -1);
  }

  return normalized;
}

function isPrivateIPv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = parts;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIPv6(address: string) {
  const normalized = address.toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isUnsafeIpAddress(address: string) {
  const version = isIP(address);

  if (version === 4) {
    return isPrivateIPv4(address);
  }

  if (version === 6) {
    return isPrivateIPv6(address);
  }

  return false;
}

function rejectUnsafeHostname(hostname: string) {
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new WebsiteAnalysisError("Local website URLs are not allowed.", 400);
  }

  if (isUnsafeIpAddress(hostname)) {
    throw new WebsiteAnalysisError("Private network URLs are not allowed.", 400);
  }
}

async function rejectUnsafeResolvedAddresses(hostname: string) {
  if (isIP(hostname)) {
    return;
  }

  let addresses: Array<{ address: string; family: number }>;

  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new WebsiteAnalysisError("Could not resolve that website URL.", 400);
  }

  if (addresses.length === 0) {
    throw new WebsiteAnalysisError("Could not resolve that website URL.", 400);
  }

  if (addresses.some((address) => isUnsafeIpAddress(address.address))) {
    throw new WebsiteAnalysisError("Private network URLs are not allowed.", 400);
  }
}

export async function validateWebsiteUrl(value: unknown): Promise<ValidWebsiteUrl> {
  const url = inputToUrl(value);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new WebsiteAnalysisError("Only HTTP and HTTPS URLs are supported.", 400);
  }

  if (url.username || url.password) {
    throw new WebsiteAnalysisError("Website URLs cannot include credentials.", 400);
  }

  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new WebsiteAnalysisError("Custom URL ports are not supported.", 400);
  }

  const hostname = normalizeHostname(url.hostname);
  rejectUnsafeHostname(hostname);
  await rejectUnsafeResolvedAddresses(hostname);

  url.hash = "";
  const normalizedDomain = hostname.replace(/^www\./, "");

  return {
    normalizedDomain,
    origin: url.origin,
    url: url.toString(),
  };
}

export function buildImportantPageUrls(origin: string) {
  return IMPORTANT_PAGE_PATHS.map((path) => new URL(path, origin).toString());
}
