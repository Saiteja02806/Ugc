import "server-only";

import { requireAIStudioProUser } from "../ai-studio/server-access.ts";
import { FirebaseAuthRequestError } from "../firebase/server-auth.ts";
import { getHookSourceFrame, HookSourceFrameError } from "./hook-source-frame.ts";
import { canAccessCreatorAccounts, isCreatorAccountReference } from "./creator-account-access.ts";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization", "X-Content-Type-Options": "nosniff" };
const json = (message: string, status: number) => Response.json({ ok: false, message }, { status, headers });
const MAX_BODY_BYTES = 1024;

export async function handleHookStartingFrame(request: Request) {
  if (process.env.ENABLE_HOOK_STARTING_FRAME_PREPARATION !== "true") {
    return json("Starting-frame preparation is not enabled.", 404);
  }
  try {
    // Match existing generation access, including accounts with a free grant.
    const user = await requireAIStudioProUser(request);
    if (new URL(request.url).search || request.headers.get("content-type")?.split(";", 1)[0].trim() !== "application/json") {
      return json("Choose a Hook from the reference library.", 400);
    }
    const declared = request.headers.get("content-length");
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
      return json("The starting-frame request is too large.", 413);
    }
    if (!request.body) return json("Choose a Hook from the reference library.", 400);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > MAX_BODY_BYTES) return json("The starting-frame request is too large.", 413);
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    let input: unknown;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return json("Choose a Hook from the reference library.", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input)
      || Object.keys(input).some(key => !["referenceId","sourceFrameSha256"].includes(key)) || !("referenceId" in input) || typeof input.referenceId !== "string"
      || "sourceFrameSha256" in input && (!isCreatorAccountReference(input.referenceId) || typeof input.sourceFrameSha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.sourceFrameSha256))) {
      return json("Choose a Hook from the reference library.", 400);
    }
    if (isCreatorAccountReference(input.referenceId) && !canAccessCreatorAccounts(user)) return json("This reference is unavailable.", 404);
    const frame = await getHookSourceFrame(input.referenceId, "sourceFrameSha256" in input ? input.sourceFrameSha256 as string : undefined);
    return new Response(new Uint8Array(frame.png), { headers: {
      ...headers, "Content-Type": "image/png", "Content-Length": String(frame.png.length),
      "Content-Disposition": `inline; filename="hook-starting-frame.png"`,
      "X-Hook-Reference-Id": frame.referenceId,
      "X-Hook-Source-Sha256": frame.sourceSha256,
      "X-Hook-Frame-Sha256": frame.frameSha256,
      "X-Hook-Frame-Index": String(frame.frameIndex), "X-Hook-Frame-Time": String(frame.frameTimeSeconds),
      "X-Hook-Frame-Width": String(frame.width), "X-Hook-Frame-Height": String(frame.height),
    } });
  } catch (error) {
    if (error instanceof FirebaseAuthRequestError || error instanceof HookSourceFrameError) return json(error.message, error.status);
    return json("The starting frame could not be prepared. Try again.", 503);
  }
}
