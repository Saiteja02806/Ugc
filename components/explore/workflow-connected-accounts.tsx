"use client";

import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import creation from "@/components/explore/workflow-creation.module.css";
import { loadWorkflowConnectedAccounts, workflowAccountBlock, workflowAccountLabel } from "@/lib/explore/workflow-connected-accounts";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

/** Preview and inactive tabs never mount the authenticated lookup. No account is auto-selected. */
export function WorkflowConnectedAccounts({ enabled, active, ownerId, platforms, selectedIds, onSelect }: {
  enabled: boolean;
  active: boolean;
  ownerId: string | null;
  platforms: string[];
  selectedIds: Record<string, string>;
  onSelect: (platform: string, id: string) => void;
}) {
  if (!enabled || !active) return null;
  if (!ownerId) return <p className="text-xs leading-5 text-muted">Sign in to view your connected accounts.</p>;
  if (!platforms.length) return <p className="text-xs leading-5 text-muted">Choose a platform to see your connected accounts.</p>;
  return <ConnectedAccounts key={ownerId} ownerId={ownerId} platforms={platforms} selectedIds={selectedIds} onSelect={onSelect} />;
}

function ConnectedAccounts({ ownerId, platforms, selectedIds, onSelect }: {
  ownerId: string;
  platforms: string[];
  selectedIds: Record<string, string>;
  onSelect: (platform: string, id: string) => void;
}) {
  const accounts = useQuery({
    queryKey: ["explore-connected-accounts", ownerId],
    queryFn: ({ signal }) => loadWorkflowConnectedAccounts({
      getOwnerToken: () => getCurrentUserIdToken(ownerId), fetch: (...args) => fetch(...args),
      assertActive() { if (signal.aborted) throw new Error("This account lookup is no longer active."); },
    }, signal),
    retry: false, staleTime: 0,
  });
  const visible = (accounts.data ?? []).filter((account) => platforms.includes(account.platform));
  return <div className={creation.scheduleField}>
    <span className="text-sm font-medium">Connected accounts</span>
    {accounts.isPending ? <p role="status" className="text-xs leading-5 text-muted">Loading connected accounts…</p>
      : accounts.isError ? <div role="alert" className="text-xs leading-5 text-muted">
        <p>Could not load your connected accounts.</p>
        <Button type="button" variant="ghost" disabled={accounts.isFetching} onClick={() => { void accounts.refetch(); }}>Refresh accounts</Button>
      </div>
      : visible.length === 0 ? <p className="text-xs leading-5 text-muted">No accounts connected for this platform.</p>
      : <div role="group" aria-label="Connected posting accounts" className={creation.connectedAccounts}>
        {visible.map((account) => {
          const blocked = workflowAccountBlock(account);
          const platformLabel = account.platform === "youtube" ? "YouTube" : account.platform === "instagram" ? "Instagram" : "TikTok";
          return <Button key={account.id} type="button" variant="ghost" disabled={Boolean(blocked) || accounts.isFetching}
            aria-pressed={!blocked && selectedIds[account.platform] === account.id} aria-label={`Post to ${workflowAccountLabel(account)} on ${platformLabel}`}
            title={blocked ?? workflowAccountLabel(account)} className={creation.connectedAccount}
            onClick={() => onSelect(account.platform, account.id)}>
            <span className={creation.connectedAccountLabel}>{workflowAccountLabel(account)}
              <span className="block text-xs font-normal text-muted">{platformLabel}</span>
              {blocked && <span className="block text-xs font-normal text-muted">Reconnect to schedule</span>}
            </span>
            {!blocked && selectedIds[account.platform] === account.id && <Check className="size-4 shrink-0" aria-hidden="true" />}
          </Button>;
        })}
      </div>}
    {!accounts.isPending && !accounts.isError ? platforms.filter(platform => !visible.some(account => account.platform === platform)).map(platform => <p key={platform} className="text-xs text-muted">Connect an account for {platform === "youtube" ? "YouTube" : platform === "instagram" ? "Instagram" : "TikTok"} before scheduling there.</p>) : null}
    <Link href="/settings#instagram-publishing" className="w-fit rounded text-xs text-muted underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus">Manage connected accounts</Link>
  </div>;
}
