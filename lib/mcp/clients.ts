import "server-only";

import { lookup } from "node:dns/promises";
import https from "node:https";
import { isIP } from "node:net";
import { randomBytes } from "node:crypto";
import ipaddr from "ipaddr.js";

import {
  supportsPublicClientTokenExchange,
  validRedirectUri,
} from "./client-validation";
import { getMcpStore } from "./store";

export type McpOAuthClient = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
};

export async function resolveMcpClient(clientId: string): Promise<McpOAuthClient | null> {
  if (clientId.length > 512) return null;
  if (clientId.startsWith("https://")) return fetchClientMetadata(clientId);
  const { data, error } = await getMcpStore()
    .from("mcp_oauth_clients")
    .select("client_id,client_name,redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data ? {
    clientId: data.client_id,
    clientName: data.client_name,
    redirectUris: data.redirect_uris,
  } : null;
}

async function fetchClientMetadata(clientId: string): Promise<McpOAuthClient | null> {
  try {
    const startedAt = Date.now();
    const url = new URL(clientId);
    if (url.protocol !== "https:" || !url.pathname || url.pathname === "/" ||
        url.username || url.password || url.hash || (url.port && url.port !== "443") ||
        isIP(url.hostname) || url.hostname === "localhost") return null;

    const addresses = await withDeadline(lookup(url.hostname, { all: true }), 5000);
    if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) return null;
    const remainingMs = 5000 - (Date.now() - startedAt);
    if (remainingMs <= 0) return null;
    const body = await pinnedHttpsJson(url, addresses[0], remainingMs);
    const metadata = JSON.parse(body) as Record<string, unknown>;
    if (metadata.client_id !== clientId ||
        typeof metadata.client_name !== "string" || !metadata.client_name.trim() ||
        !Array.isArray(metadata.redirect_uris) ||
        metadata.redirect_uris.length === 0 || metadata.redirect_uris.length > 10 ||
        !metadata.redirect_uris.every((uri) => typeof uri === "string" && validRedirectUri(uri)) ||
        !supportsPublicClientTokenExchange(metadata)) return null;
    return {
      clientId,
      clientName: metadata.client_name.trim().slice(0, 100),
      redirectUris: metadata.redirect_uris as string[],
    };
  } catch {
    return null;
  }
}

function withDeadline<T>(pending: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Client metadata timeout.")), timeoutMs);
    pending.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function publicAddress(address: string) {
  try {
    const parsed = ipaddr.parse(address);
    const normalized = parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()
      ? (parsed as ipaddr.IPv6).toIPv4Address()
      : parsed;
    return normalized.range() === "unicast";
  } catch {
    return false;
  }
}

function pinnedHttpsJson(url: URL, address: { address: string; family: number }, timeoutMs: number) {
  return new Promise<string>((resolve, reject) => {
    const request = https.get(url, {
      headers: { Accept: "application/json" },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    }, (response) => {
      if (response.statusCode !== 200 ||
          !response.headers["content-type"]?.includes("application/json")) {
        request.destroy(new Error("Invalid client metadata response."));
        return;
      }
      const chunks: Buffer[] = [];
      let byteLength = 0;
      response.on("data", (chunk: Buffer) => {
        byteLength += chunk.length;
        if (byteLength > 32768) request.destroy(new Error("Client metadata too large."));
        else chunks.push(chunk);
      });
      response.on("end", () => {
        clearTimeout(deadline);
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
      response.on("error", (error) => {
        clearTimeout(deadline);
        reject(error);
      });
    });
    const deadline = setTimeout(() => request.destroy(new Error("Client metadata timeout.")), timeoutMs);
    request.on("error", (error) => {
      clearTimeout(deadline);
      reject(error);
    });
  });
}

export function newOAuthSecret() {
  return randomBytes(32).toString("base64url");
}
