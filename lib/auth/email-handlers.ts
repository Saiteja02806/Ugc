import { AuthEmailError, normalizeAuthEmail, PASSWORD_RESET_MESSAGE,
  type AuthEmailKind, type EmailPurchaseIntent } from "./email-policy";

type Identity = { uid: string; email: string | null; emailVerified: boolean };
export type AuthEmailDependencies = {
  authenticate: (request: Request) => Promise<Identity>;
  ensureConfigured: () => unknown;
  consumeLimit: (request: Request, kind: AuthEmailKind, subject: string) => Promise<void>;
  deliver: (kind: AuthEmailKind, email: string, intent?: EmailPurchaseIntent) => Promise<void>;
  schedule: (work: () => Promise<void>) => void;
  reportFailure: (kind: AuthEmailKind) => void;
};

function json(body: unknown, status = 200, retryAfter?: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
  });
}

async function readBody(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new AuthEmailError("This request is not allowed.", 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AuthEmailError("Send a JSON request.", 415);
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (Number(request.headers.get("content-length")) > 2048) {
    throw new AuthEmailError("This request is too large.", 413);
  }
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) {
      await reader.cancel();
      throw new AuthEmailError("This request is too large.", 413);
    }
    chunks.push(value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new AuthEmailError("This request is invalid.", 400);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AuthEmailError) return json({ error: error.message }, error.status, error.retryAfter);
  // Authentication errors have a safe status, but never return arbitrary error text.
  const status = (error as { status?: number })?.status;
  if (status === 401) return json({ error: "Sign in to request a verification email." }, 401);
  return json({ error: "Email delivery is temporarily unavailable. Please try again later." }, 503);
}

export function createAuthEmailHandlers(deps: AuthEmailDependencies) {
  return {
    async sendVerification(request: Request) {
      try {
        const body = await readBody(request);
        const identity = await deps.authenticate(request);
        if (identity.emailVerified) return json({ alreadyVerified: true });
        if (!identity.email) throw new AuthEmailError("Your account does not have an email address.", 400);
        deps.ensureConfigured();
        await deps.consumeLimit(request, "verification", identity.uid);
        await deps.deliver("verification", normalizeAuthEmail(identity.email), {
          plan: typeof body.plan === "string" ? body.plan : undefined,
          billing: typeof body.billing === "string" ? body.billing : undefined,
        });
        return json({ sent: true });
      } catch (error) {
        return errorResponse(error);
      }
    },
    async forgotPassword(request: Request) {
      try {
        const body = await readBody(request);
        const email = normalizeAuthEmail(body.email);
        deps.ensureConfigured();
        await deps.consumeLimit(request, "password-reset", email);
        // Respond before looking up the account or contacting providers, so account
        // existence and provider failures cannot be inferred from status or timing.
        deps.schedule(async () => {
          try { await deps.deliver("password-reset", email); }
          catch { deps.reportFailure("password-reset"); }
        });
        return json({ message: PASSWORD_RESET_MESSAGE });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
