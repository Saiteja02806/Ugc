import assert from "node:assert/strict";
import test from "node:test";

import {
  extractPublicSupabaseUrlFromEnvFile,
  extractIpv6DnsAnswers,
  extractSupabaseProjectRef,
  findAwsRegionForIpv6,
  isIpv6InCidr,
  parseVercelRequestId,
  summarizeSamples,
} from "./measure-production-latency.mjs";

test("parses Vercel edge and function regions without guessing", () => {
  assert.deepEqual(
    parseVercelRequestId("bom1::iad1::request-id"),
    { edgeRegion: "bom1", functionRegion: "iad1" },
  );
  assert.deepEqual(parseVercelRequestId("bom1::request-id"), {
    edgeRegion: "bom1",
    functionRegion: null,
  });
  assert.deepEqual(parseVercelRequestId(null), {
    edgeRegion: null,
    functionRegion: null,
  });
});

test("summarizes measured samples with nearest-rank percentiles", () => {
  const summary = summarizeSamples([
    { durationMs: 40, status: 200 },
    { durationMs: 10, status: 200 },
    { durationMs: 50, status: 401 },
    { durationMs: 20, status: 200 },
    { durationMs: 30, status: 200 },
  ]);

  assert.deepEqual(summary, {
    maxMs: 50,
    medianMs: 30,
    minMs: 10,
    p95Ms: 50,
    samples: 5,
    statuses: [200, 401],
  });
  assert.equal(summarizeSamples([]), null);
});

test("extracts only a valid Supabase project reference", () => {
  assert.equal(
    extractSupabaseProjectRef("https://projectref.supabase.co"),
    "projectref",
  );
  assert.equal(
    extractSupabaseProjectRef("https://projectref.supabase.co.evil.example"),
    null,
  );
  assert.equal(extractSupabaseProjectRef("not a URL"), null);
});

test("reads only the public Supabase URL from a BOM-prefixed env file", () => {
  const contents =
    '\uFEFFNEXT_PUBLIC_SUPABASE_URL="https://projectref.supabase.co"\nSECRET=value';

  assert.equal(
    extractPublicSupabaseUrlFromEnvFile(contents),
    "https://projectref.supabase.co",
  );
  assert.equal(
    extractPublicSupabaseUrlFromEnvFile("SECRET=value"),
    null,
  );
});

test("matches a database IPv6 address against the authoritative AWS CIDR", () => {
  const address = "2600:1f16:1ce4:1c02:dba2:2278:f945:4a5b";

  assert.equal(isIpv6InCidr(address, "2600:1f16::/34"), true);
  assert.equal(isIpv6InCidr(address, "2600:1f18::/34"), false);
  assert.equal(isIpv6InCidr("127.0.0.1", "2600:1f16::/34"), false);
});

test("returns the exact AWS region metadata for a matching IPv6 range", () => {
  assert.deepEqual(
    findAwsRegionForIpv6("2600:1f16:1ce4::1", [
      {
        ipv6_prefix: "2600:1f18::/34",
        network_border_group: "us-east-1",
        region: "us-east-1",
        service: "AMAZON",
      },
      {
        ipv6_prefix: "2600:1f16::/34",
        network_border_group: "us-east-2",
        region: "us-east-2",
        service: "AMAZON",
      },
    ]),
    {
      networkBorderGroup: "us-east-2",
      prefix: "2600:1f16::/34",
      region: "us-east-2",
      service: "AMAZON",
    },
  );
});

test("accepts only unique IPv6 DNS answers", () => {
  assert.deepEqual(
    extractIpv6DnsAnswers({
      Answer: [
        { data: "2600:1f16:1ce4::1", type: 28 },
        { data: "2600:1f16:1ce4::1", type: 28 },
        { data: "192.0.2.1", type: 1 },
        { data: "not-an-address", type: 28 },
      ],
    }),
    ["2600:1f16:1ce4::1"],
  );
  assert.deepEqual(extractIpv6DnsAnswers(null), []);
});
