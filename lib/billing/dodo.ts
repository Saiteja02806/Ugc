import DodoPayments from "dodopayments";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";

export type DodoBillingInterval = "monthly" | "yearly";
export type DodoPlanSlug = "starter" | "growth";

export type DodoCheckoutParams = {
  billingInterval: DodoBillingInterval;
  customerId?: string | null;
  planSlug: DodoPlanSlug;
  userEmail: string;
  userId: string;
  userName?: string | null;
};

export type DodoCheckoutResult = {
  checkoutUrl: string;
  productId: string;
  sessionId: string;
};

export type DodoProductConfig = {
  billingInterval: DodoBillingInterval;
  planSlug: DodoPlanSlug;
  productId: string;
};

let dodoClient: DodoPayments | null = null;

export function getDodoEnvironment(): "test_mode" | "live_mode" {
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
    ? "live_mode"
    : "test_mode";
}

export function getDodoApiKey(): string | null {
  return process.env.DODO_PAYMENTS_API_KEY?.trim() || null;
}

export function getDodoWebhookKey(): string | null {
  return process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() || null;
}

export function assertDodoCheckoutConfigured() {
  if (!getDodoApiKey() || !getDodoWebhookKey()) {
    throw new Error(
      "Dodo checkout requires both API and signed webhook credentials.",
    );
  }
}

export function getDodoClient() {
  const apiKey = getDodoApiKey();

  if (!apiKey) {
    throw new Error("DODO_PAYMENTS_API_KEY is not configured.");
  }

  dodoClient ??= new DodoPayments({
    bearerToken: apiKey,
    environment: getDodoEnvironment(),
    webhookKey: getDodoWebhookKey(),
  });

  return dodoClient;
}

export function resolveDodoProductId(
  planSlug: DodoPlanSlug,
  billingInterval: DodoBillingInterval,
): string {
  const variableName = getProductEnvironmentVariable(
    planSlug,
    billingInterval,
  );
  const productId = process.env[variableName]?.trim();

  if (!productId) {
    throw new Error(`${variableName} is not configured.`);
  }

  return productId;
}

export function resolveDodoProductConfig(
  productId: string,
): DodoProductConfig | null {
  for (const planSlug of ["starter", "growth"] as const) {
    for (const billingInterval of ["monthly", "yearly"] as const) {
      const configuredId = process.env[
        getProductEnvironmentVariable(planSlug, billingInterval)
      ]?.trim();

      if (configuredId && configuredId === productId) {
        return { billingInterval, planSlug, productId };
      }
    }
  }

  return null;
}

export function getBillingAppBaseUrl() {
  const rawUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://getugcpilot.com";
  const url = new URL(rawUrl);

  if (getDodoEnvironment() === "live_mode" && url.protocol !== "https:") {
    throw new Error("APP_BASE_URL must use HTTPS in Dodo live mode.");
  }

  url.pathname = "/";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

export function resolveDefaultReturnUrl(): string {
  return `${getBillingAppBaseUrl()}/dashboard/billing?checkout=returned`;
}

export function resolveCheckoutCancelUrl(params: {
  billingInterval: DodoBillingInterval;
  planSlug: DodoPlanSlug;
}) {
  const url = new URL("/pricing", `${getBillingAppBaseUrl()}/`);
  url.searchParams.set("checkout", "cancelled");
  url.searchParams.set("plan", params.planSlug);

  if (params.billingInterval === "yearly") {
    url.searchParams.set("billing", "yearly");
  }

  return url.toString();
}

export async function createDodoCheckoutSession(
  params: DodoCheckoutParams,
): Promise<DodoCheckoutResult> {
  assertDodoCheckoutConfigured();
  const productId = resolveDodoProductId(
    params.planSlug,
    params.billingInterval,
  );
  const customer = params.customerId
    ? { customer_id: params.customerId }
    : {
        email: params.userEmail,
        name:
          params.userName ||
          params.userEmail.split("@")[0] ||
          "UGC Pilot customer",
      };
  const session = await getDodoClient().checkoutSessions.create({
    cancel_url: resolveCheckoutCancelUrl(params),
    customer,
    metadata: {
      billing_interval: params.billingInterval,
      plan_slug: params.planSlug,
      user_id: params.userId,
    },
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url: resolveDefaultReturnUrl(),
    show_saved_payment_methods: Boolean(params.customerId),
  });

  if (!session.checkout_url) {
    throw new Error("Dodo checkout response did not include a checkout URL.");
  }

  return {
    checkoutUrl: session.checkout_url,
    productId,
    sessionId: session.session_id,
  };
}

export async function createDodoCustomerPortalSession(params: {
  customerId: string;
}) {
  const session = await getDodoClient().customers.customerPortal.create(
    params.customerId,
    {
      return_url: `${getBillingAppBaseUrl()}/settings#subscription-billing`,
      send_email: false,
    },
  );

  return session.link;
}

export function unwrapDodoWebhook(params: {
  headers: Record<
    "webhook-id" | "webhook-signature" | "webhook-timestamp",
    string
  >;
  rawBody: string;
}): UnwrapWebhookEvent {
  const webhookKey = getDodoWebhookKey();

  if (!webhookKey) {
    throw new Error("DODO_PAYMENTS_WEBHOOK_KEY is not configured.");
  }

  return getDodoClient().webhooks.unwrap(params.rawBody, {
    headers: params.headers,
    key: webhookKey,
  });
}

export async function ingestDodoUsageEvent(params: {
  customerId: string;
  eventId: string;
  eventName: string;
  metadata: Record<string, boolean | number | string>;
  timestamp: string;
}) {
  return getDodoClient().usageEvents.ingest({
    events: [
      {
        customer_id: params.customerId,
        event_id: params.eventId,
        event_name: params.eventName,
        metadata: params.metadata,
        timestamp: params.timestamp,
      },
    ],
  });
}

function getProductEnvironmentVariable(
  planSlug: DodoPlanSlug,
  billingInterval: DodoBillingInterval,
) {
  return `DODO_${planSlug.toUpperCase()}_${billingInterval.toUpperCase()}_PRODUCT_ID`;
}
