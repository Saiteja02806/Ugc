export const INSTAGRAM_OEMBED_ENDPOINT =
  "https://graph.facebook.com/v25.0/instagram_oembed";

export const MAX_VIRAL_IMPORT_ITEMS = 50;
export const MAX_VIRAL_IMPORT_FILE_BYTES = 64 * 1024;
export const MAX_INSTAGRAM_EMBED_HTML_LENGTH = 100_000;

export type NormalizedInstagramReel = {
  lineNumber: number;
  shortcode: string;
  sourceUrl: string;
};

export type NormalizedInstagramPost = NormalizedInstagramReel;

export type ViralImportRejection = {
  input: string;
  lineNumber: number;
  reason: string;
};

export type ParsedInstagramReelInput = {
  duplicateInputs: Array<NormalizedInstagramReel>;
  reels: Array<NormalizedInstagramReel>;
  rejected: Array<ViralImportRejection>;
};

export type ViralImportSection =
  | "hook_video"
  | "wall_of_text"
  | "slideshow";

export type PreparedViralReference = {
  embed_html: string;
  embed_status: "active";
  last_verified_at: string;
  platform: "instagram";
  publish_status: "pending_review";
  section: ViralImportSection;
  source_url: string;
};

export type ViralImportPreparation = {
  duplicateDatabaseUrls: Array<string>;
  prepared: Array<PreparedViralReference>;
  rejected: Array<ViralImportRejection>;
};

type FetchInstagramOEmbedOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type PrepareInstagramReelImportsOptions = {
  existingSourceUrls: ReadonlySet<string>;
  fetchOEmbed?: (sourceUrl: string) => Promise<string>;
  section?: ViralImportSection;
  verifiedAt?: string;
};

export class ViralImportInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViralImportInputError";
  }
}

export function normalizeInstagramReelUrl(
  rawInput: string,
): Omit<NormalizedInstagramReel, "lineNumber"> {
  return normalizeInstagramMediaUrl(rawInput, "reel");
}

export function normalizeInstagramPostUrl(
  rawInput: string,
): Omit<NormalizedInstagramPost, "lineNumber"> {
  return normalizeInstagramMediaUrl(rawInput, "p");
}

function normalizeInstagramMediaUrl(
  rawInput: string,
  pathKind: "p" | "reel",
): Omit<NormalizedInstagramReel, "lineNumber"> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new ViralImportInputError("The URL is empty.");
  }

  const candidate = /^(?:www\.)?instagram\.com\//i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ViralImportInputError("This is not a valid URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ViralImportInputError("Only HTTP or HTTPS URLs are allowed.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "instagram.com" && hostname !== "www.instagram.com") {
    throw new ViralImportInputError(
      "Only instagram.com URLs are allowed.",
    );
  }

  if (parsed.username || parsed.password || parsed.port) {
    throw new ViralImportInputError(
      "Instagram URLs cannot contain credentials or a custom port.",
    );
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0].toLowerCase() !== pathKind) {
    const expectedPath = pathKind === "p" ? "p" : "reel";
    throw new ViralImportInputError(
      `Use a direct Instagram URL in the form instagram.com/${expectedPath}/SHORTCODE/.`,
    );
  }

  const shortcode = segments[1];
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(shortcode)) {
    throw new ViralImportInputError("The Instagram shortcode is invalid.");
  }

  return {
    shortcode,
    sourceUrl: `https://www.instagram.com/${pathKind}/${shortcode}/`,
  };
}

export function parseInstagramReelInput(
  text: string,
  options: { maxItems?: number } = {},
): ParsedInstagramReelInput {
  return parseInstagramMediaInput(text, normalizeInstagramReelUrl, options);
}

export function parseInstagramPostInput(
  text: string,
  options: { maxItems?: number } = {},
): ParsedInstagramReelInput {
  return parseInstagramMediaInput(text, normalizeInstagramPostUrl, options);
}

function parseInstagramMediaInput(
  text: string,
  normalize: (
    rawInput: string,
  ) => Omit<NormalizedInstagramReel, "lineNumber">,
  options: { maxItems?: number },
): ParsedInstagramReelInput {
  const maxItems = options.maxItems ?? MAX_VIRAL_IMPORT_ITEMS;
  if (!Number.isSafeInteger(maxItems) || maxItems < 1) {
    throw new ViralImportInputError("The import item limit is invalid.");
  }

  const candidates = text
    .split(/\r?\n/)
    .map((input, index) => ({ input: input.trim(), lineNumber: index + 1 }))
    .filter(({ input }) => input && !input.startsWith("#"));

  if (candidates.length > maxItems) {
    throw new ViralImportInputError(
      `The file contains ${candidates.length} URLs. The safe limit is ${maxItems} per run.`,
    );
  }

  const reels: Array<NormalizedInstagramReel> = [];
  const duplicateInputs: Array<NormalizedInstagramReel> = [];
  const rejected: Array<ViralImportRejection> = [];
  const seenSourceUrls = new Set<string>();

  for (const candidate of candidates) {
    try {
      const normalized = normalize(candidate.input);
      const reel = { ...normalized, lineNumber: candidate.lineNumber };

      if (seenSourceUrls.has(reel.sourceUrl)) {
        duplicateInputs.push(reel);
        continue;
      }

      seenSourceUrls.add(reel.sourceUrl);
      reels.push(reel);
    } catch (error) {
      rejected.push({
        input: candidate.input,
        lineNumber: candidate.lineNumber,
        reason:
          error instanceof ViralImportInputError
            ? error.message
            : "The URL could not be validated.",
      });
    }
  }

  return { duplicateInputs, reels, rejected };
}

export function buildInstagramOEmbedUrl(sourceUrl: string): string {
  const endpoint = new URL(INSTAGRAM_OEMBED_ENDPOINT);
  endpoint.searchParams.set("url", sourceUrl);
  return endpoint.toString();
}

export function sanitizeInstagramEmbedHtml(rawHtml: string): string {
  if (typeof rawHtml !== "string") {
    throw new ViralImportInputError("Meta returned invalid embed HTML.");
  }

  if (
    rawHtml.length < 1 ||
    rawHtml.length > MAX_INSTAGRAM_EMBED_HTML_LENGTH
  ) {
    throw new ViralImportInputError(
      "Meta returned embed HTML with an unsafe size.",
    );
  }

  const html = rawHtml
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .trim();

  if (!/^<blockquote\b/i.test(html)) {
    throw new ViralImportInputError(
      "Meta did not return an Instagram blockquote embed.",
    );
  }

  if (!/class\s*=\s*(["'])[^"']*\binstagram-media\b[^"']*\1/i.test(html)) {
    throw new ViralImportInputError(
      "Meta returned embed HTML without the Instagram embed marker.",
    );
  }

  const forbiddenMarkup =
    /<(?:iframe|object|embed|form|meta|link)\b|\son[a-z]+\s*=|javascript\s*:/i;
  if (forbiddenMarkup.test(html)) {
    throw new ViralImportInputError(
      "Meta returned embed HTML containing forbidden markup.",
    );
  }

  return html;
}

export async function fetchInstagramOEmbed(
  sourceUrl: string,
  options: FetchInstagramOEmbedOptions = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(buildInstagramOEmbedUrl(sourceUrl), {
      headers: { Accept: "application/json" },
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 404) {
        throw new ViralImportInputError(
          "Meta could not find a public, embeddable Instagram post at this URL.",
        );
      }
      if (response.status === 429) {
        throw new ViralImportInputError(
          "Meta rate-limited the embed lookup. Try this import again later.",
        );
      }
      throw new ViralImportInputError(
        `Meta embed lookup failed with HTTP ${response.status}.`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ViralImportInputError("Meta returned an invalid JSON response.");
    }

    if (!isRecord(payload)) {
      throw new ViralImportInputError("Meta returned an invalid embed response.");
    }

    if (
      typeof payload.provider_name !== "string" ||
      payload.provider_name.toLowerCase() !== "instagram"
    ) {
      throw new ViralImportInputError(
        "Meta returned an embed from an unexpected provider.",
      );
    }

    if (
      typeof payload.provider_url === "string" &&
      !isTrustedInstagramProviderUrl(payload.provider_url)
    ) {
      throw new ViralImportInputError(
        "Meta returned an untrusted Instagram provider URL.",
      );
    }

    if (typeof payload.html !== "string") {
      throw new ViralImportInputError("Meta returned no embed HTML.");
    }

    return sanitizeInstagramEmbedHtml(payload.html);
  } catch (error) {
    if (error instanceof ViralImportInputError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new ViralImportInputError("Meta embed lookup timed out.");
    }
    throw new ViralImportInputError("Meta embed lookup could not be completed.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function prepareInstagramReelImports(
  reels: ReadonlyArray<NormalizedInstagramReel>,
  options: PrepareInstagramReelImportsOptions,
): Promise<ViralImportPreparation> {
  const fetchOEmbed = options.fetchOEmbed ?? ((url) => fetchInstagramOEmbed(url));
  const section = options.section ?? "hook_video";
  const verifiedAt = options.verifiedAt ?? new Date().toISOString();
  const duplicateDatabaseUrls: Array<string> = [];
  const prepared: Array<PreparedViralReference> = [];
  const rejected: Array<ViralImportRejection> = [];

  for (const reel of reels) {
    if (options.existingSourceUrls.has(reel.sourceUrl)) {
      duplicateDatabaseUrls.push(reel.sourceUrl);
      continue;
    }

    try {
      const embedHtml = await fetchOEmbed(reel.sourceUrl);
      prepared.push({
        embed_html: embedHtml,
        embed_status: "active",
        last_verified_at: verifiedAt,
        platform: "instagram",
        publish_status: "pending_review",
        section,
        source_url: reel.sourceUrl,
      });
    } catch (error) {
      rejected.push({
        input: reel.sourceUrl,
        lineNumber: reel.lineNumber,
        reason:
          error instanceof ViralImportInputError
            ? error.message
            : "The Reel embed could not be verified.",
      });
    }
  }

  return { duplicateDatabaseUrls, prepared, rejected };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTrustedInstagramProviderUrl(value: string): boolean {
  try {
    const providerUrl = new URL(value);
    return (
      providerUrl.protocol === "https:" &&
      (providerUrl.hostname.toLowerCase() === "instagram.com" ||
        providerUrl.hostname.toLowerCase() === "www.instagram.com")
    );
  } catch {
    return false;
  }
}
