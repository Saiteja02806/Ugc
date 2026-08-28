export type CheckoutActivationVerificationInput = {
  checkout: {
    id: string;
    paymentId: string | null | undefined;
    paymentStatus: string | null | undefined;
  };
  currentUser: {
    email: string | null;
    uid: string;
  };
  hasRecognizedProduct: boolean;
  payment: {
    checkoutSessionId: string | null | undefined;
    customerEmail: string | null | undefined;
    customerId: string | null | undefined;
    id: string;
    status: string | null | undefined;
    subscriptionId: string | null | undefined;
  };
  requestedCheckoutSessionId: string;
  subscription: {
    customerEmail: string | null | undefined;
    customerId: string | null | undefined;
    id: string;
    metadataUserId: string | null | undefined;
    status: string | null | undefined;
  };
};

/**
 * A checkout-return cookie is only a hint. This predicate is the boundary that
 * prevents a browser-provided session id from granting paid access by itself.
 */
export function isVerifiedCheckoutActivation(
  input: CheckoutActivationVerificationInput,
) {
  const email = normalizeEmail(input.currentUser.email);

  return Boolean(
    input.hasRecognizedProduct &&
      input.requestedCheckoutSessionId === input.checkout.id &&
      input.checkout.paymentStatus === "succeeded" &&
      input.checkout.paymentId === input.payment.id &&
      input.payment.status === "succeeded" &&
      input.payment.checkoutSessionId === input.checkout.id &&
      input.payment.subscriptionId === input.subscription.id &&
      input.subscription.status === "active" &&
      input.payment.customerId &&
      input.payment.customerId === input.subscription.customerId &&
      email &&
      email === normalizeEmail(input.payment.customerEmail) &&
      email === normalizeEmail(input.subscription.customerEmail) &&
      input.subscription.metadataUserId === input.currentUser.uid,
  );
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}
