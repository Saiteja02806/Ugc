"use client";

import Link from "next/link";
import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import { isPaidBillingPlan } from "@/lib/billing/policy";
import styles from "./reference-feed-upgrade.module.css";

/** Browsing uses the authoritative billing query, never generation grants or cached pricing hints. */
export function useFullVideoReferenceFeed() {
  const subscription = useBillingSubscription({ refreshOnFocus: true, freshOnMount: true });
  // Revalidate cached access on entry. Once verified here, child source-button
  // refetches must not collapse/remount the paid feed and trigger another fetch.
  const checking = subscription.isPending || (subscription.isFetching && subscription.isFetchedAfterMount !== true);
  return {
    unlimited: subscription.isSuccess && !checking && !subscription.isError && subscription.data.isActive && isPaidBillingPlan(subscription.data.planKey),
    loading: checking,
    failed: subscription.isError,
    retry: () => { void subscription.refetch(); },
  };
}

export function ReferenceFeedUpgrade({ loading, failed, retry }: { loading?: boolean; failed?: boolean; retry?: () => void }) {
  return <section className={styles.gate} data-reference-feed-upgrade aria-label="More references">
    <div className={styles.fade} aria-hidden="true"><span /><span /><span /></div>
    {loading ? <p role="status">Checking your reference access…</p> : failed ? <><p role="alert">Could not check your reference access.</p><button type="button" className={styles.action} onClick={retry}>Retry access</button></> : <>
      <p>Explore the full reference collection</p>
      <Link href="/pricing" className={styles.action}>Upgrade</Link>
    </>}
  </section>;
}
