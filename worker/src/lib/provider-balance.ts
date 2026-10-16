/** Known billing rejections, distinct from transient provider rate limits. */
export function isProviderBalanceFailure(code: string | null | undefined, message: string | null | undefined) {
  if (["provider_insufficient_credits", "credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached", "insufficient_credits"].includes(code?.toLowerCase() ?? "")) {
    return true;
  }
  return /credit balance is too low/i.test(message ?? "") ||
    /^(?:429\s+)?You have no credits remaining(?:[.!]|$)/i.test(message ?? "");
}
