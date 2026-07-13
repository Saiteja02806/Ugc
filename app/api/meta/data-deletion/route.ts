import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

type MetaSignedRequestPayload = {
  algorithm?: string;
  issued_at?: number;
  user_id?: string;
  [key: string]: unknown;
};

export async function GET() {
  return Response.json({
    status: "ready",
    message: "UGC Pilot Meta data deletion callback endpoint is available.",
  });
}

export async function POST(request: Request) {
  const signedRequest = await readSignedRequest(request);

  if (!signedRequest) {
    return Response.json(
      { error: "signed_request is required" },
      { status: 400 },
    );
  }

  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret && process.env.NODE_ENV === "production") {
    return Response.json(
      { error: "META_APP_SECRET is not configured" },
      { status: 500 },
    );
  }

  let payload: MetaSignedRequestPayload;

  try {
    payload = parseSignedRequest(signedRequest, appSecret);
  } catch {
    return Response.json(
      { error: "Invalid signed_request" },
      { status: 401 },
    );
  }

  const confirmationCode = createConfirmationCode(payload.user_id);
  const baseUrl = process.env.APP_BASE_URL ?? "https://getugcpilot.com";

  return Response.json({
    url: `${baseUrl}/data-deletion?confirmation=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

async function readSignedRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { signed_request?: unknown };
      return typeof body.signed_request === "string"
        ? body.signed_request
        : null;
    } catch {
      return null;
    }
  }

  try {
    const formData = await request.formData();
    const signedRequest = formData.get("signed_request");
    return typeof signedRequest === "string" ? signedRequest : null;
  } catch {
    return null;
  }
}

function parseSignedRequest(signedRequest: string, appSecret?: string) {
  const [encodedSignature, encodedPayload] = signedRequest.split(".");

  if (!encodedSignature || !encodedPayload) {
    throw new Error("Malformed signed request");
  }

  if (appSecret) {
    const signature = decodeBase64Url(encodedSignature);
    const expectedSignature = createHmac("sha256", appSecret)
      .update(encodedPayload)
      .digest();

    if (
      signature.length !== expectedSignature.length ||
      !timingSafeEqual(signature, expectedSignature)
    ) {
      throw new Error("Invalid signature");
    }
  }

  const payload = JSON.parse(
    decodeBase64Url(encodedPayload).toString("utf8"),
  ) as MetaSignedRequestPayload;

  if (
    payload.algorithm &&
    payload.algorithm.toUpperCase() !== "HMAC-SHA256"
  ) {
    throw new Error("Unsupported algorithm");
  }

  return payload;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  return Buffer.from(padded, "base64");
}

function createConfirmationCode(userId?: string) {
  return createHash("sha256")
    .update(`${userId ?? "meta"}:${Date.now()}:${randomBytes(8).toString("hex")}`)
    .digest("hex")
    .slice(0, 20);
}
