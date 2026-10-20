type ReferenceSourceSubscription = {
  isActive?: boolean;
  planKey?: string;
};

/** Generation credit grants are deliberately not a source-post entitlement. */
export function canOpenReferenceSource(query: {
  data?: ReferenceSourceSubscription;
  isSuccess?: boolean;
  isFetching?: boolean;
  isError?: boolean;
}) {
  return query.isSuccess === true && query.isFetching === false &&
    query.isError === false && query.data?.isActive === true &&
    (query.data.planKey === "starter" || query.data.planKey === "growth");
}
