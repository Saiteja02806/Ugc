import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export function encryptSocialToken(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSocialToken(encryptedSecret: string) {
  const [version, iv, tag, ciphertext] = encryptedSecret.split(".");

  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted social token format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getEncryptionKey() {
  const raw =
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim() ||
    "";

  if (!raw) {
    throw new Error(
      "Missing SOCIAL_TOKEN_ENCRYPTION_KEY or OAUTH_TOKEN_ENCRYPTION_KEY.",
    );
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64Key = Buffer.from(raw, "base64");

  if (base64Key.length === 32) {
    return base64Key;
  }

  return createHash("sha256").update(raw).digest();
}
