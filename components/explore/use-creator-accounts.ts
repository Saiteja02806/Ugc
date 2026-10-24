"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { canAccessCreatorAccounts, isCreatorAccountReference } from "@/lib/explore/creator-account-access";
import type { CreatorAccount } from "@/lib/explore/creator-accounts";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import { withReadDeadline } from "@/lib/http/read-deadline";

const EMPTY: CreatorAccount[] = [];
const EMPTY_REFERENCES: RecreateReference[] = [];

/** Every private byte is fetched with the current user's bearer token. Blob
 * URLs are browser-local and revoked on logout, owner change and unmount. */
export function useCreatorAccounts(user: { uid: string; email: string | null; emailVerified: boolean } | null, enabled: boolean, restoredReferenceId?: string | null, format: "hook" | "wall_text" | "slideshow" = "hook") {
  const allowed = enabled && canAccessCreatorAccounts(user);
  const ownerId = user?.uid;
  const [selection, setSelection] = useState<{ owner: string; id: string | null } | null>(null);
  const selectedId = allowed && selection && selection.owner === user?.uid ? selection.id : null;
  const query = useQuery({
    queryKey: ["explore-creator-accounts", user?.uid ?? "signed-out", format], enabled: allowed,
    queryFn: async ({ signal }): Promise<CreatorAccount[]> => {
      return withReadDeadline(async bounded => {
      const token = await getCurrentUserIdToken(ownerId);
      if (!token) throw new Error("Sign in to load creator accounts.");
      const response = await fetch(`/api/explore/creator-accounts${format === "slideshow" ? "?format=slideshow" : ""}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: bounded });
      const body = await response.json();
      if (!response.ok || body.ok !== true || !Array.isArray(body.accounts)) throw new Error("Creator accounts could not be loaded.");
      return body.accounts;
      }, signal);
    }, staleTime: 5 * 60_000, retry: 1,
  });
  const accounts = allowed ? query.data ?? EMPTY : EMPTY;
  const wanted = Boolean(selectedId || restoredReferenceId?.startsWith("creator-slideshow-") || isCreatorAccountReference(restoredReferenceId));
  const [loaded, setLoaded] = useState<{ owner: string; catalog: CreatorAccount[]; accounts: CreatorAccount[]; attempt: number; lifetime: { active: boolean } } | null>(null);
  const [failure, setFailure] = useState<{ owner: string; messages: Record<string, string> } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!allowed || !ownerId || !wanted || !accounts.length) return;
    const owner = ownerId, controller = new AbortController(), urls: string[] = [];
    const lifetime = { active: true };
    // Keep pilot accounts available so changing the gallery does not
    // revoke the reference currently used by an open preparation or draft.
    async function load() {
      const token = await withReadDeadline(() => getCurrentUserIdToken(owner), controller.signal);
      if (!token) throw new Error("Sign in to preview these videos.");
      async function media(url: string, contentType: string) {
        return withReadDeadline(async signal => {
        const response = await fetch(url, { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal });
        const actualType = response.headers.get("content-type")?.split(";", 1)[0];
        if (!response.ok || (contentType === "image" ? !["image/png","image/jpeg","image/webp"].includes(actualType ?? "") : actualType !== contentType)) throw new Error("Creator references could not be loaded. Try again.");
        const blob = await response.blob();
        if (!lifetime.active) throw new Error("Cancelled");
        const local = URL.createObjectURL(blob); urls.push(local); return local;
        }, controller.signal);
      }
      // A gallery needs stills, not every MP4 in both accounts. Publish each
      // account as soon as its stills are ready; videos resolve on interest.
      await Promise.all(accounts.map(async account => {
        try {
          const items: RecreateReference[] = [];
          for (let offset = 0; offset < account.items.length; offset += 3) {
            items.push(...await Promise.all(account.items.slice(offset, offset + 3).map(async item => {
              if (item.format === "slideshow") {
                const slides = [];
                for (let offset=0;offset<item.slides.length;offset+=3) slides.push(...await Promise.all(item.slides.slice(offset,offset+3).map(async slide=>({ ...slide, url:await media(slide.url,"image") }))));
                return { ...item, slides, posterUrl: slides[0].url };
              }
              return { ...item, posterUrl: await media(item.posterUrl, "image/png") };
            })));
          }
          if (lifetime.active) {
            setLoaded(current => ({ owner, catalog: accounts,
              accounts: [...(current?.lifetime === lifetime ? current.accounts : []), { ...account, items }], attempt, lifetime }));
          }
        } catch (error) {
          if (lifetime.active) setFailure(current => ({ owner,
            messages: { ...(current?.owner === owner ? current.messages : {}),
              [account.id]: error instanceof Error ? error.message : "Creator references could not be loaded." } }));
        }
      }));
    }
    void load().catch(error => {
      if (lifetime.active) { controller.abort(); urls.forEach(URL.revokeObjectURL); setFailure({ owner, messages: Object.fromEntries(accounts.map(account => [account.id, error instanceof Error ? error.message : "Creator videos could not be loaded."])) }); }
    });
    return () => { lifetime.active = false; controller.abort(); urls.forEach(URL.revokeObjectURL); };
  }, [allowed, ownerId, accounts, wanted, attempt]);
  const hydrated = allowed && loaded && loaded.lifetime.active && loaded.owner === ownerId && loaded.catalog === accounts && loaded.attempt === attempt && wanted ? loaded.accounts : EMPTY;
  const account = hydrated.find(item => item.id === selectedId);
  const error = failure && failure.owner === ownerId && selectedId ? failure.messages[selectedId] ?? null : null;
  return { accounts, selectedId, account, catalogueError: allowed && query.isError ? "Creator accounts could not be loaded." : null,
    // Recreate/restore only needs canonical identity and directions. Never make
    // opening its dialog wait for unrelated gallery stills or video transfers.
    retryCatalogue: () => void query.refetch(), references: accounts.length ? accounts.flatMap(account => hydrated.find(item => item.id === account.id)?.items ?? account.items) : EMPTY_REFERENCES,
    loading: Boolean(selectedId && !account && !error), error: selectedId ? error : null,
    select: (id: string | null) => { if (user) setSelection({ owner: user.uid, id }); },
    retry: () => { setFailure(null); setAttempt(current => current + 1); },
  };
}
