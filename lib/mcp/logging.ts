import { createHash } from "node:crypto";

export function clientLogRef(clientId: string) {
  return createHash("sha256").update(clientId).digest("hex").slice(0, 16);
}
