type DownloadVideoOptions = {
  headers?: HeadersInit;
  timeoutMs?: number;
};

const DEFAULT_DOWNLOAD_TIMEOUT_MS = 180_000;

function isAcceptableVideoContentType(contentType: string | null) {
  return (
    contentType?.toLowerCase().includes("video") ||
    contentType?.toLowerCase().includes("application/octet-stream")
  );
}

export async function downloadVideoToBuffer(
  url: string,
  options: DownloadVideoOptions = {},
) {
  const parsedUrl = new URL(url);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Video download URL must be HTTP or HTTPS.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      headers: options.headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");

    if (!isAcceptableVideoContentType(contentType)) {
      throw new Error(`Expected video response, got ${contentType ?? "none"}.`);
    }

    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}
