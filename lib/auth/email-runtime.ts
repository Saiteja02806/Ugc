import "server-only";

import { createAuthEmailHandlers } from "./email-handlers";
import { consumeAuthEmailLimit } from "./email-rate-limit";
import { deliverAuthEmail, getAuthEmailConfiguration } from "./email-service";
import { requireFirebaseIdentity } from "../firebase/server-auth";

export function getAuthEmailHandlers(schedule: (work: () => Promise<void>) => void) {
  return createAuthEmailHandlers({
    authenticate: requireFirebaseIdentity,
    ensureConfigured: getAuthEmailConfiguration,
    consumeLimit: consumeAuthEmailLimit,
    deliver: deliverAuthEmail,
    schedule,
    reportFailure: (kind) => console.error("Auth email delivery failed", { kind }),
  });
}
