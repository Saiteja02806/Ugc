const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_BYTES = 500 * 1024 * 1024;

export async function downloadVideoToBuffer(
  url: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
  } = {},
) {
  return downloadMediaToBuffer(url, {
    ...options,
    acceptedContentTypes: ["video/", "application/octet-stream"],
    mediaLabel: "video",
  });
}

export async function downloadAudioToBuffer(
  url: string,
  options: {
    maxBytes?: number;
    timeoutMs?: number;
  } = {},
) {
  return downloadMediaToBuffer(url, {
    ...options,
    acceptedContentTypes: [
      "audio/",
      "application/octet-stream",
      "application/mp3",
    ],
    mediaLabel: "audio",
  });
}

async function downloadMediaToBuffer(
  url: string,
  options: {
    acceptedContentTypes: string[];
    maxBytes?: number;
    mediaLabel: "audio" | "video";
    timeoutMs?: number;
  },
) {
  const parsedUrl = new URL(url);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(
      `Only http and https ${options.mediaLabel} URLs are supported.`,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Could not download source ${options.mediaLabel}: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType) {
      const normalizedContentType = contentType.toLowerCase();
      const accepted = options.acceptedContentTypes.some((candidate) =>
        normalizedContentType.includes(candidate),
      );
      if (!accepted) {
        throw new Error(
          `Source URL did not return ${options.mediaLabel}. Got ${contentType}.`,
        );
      }
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

    if (contentLength > maxBytes) {
      throw new Error(`Source ${options.mediaLabel} is too large to render.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length > maxBytes) {
      throw new Error(`Source ${options.mediaLabel} is too large to render.`);
    }

    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}
