/** Select factual context for Hook writing without rewriting or clipping owner facts. */
export function hookRemixBusinessBrief(context: unknown): unknown {
  if (!context || typeof context !== "object" || Array.isArray(context)) return context;
  const fields = [
    "businessName", "productSummary",
    "valueProps", "differentiators", "brandTone",
    "claimsToAvoid", "missingInfo",
  ];
  return Object.fromEntries(Object.entries(context).filter(([key]) => fields.includes(key)));
}
