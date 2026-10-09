export async function requestVideoDownload(assetId: string, token: string, signal: AbortSignal) {
  const response = await fetch(`/api/media/${encodeURIComponent(assetId)}/download`, {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object" || !("ok" in data) || data.ok !== true) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error : "Could not prepare your download. Please try again.";
    throw new Error(message);
  }
  if (!("url" in data) || typeof data.url !== "string" ||
    !("fileName" in data) || typeof data.fileName !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(data.fileName)) {
    throw new Error("Could not prepare your download. Please try again.");
  }
  let url: URL;
  try { url = new URL(data.url); }
  catch { throw new Error("Could not prepare your download. Please try again."); }
  if (url.protocol !== "https:" || url.hostname !== "storage.googleapis.com" || url.username || url.password ||
    url.searchParams.get("response-content-disposition") !== `attachment; filename="${data.fileName}"`) {
    throw new Error("Could not prepare your download. Please try again.");
  }
  return { url: url.href, fileName: data.fileName };
}

export function startVideoDownload(download: { url: string; fileName: string }) {
  const link = document.createElement("a");
  link.href = download.url;
  // The signed response supplies the filename and attachment disposition.
  link.target = "_self";
  link.referrerPolicy = "no-referrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
