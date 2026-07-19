import dns from "node:dns/promises";

const options = parseArguments(process.argv.slice(2));
const host = options.host || "media.getugcpilot.com";
const expectedIp = options.expectedIp || "8.233.40.78";
const probePath = normalizePath(options.path || "/__gcp-media-cdn-readiness");
const requireObject = Boolean(options.objectKey);
const url = `https://${host}${normalizePath(options.objectKey || probePath)}`;

const addresses = await resolveARecords(host);
const unexpectedAddresses = addresses.filter((address) => address !== expectedIp);

console.log(`Host: ${host}`);
console.log(`Expected GCP CDN IP: ${expectedIp}`);
console.log(`Current A records: ${addresses.length ? addresses.join(", ") : "none"}`);

if (!addresses.includes(expectedIp) || unexpectedAddresses.length > 0) {
  throw new Error(
    `DNS is not cut over. Set ${host} A record to ${expectedIp} and remove conflicting A records: ${
      unexpectedAddresses.length ? unexpectedAddresses.join(", ") : "none"
    }.`,
  );
}

const response = await fetch(url, {
  cache: "no-store",
  method: "GET",
  redirect: "manual",
});

console.log(`HTTPS probe: ${url}`);
console.log(`HTTPS status: ${response.status}`);

if (requireObject && response.status !== 200) {
  throw new Error(`Expected CDN object read to return 200, got ${response.status}.`);
}

if (!requireObject && response.status >= 500) {
  throw new Error(`Expected CDN HTTPS probe below 500, got ${response.status}.`);
}

console.log("GCP media CDN DNS and HTTPS check passed");

async function resolveARecords(name) {
  try {
    const records = await dns.lookup(name, {
      all: true,
      family: 4,
      verbatim: true,
    });

    return records.map((record) => record.address);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);

      if (code === "ENODATA" || code === "ENOTFOUND") {
        return [];
      }
    }

    throw error;
  }
}

function parseArguments(args) {
  const parsed = {
    expectedIp: null,
    host: null,
    objectKey: null,
    path: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--expected-ip") {
      parsed.expectedIp = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--host") {
      parsed.host = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--object-key") {
      parsed.objectKey = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    if (argument === "--path") {
      parsed.path = getRequiredArgumentValue(args, (index += 1), argument);
      continue;
    }

    throw new Error(`Unknown option ${argument}.`);
  }

  return parsed;
}

function getRequiredArgumentValue(args, index, flag) {
  const value = args[index]?.trim();

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function normalizePath(value) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "/";
  }

  return trimmedValue.startsWith("/") ? trimmedValue : `/${trimmedValue}`;
}
