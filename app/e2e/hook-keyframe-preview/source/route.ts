import { getHookSourceFrame, HookSourceFrameError } from "@/lib/explore/hook-source-frame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public catalogue pixels only. Never enabled on a production deployment. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (process.env.NODE_ENV !== "development" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    return new Response(null, { status: 404 });
  }
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  const referenceId = url.searchParams.get("referenceId");
  if (url.searchParams.size !== 1 || !referenceId) {
    return Response.json({ message: "Choose a Hook from the reference library." }, { status: 400, headers });
  }
  try {
    // Same immutable-source download, hash validation and frame-zero decoder
    // used by authenticated preparation. No poster, uploads, DB or inference.
    const frame = await getHookSourceFrame(referenceId);
    return new Response(new Uint8Array(frame.png), { headers: {
      ...headers, "Content-Type": "image/png",
      "X-Hook-Reference-Id": frame.referenceId, "X-Hook-Source-Sha256": frame.sourceSha256,
      "X-Hook-Frame-Sha256": frame.frameSha256, "X-Hook-Frame-Index": "0", "X-Hook-Frame-Time": "0",
      "X-Hook-Frame-Width": String(frame.width), "X-Hook-Frame-Height": String(frame.height),
    } });
  } catch (error) {
    return Response.json({ message: error instanceof HookSourceFrameError ? error.message : "The opening frame could not be prepared. Try again." },
      { status: error instanceof HookSourceFrameError ? error.status : 503, headers });
  }
}
