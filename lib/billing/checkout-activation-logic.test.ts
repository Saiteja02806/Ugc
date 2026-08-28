import assert from "node:assert/strict";
import test from "node:test";

import { isVerifiedCheckoutActivation } from "./checkout-activation-logic.ts";

const verifiedCheckout = {
  checkout: {
    id: "cks_checkout",
    paymentId: "pay_payment",
    paymentStatus: "succeeded",
  },
  currentUser: {
    email: "customer@example.com",
    uid: "firebase-user",
  },
  hasRecognizedProduct: true,
  payment: {
    checkoutSessionId: "cks_checkout",
    customerEmail: "Customer@Example.com",
    customerId: "cus_customer",
    id: "pay_payment",
    status: "succeeded",
    subscriptionId: "sub_subscription",
  },
  requestedCheckoutSessionId: "cks_checkout",
  subscription: {
    customerEmail: "customer@example.com",
    customerId: "cus_customer",
    id: "sub_subscription",
    metadataUserId: "firebase-user",
    status: "active",
  },
} as const;

test("activates only a completed checkout owned by the signed-in user", () => {
  assert.equal(isVerifiedCheckoutActivation(verifiedCheckout), true);
});

test("does not trust a checkout id from a different Firebase user", () => {
  assert.equal(
    isVerifiedCheckoutActivation({
      ...verifiedCheckout,
      subscription: {
        ...verifiedCheckout.subscription,
        metadataUserId: "another-user",
      },
    }),
    false,
  );
});

test("requires the Dodo payment and subscription to belong to the same account", () => {
  assert.equal(
    isVerifiedCheckoutActivation({
      ...verifiedCheckout,
      payment: {
        ...verifiedCheckout.payment,
        customerEmail: "other@example.com",
      },
    }),
    false,
  );
  assert.equal(
    isVerifiedCheckoutActivation({
      ...verifiedCheckout,
      payment: {
        ...verifiedCheckout.payment,
        subscriptionId: "sub_another_subscription",
      },
    }),
    false,
  );
});

test("does not activate an incomplete payment or an unknown product", () => {
  assert.equal(
    isVerifiedCheckoutActivation({
      ...verifiedCheckout,
      checkout: {
        ...verifiedCheckout.checkout,
        paymentStatus: "processing",
      },
    }),
    false,
  );
  assert.equal(
    isVerifiedCheckoutActivation({
      ...verifiedCheckout,
      hasRecognizedProduct: false,
    }),
    false,
  );
});
