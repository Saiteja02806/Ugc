import { Readable } from "node:stream";
import { bundleStatus, claimBundleDownload, validBundleRequestId, type BundleStateStore } from "./hook-video-bundle.ts";
import { bundleZipSize, streamBundleZip, type BundleZipEntry } from "./hook-video-bundle-zip.ts";
import { BATCH_ONE_COMPLETE } from "./hook-bundle-copy.ts";

type Dependencies = { store: BundleStateStore; bundleHash: string; videoCount: number; prepare(signal: AbortSignal): Promise<BundleZipEntry[]> };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (value: object, status = 200) => Response.json(value, { status, headers });

export function createHookBundleHandlers(deps: Dependencies) {
  async function GET(request: Request) {
    try {
      const requestId = new URL(request.url).searchParams.get("requestId");
      if (requestId && !validBundleRequestId(requestId)) return reply({ error: "Invalid download request." }, 400);
      return reply({ ...await bundleStatus(deps.store, deps.bundleHash, requestId), videoCount: deps.videoCount });
    } catch { return reply({ error: "Downloads are temporarily unavailable. Please try again." }, 503); }
  }

  async function POST(request: Request) {
    let iterator: AsyncGenerator<Buffer> | undefined;
    let handedOff = false;
    try {
      // Public does not mean third-party pages may silently consume the offer.
      if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Open the bundle page to download." }, 403);
      if (Number(request.headers.get("content-length") ?? 0) > 256 ||
        request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") return reply({ error: "Invalid download request." }, 400);
      const body = await request.text();
      if (Buffer.byteLength(body) > 256) return reply({ error: "Invalid download request." }, 400);
      const params = new URLSearchParams(body);
      const requestId = params.get("requestId");
      if (params.size !== 1 || !validBundleRequestId(requestId)) return reply({ error: "Invalid download request." }, 400);
      const current = await bundleStatus(deps.store, deps.bundleHash, requestId);
      if (current.started) return reply({ error: "This download request has already started.", ...current }, 409);
      if (current.exhausted) return reply({ error: BATCH_ONE_COMPLETE, ...current }, 410);
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(290_000)]);
      const entries = await deps.prepare(signal);
      const size = bundleZipSize(entries);
      iterator = streamBundleZip(entries);
      const first = await iterator.next(); // verifies first source read before consuming a slot
      signal.throwIfAborted();
      const admitted = await claimBundleDownload(deps.store, deps.bundleHash, requestId, { signal });
      if (admitted !== "accepted") return reply({ error: admitted === "exhausted" ? BATCH_ONE_COMPLETE : "This download request has already started.",
        ...await bundleStatus(deps.store, deps.bundleHash, requestId) }, admitted === "exhausted" ? 410 : 409);
      const source = iterator;
      const stream = Readable.from((async function* () { try { yield first.value!; yield* source; } finally { await source.return(undefined); } })());
      const abort = () => stream.destroy(new Error("Bundle download canceled or timed out."));
      signal.addEventListener("abort", abort, { once: true });
      stream.once("close", () => signal.removeEventListener("abort", abort));
      if (signal.aborted) abort();
      handedOff = true;
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { headers: { ...headers,
        "Content-Type": "application/zip", "Content-Length": String(size),
        "Content-Disposition": 'attachment; filename="UGCPilot-Hook-Video-Bundle.zip"' } });
    } catch { return reply({ error: "Could not start the download. Please try again." }, 503); }
    finally { if (!handedOff && iterator) await iterator.return(undefined).catch(() => undefined); }
  }
  return { GET, POST };
}
