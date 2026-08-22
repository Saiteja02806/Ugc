import { resolve6 } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "https://getugcpilot.com";
const DEFAULT_SAMPLES = 10;
const MAX_SAMPLES = 50;
const AWS_IP_RANGES_URL = "https://ip-ranges.amazonaws.com/ip-ranges.json";
const DNS_OVER_HTTPS_URL = "https://cloudflare-dns.com/dns-query";

export function parseVercelRequestId(value) {
  const parts = String(value ?? "")
    .split("::")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return { edgeRegion: parts[0] ?? null, functionRegion: null };
  }

  return {
    edgeRegion: parts[0],
    functionRegion: parts.length >= 3 ? parts[1] : null,
  };
}

export function summarizeSamples(samples) {
  if (samples.length === 0) {
    return null;
  }

  const values = samples.map((sample) => sample.durationMs);

  return {
    maxMs: Math.max(...values),
    medianMs: percentile(values, 0.5),
    minMs: Math.min(...values),
    p95Ms: percentile(values, 0.95),
    samples: samples.length,
    statuses: Array.from(new Set(samples.map((sample) => sample.status))).sort(
      (left, right) => left - right,
    ),
  };
}

export function extractSupabaseProjectRef(value) {
  if (!value) {
    return null;
  }

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const match = /^([a-z0-9]+)\.supabase\.co$/.exec(hostname);

    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function extractPublicSupabaseUrlFromEnvFile(contents) {
  const line = String(contents)
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("NEXT_PUBLIC_SUPABASE_URL="));

  if (!line) {
    return null;
  }

  const value = line
    .slice("NEXT_PUBLIC_SUPABASE_URL=".length)
    .trim()
    .replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");

  return extractSupabaseProjectRef(value) ? value : null;
}

export function isIpv6InCidr(address, cidr) {
  const [network, rawPrefixLength] = cidr.split("/", 2);
  const prefixLength = Number(rawPrefixLength);

  if (
    isIP(address) !== 6 ||
    isIP(network) !== 6 ||
    !Number.isInteger(prefixLength) ||
    prefixLength < 0 ||
    prefixLength > 128
  ) {
    return false;
  }

  const addressValue = ipv6ToBigInt(address);
  const networkValue = ipv6ToBigInt(network);
  const hostBits = 128n - BigInt(prefixLength);
  const mask =
    prefixLength === 0
      ? 0n
      : ((1n << BigInt(prefixLength)) - 1n) << hostBits;

  return (addressValue & mask) === (networkValue & mask);
}

export function findAwsRegionForIpv6(address, ranges) {
  const matchingRange = ranges.find(
    (range) =>
      typeof range?.ipv6_prefix === "string" &&
      isIpv6InCidr(address, range.ipv6_prefix),
  );

  return matchingRange
    ? {
        networkBorderGroup: matchingRange.network_border_group ?? null,
        prefix: matchingRange.ipv6_prefix,
        region: matchingRange.region ?? null,
        service: matchingRange.service ?? null,
      }
    : null;
}

export function extractIpv6DnsAnswers(data) {
  if (!Array.isArray(data?.Answer)) {
    return [];
  }

  return Array.from(
    new Set(
      data.Answer.filter(
        (answer) => answer?.type === 28 && isIP(answer.data) === 6,
      ).map((answer) => answer.data),
    ),
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(
    options.baseUrl ?? process.env.PRODUCTION_BASE_URL ?? DEFAULT_BASE_URL,
  );
  const sampleCount = normalizeSampleCount(options.samples);
  const supabaseUrl =
    options.supabaseUrl ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    (await readLocalPublicSupabaseUrl());
  const connectionWarmup = await measureRequest(`${baseUrl}/status`, 0);
  const staticSamples = await measureRequests(
    `${baseUrl}/status`,
    sampleCount,
  );
  const functionSamples = await measureRequests(
    `${baseUrl}/api/business-profile`,
    sampleCount,
  );
  const vercelRegions = getObservedVercelRegions([
    ...staticSamples,
    ...functionSamples,
  ]);
  const database = await inspectSupabaseDatabaseRegion(supabaseUrl);

  const report = {
    baseUrl,
    database,
    generatedAt: new Date().toISOString(),
    methodology: {
      coldStartQualification:
        "The first function sample is first-observed after a connection warm-up; only Vercel invocation logs can prove that an invocation was a cold start.",
      dynamicProbe:
        "Unauthenticated GET /api/business-profile. A 401 response is expected and exercises the deployed Node function without reading user data.",
      staticProbe: "Uncached GET /status through the nearest Vercel edge.",
    },
    networkConnectionWarmupMs: connectionWarmup.durationMs,
    staticEdge: {
      summary: summarizeSamples(staticSamples),
      vercelRegions: getObservedVercelRegions(staticSamples),
    },
    vercelFunction: {
      firstObservedMs: functionSamples[0]?.durationMs ?? null,
      summary: summarizeSamples(functionSamples),
      warmedSummary: summarizeSamples(functionSamples.slice(1)),
      vercelRegions: getObservedVercelRegions(functionSamples),
    },
    vercelRegions,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

async function measureRequests(url, count) {
  const samples = [];

  for (let index = 0; index < count; index += 1) {
    samples.push(await measureRequest(url, index));
  }

  return samples;
}

async function measureRequest(url, index) {
  const requestUrl = new URL(url);
  requestUrl.searchParams.set(
    "phase7_probe",
    `${Date.now().toString(36)}-${index.toString(36)}`,
  );
  const startedAt = performance.now();
  const response = await fetch(requestUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      "User-Agent": "UGCPilot-Production-Latency-Audit/1.0",
    },
  });

  await response.arrayBuffer();

  return {
    durationMs: roundMilliseconds(performance.now() - startedAt),
    status: response.status,
    vercelId: response.headers.get("x-vercel-id"),
  };
}

function getObservedVercelRegions(samples) {
  const edgeRegions = new Set();
  const functionRegions = new Set();

  for (const sample of samples) {
    const parsed = parseVercelRequestId(sample.vercelId);

    if (parsed.edgeRegion) {
      edgeRegions.add(parsed.edgeRegion);
    }

    if (parsed.functionRegion) {
      functionRegions.add(parsed.functionRegion);
    }
  }

  return {
    edge: Array.from(edgeRegions).sort(),
    function: Array.from(functionRegions).sort(),
  };
}

async function inspectSupabaseDatabaseRegion(supabaseUrl) {
  const projectRef = extractSupabaseProjectRef(supabaseUrl);

  if (!projectRef) {
    return {
      message:
        "Set NEXT_PUBLIC_SUPABASE_URL or pass --supabase-url to resolve the database AWS region.",
      status: "not_configured",
    };
  }

  const host = `db.${projectRef}.supabase.co`;

  try {
    const [addresses, response] = await Promise.all([
      resolveDatabaseIpv6(host),
      fetch(AWS_IP_RANGES_URL, { cache: "no-store" }),
    ]);

    if (!response.ok) {
      throw new Error(`AWS IP range lookup returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    const ranges = Array.isArray(data?.ipv6_prefixes)
      ? data.ipv6_prefixes
      : [];
    const matches = addresses
      .map((address) => ({
        address,
        aws: findAwsRegionForIpv6(address, ranges),
      }))
      .filter((entry) => entry.aws);

    return {
      addresses,
      host,
      matches,
      status: matches.length > 0 ? "resolved" : "unmapped",
    };
  } catch (error) {
    return {
      host,
      message: error instanceof Error ? error.message : String(error),
      status: "error",
    };
  }
}

async function resolveDatabaseIpv6(host) {
  try {
    return await resolve6(host);
  } catch {
    const url = new URL(DNS_OVER_HTTPS_URL);
    url.searchParams.set("name", host);
    url.searchParams.set("type", "AAAA");
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/dns-json" },
    });

    if (!response.ok) {
      throw new Error(`DNS lookup returned HTTP ${response.status}.`);
    }

    const addresses = extractIpv6DnsAnswers(await response.json());

    if (addresses.length === 0) {
      throw new Error(`DNS lookup returned no IPv6 address for ${host}.`);
    }

    return addresses;
  }
}

async function readLocalPublicSupabaseUrl() {
  try {
    const contents = await readFile(".env.local", "utf8");

    return extractPublicSupabaseUrlFromEnvFile(contents);
  } catch {
    return null;
  }
}

function parseArguments(argumentsList) {
  const options = {};

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    if (argument === "--base-url" && value) {
      options.baseUrl = value;
      index += 1;
    } else if (argument === "--samples" && value) {
      options.samples = value;
      index += 1;
    } else if (argument === "--supabase-url" && value) {
      options.supabaseUrl = value;
      index += 1;
    } else if (argument === "--help") {
      process.stdout.write(
        "Usage: node scripts/measure-production-latency.mjs [--base-url URL] [--samples 1-50] [--supabase-url URL]\n",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  return options;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);

  if (url.protocol !== "https:") {
    throw new Error("The production latency probe requires an HTTPS base URL.");
  }

  return url.origin;
}

function normalizeSampleCount(value) {
  const count = value === undefined ? DEFAULT_SAMPLES : Number(value);

  if (!Number.isInteger(count) || count < 1 || count > MAX_SAMPLES) {
    throw new Error(`--samples must be an integer from 1 to ${MAX_SAMPLES}.`);
  }

  return count;
}

function percentile(values, quantile) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);

  return sorted[index];
}

function ipv6ToBigInt(address) {
  const [leftRaw, rightRaw = ""] = address.toLowerCase().split("::", 2);
  const left = leftRaw ? leftRaw.split(":") : [];
  const right = rightRaw ? rightRaw.split(":") : [];
  const missingGroups = 8 - left.length - right.length;

  if (missingGroups < 0 || (!address.includes("::") && missingGroups !== 0)) {
    throw new Error(`Invalid IPv6 address: ${address}`);
  }

  const groups = [
    ...left,
    ...Array.from({ length: missingGroups }, () => "0"),
    ...right,
  ];

  if (groups.length !== 8) {
    throw new Error(`Invalid IPv6 address: ${address}`);
  }

  return groups.reduce((value, group) => {
    if (!/^[0-9a-f]{1,4}$/.test(group)) {
      throw new Error(`Invalid IPv6 address: ${address}`);
    }

    return (value << 16n) + BigInt(`0x${group}`);
  }, 0n);
}

function roundMilliseconds(value) {
  return Number(value.toFixed(1));
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
