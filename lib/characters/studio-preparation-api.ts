import "server-only";
import { requireFirebaseUser, FirebaseAuthRequestError } from "../firebase/server-auth.ts";
import { prepareStudioReferences, studioDeadline, studioReferenceIdentity, StudioPreparationError } from "./studio-preparation.ts";
import { findTraitById } from "./influencer-registry.ts";
import { getCharacterGenerationAccess } from "./generation-api.ts";

export function createStudioPreparationHandler(dependencies = {
  authenticate: requireFirebaseUser,
  access: getCharacterGenerationAccess,
  prepare: prepareStudioReferences,
}) {
  return async (request: Request) => {
    const attemptId = crypto.randomUUID();
    const started = Date.now();
    const headers = { "Cache-Control": "no-store" };
    try {
      const user = await studioDeadline(() => dependencies.authenticate(request), 10_000);
      const text = await studioDeadline(() => request.text(), 5_000);
      if (text.length > 4096) return Response.json({ ok: false, error: "Too many selected references." }, { status: 413, headers });
      const body = JSON.parse(text);
      if (!body || Object.keys(body).some(key => key !== "traitIds") || !Array.isArray(body.traitIds)
        || body.traitIds.length < 1 || body.traitIds.length > 10 || body.traitIds.some((id: unknown) => typeof id !== "string" || id.length > 96)
        || new Set(body.traitIds).size !== body.traitIds.length) {
        return Response.json({ ok: false, error: "Choose up to ten different character references." }, { status: 400, headers });
      }
      body.traitIds.forEach((id: string) => studioReferenceIdentity(user.uid, id));
      const access = await studioDeadline(() => dependencies.access(user.uid), 10_000);
      if (!access.affordableImageCount) return Response.json({ ok: false, error: access.message || "You do not have enough credits to generate." }, { status: 403, headers });
      const references = await studioDeadline(() => dependencies.prepare(user.uid, body.traitIds), 80_000);
      console.info("Character references prepared", { attemptId, count: references.length, elapsedMs: Date.now() - started });
      return Response.json({ ok: true, references, attemptId }, { headers });
    } catch (error) {
      const status = error instanceof FirebaseAuthRequestError ? error.status
        : error instanceof SyntaxError || error instanceof StudioPreparationError && !error.retryable ? 400 : 503;
      // Do not log prompts, owners, tokens, URLs, provider responses or arbitrary exception messages.
      console.error("Character reference preparation failed", { attemptId, elapsedMs: Date.now() - started,
        stage: error instanceof StudioPreparationError ? error.stage : "request",
        traitId: error instanceof StudioPreparationError ? findTraitById(error.traitId)?.id : undefined, status });
      const message = error instanceof FirebaseAuthRequestError ? error.message : error instanceof StudioPreparationError ? error.message
        : status === 400 ? "Invalid character reference selection." : "Character references could not be prepared. Try Generate again; completed references are kept.";
      return Response.json({ ok: false, error: message, attemptId, retryable: status === 503 }, { status, headers });
    }
  };
}
