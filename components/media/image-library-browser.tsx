"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Check, FolderPlus, Images, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { imageLibraryRequest } from "@/lib/media/image-library-client";
import { IMAGE_LIBRARY_MAX_BYTES, IMAGE_LIBRARY_TYPES, isLibraryImage } from "@/lib/media/image-library";
import type { MediaAsset } from "@/lib/media/types";
import styles from "./image-library.module.css";

type Collection = { id: string; name: string; mediaType: string };
type CollectionResult = { group: Collection; assets: { addedAt: string; asset: MediaAsset }[] };
type Page = { assets: MediaAsset[]; nextOffset: number | null };
type Props = { owner: string; mode?: "manage" | "pick"; multiple?: boolean; limit?: number; disabled?: boolean;
  onChoose?: (assets: MediaAsset[]) => void; onCollection?: (assets: MediaAsset[], name: string) => void };

export function ImageLibraryManager() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Loading your image library…</p>;
  if (!user) return <p>Sign in to manage your image library.</p>;
  return <ImageLibraryBrowser key={user.uid} owner={user.uid} />;
}

export function ImageLibraryBrowser({ owner, mode = "manage", multiple = true, limit = 100, disabled = false, onChoose, onCollection }: Props) {
  const [collectionId, setCollectionId] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [destination, setDestination] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<"create" | "rename" | "delete" | "image" | null>(null);
  const [name, setName] = useState("");
  const [progress, setProgress] = useState<string[]>([]);
  const [source, setSource] = useState("all");
  const input = useRef<HTMLInputElement>(null), working = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const cache = useQueryClient();
  const groups = useQuery({ queryKey: ["image-library-groups", owner], queryFn: ({ signal }) => imageLibraryRequest<{ groups: Collection[] }>(owner, "/api/media/groups?mediaType=image", { signal }), staleTime: 0 });
  const pages = useInfiniteQuery({ queryKey: ["image-library-images", owner, search, archived], initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => imageLibraryRequest<Page>(owner, `/api/media/image-library?offset=${pageParam}&q=${encodeURIComponent(search)}&archived=${archived ? 1 : 0}`, { signal }),
    getNextPageParam: page => page.nextOffset ?? undefined, enabled: !collectionId, staleTime: 0 });
  const collection = useQuery({ queryKey: ["image-library-collection", owner, collectionId],
    queryFn: ({ signal }) => imageLibraryRequest<CollectionResult>(owner, `/api/media/groups/${collectionId}/items`, { signal }), enabled: Boolean(collectionId), staleTime: 0 });
  const active = collectionId ? collection : pages;
  const group = groups.data?.groups.find(item => item.id === collectionId);
  const assets = collectionId ? (collection.data?.assets.map(item => item.asset).filter(asset => isLibraryImage(asset) && asset.metadata.imageLibraryArchived !== true) ?? []) : (pages.data?.pages.flatMap(page => page.assets) ?? []);
  const byId = new Map(assets.map(asset => [asset.id, asset]));
  const chosen = selected.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const visible = assets.filter(asset => (source === "all" || asset.sourceType === source) && (!collectionId || `${asset.title} ${asset.fileName ?? ""}`.toLowerCase().includes(search.toLowerCase())));
  const locked = disabled || busy;

  async function refresh() {
    await Promise.all([cache.invalidateQueries({ queryKey: ["image-library-images", owner] }), cache.invalidateQueries({ queryKey: ["image-library-groups", owner] }),
      cache.invalidateQueries({ queryKey: ["image-library-collection", owner] }), cache.invalidateQueries({ queryKey: ["explore-reference-images", owner] })]);
  }
  async function run(action: () => Promise<void>) {
    if (working.current || disabled) return;
    working.current = true; setBusy(true); setError(null); setMessage(null);
    try { await action(); await refresh(); }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Could not update the library. Try again."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  function switchCollection(id: string) { setCollectionId(id); setSelected([]); setQuery(""); setSearch(""); setError(null); setMessage(null); if (id) setArchived(false); }
  function toggle(id: string) {
    setError(null);
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : multiple ? current.length < limit ? [...current, id] : current : [id]);
  }
  async function upload(files: File[]) {
    const targetCollection = collectionId;
    if (!files.length) return;
    if (files.length > 100) { setError("Upload up to 100 images at a time."); return; }
    await run(async () => {
      const notices: string[] = [];
      for (let index = 0; index < files.length; index++) {
        if (!alive.current) return;
        const file = files[index]; setMessage(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
        try {
          if (!IMAGE_LIBRARY_TYPES.includes(file.type) || !file.size || file.size > IMAGE_LIBRARY_MAX_BYTES) throw new Error("Choose JPG, PNG or WebP up to 25 MB.");
          const { asset } = await uploadAIStudioReferenceMedia(file, "image", 3, owner, { purpose: "image-library" });
          if (!alive.current) return;
          if (targetCollection) {
            try { await imageLibraryRequest(owner, `/api/media/groups/${targetCollection}/items`, { method: "POST", body: JSON.stringify({ mediaAssetIds: [asset.id] }) }); }
            catch { notices.push(`${file.name}: uploaded to All images; could not add to the collection. Select it there and add it again.`); continue; }
          }
          notices.push(`${file.name}: uploaded`);
        } catch (cause) { notices.push(`${file.name}: ${cause instanceof Error ? cause.message : "Upload failed; choose this file again to retry."}`); }
        setProgress([...notices]);
      }
      setMessage("Upload finished. Review each file below.");
    });
  }
  async function saveName() {
    await run(async () => {
      if (edit === "delete") {
        await imageLibraryRequest(owner, `/api/media/groups/${collectionId}`, { method: "DELETE" }); switchCollection("");
        setMessage("Collection removed. Its images and existing slideshows are kept.");
      } else if (edit === "image") {
        if (chosen.length !== 1) throw new Error("Select one image to rename.");
        await imageLibraryRequest(owner, `/api/media/${chosen[0].id}`, { method: "PATCH", body: JSON.stringify({ title: name }) }); setSelected([]);
      } else {
        const result = await imageLibraryRequest<{ group: Collection }>(owner, edit === "create" ? "/api/media/groups" : `/api/media/groups/${collectionId}`,
          { method: edit === "create" ? "POST" : "PATCH", body: JSON.stringify({ name, mediaType: "image" }) });
        switchCollection(result.group.id);
      }
      setEdit(null);
    });
  }
  async function changeMembership(remove: boolean) {
    const target = remove ? collectionId : destination;
    if (!target || !chosen.length) return;
    await run(async () => {
      if (remove) {
        for (const asset of chosen) await imageLibraryRequest(owner, `/api/media/groups/${target}/items`, { method: "DELETE", body: JSON.stringify({ mediaAssetId: asset.id }) });
      } else await imageLibraryRequest(owner, `/api/media/groups/${target}/items`, { method: "POST", body: JSON.stringify({ mediaAssetIds: chosen.map(asset => asset.id) }) });
      setSelected([]); setMessage(remove ? "Images removed from this collection. Originals are kept." : "Images added to the collection.");
    });
  }
  async function archiveImages() {
    await run(async () => {
      const results = await Promise.allSettled(chosen.map(asset => imageLibraryRequest(owner, `/api/media/${asset.id}`, { method: "PATCH", body: JSON.stringify({ libraryArchived: !archived }) })));
      const failed = results.filter(result => result.status === "rejected").length;
      setSelected([]); setMessage(`${results.length - failed} image(s) ${archived ? "restored" : "archived"}. Saved slideshows keep their images.`);
      if (failed) setError(`${failed} image(s) could not be updated. Refresh and retry those images.`);
    });
  }

  return <section className={styles.library} aria-label="Image library">
    <div className={styles.heading}><div><h3>{mode === "manage" ? "Your image library" : "Choose images"}</h3><p>Upload once. Organize into collections and reuse in your slideshows.</p></div><div className={styles.actions}>
      <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => { setName(""); setEdit("create"); }}><FolderPlus aria-hidden="true" />New collection</Button>
      <Button type="button" size="sm" disabled={locked || archived} onClick={() => input.current?.click()}><Upload aria-hidden="true" />Upload images</Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Refresh image library" disabled={locked || active.isFetching} onClick={() => void refresh()}><RefreshCw aria-hidden="true" /></Button>
    </div></div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Upload library images" disabled={locked} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files); }} />
    <div className={styles.collections} role="group" aria-label="Image collections"><Button type="button" variant={collectionId ? "outline" : "secondary"} disabled={locked} onClick={() => switchCollection("")}>All images</Button>
      {groups.data?.groups.map(item => <Button type="button" key={item.id} variant={collectionId === item.id ? "secondary" : "outline"} aria-pressed={collectionId === item.id} disabled={locked} onClick={() => switchCollection(item.id)}>{item.name}</Button>)}
    </div>
    {groups.isError ? <p role="alert">Could not load collections. <Button type="button" variant="link" onClick={() => void groups.refetch()}>Retry collections</Button></p> : null}
    {group ? <div className={styles.collectionHeading}><div><strong>{group.name}</strong><p>Collection order is the order shown below. Images repeat from the beginning when needed.</p></div><div className={styles.actions}>
      <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => { setName(group.name); setEdit("rename"); }}>Rename collection</Button>
      <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => setEdit("delete")}>Remove collection</Button>
    </div></div> : null}
    <form className={styles.filters} onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setSelected([]); }}>
      <input aria-label="Search library images" placeholder="Search images…" value={query} disabled={locked} onChange={event => setQuery(event.target.value)} maxLength={140} /><Button type="submit" variant="outline" size="sm" disabled={locked}>Search</Button>
      <select aria-label="Image source" value={source} disabled={locked} onChange={event => { setSource(event.target.value); setSelected([]); }}><option value="all">All sources</option><option value="upload">Uploaded</option><option value="generated_image">Generated</option></select>
      {mode === "manage" && !collectionId ? <label><input type="checkbox" checked={archived} disabled={locked} onChange={event => { setArchived(event.target.checked); setSelected([]); }} />Archived</label> : null}
    </form>
    {active.isPending ? <p role="status" className={styles.empty}><LoaderCircle className="animate-spin" aria-hidden="true" />Loading your images…</p> : active.isError ? <div role="alert" className={styles.empty}><p>Could not load these images. Your selections have not been applied.</p><Button type="button" variant="outline" onClick={() => void active.refetch()}>Retry images</Button></div> : <>
      {visible.length ? <div className={styles.grid}>{visible.map(asset => <button type="button" className={styles.tile} key={asset.id} aria-label={`Select image ${asset.title}`} aria-pressed={selected.includes(asset.id)} disabled={locked || (!selected.includes(asset.id) && multiple && selected.length >= limit)} onClick={() => toggle(asset.id)}>
        <img src={asset.thumbnailUrl ?? asset.url} alt="" width={180} height={180} loading="lazy" /><span className={styles.check}>{selected.includes(asset.id) ? multiple ? selected.indexOf(asset.id) + 1 : <Check aria-hidden="true" /> : collectionId ? assets.indexOf(asset) + 1 : ""}</span><span className={styles.caption}>{asset.title}<small>{asset.width} × {asset.height}</small></span>
      </button>)}</div> : <div className={styles.empty}><Images aria-hidden="true" /><p>{search ? "No matching images. Try another search." : collectionId ? "This collection is empty. Upload images here or add images from All images." : archived ? "No archived images." : "Upload JPG, PNG or WebP images, up to 25 MB each."}</p></div>}
      {!collectionId && pages.hasNextPage ? <Button type="button" variant="outline" disabled={locked || pages.isFetchingNextPage} onClick={() => void pages.fetchNextPage()}>{pages.isFetchingNextPage ? "Loading…" : "Load more images"}</Button> : null}
    </>}
    {chosen.length === 1 ? <details className={styles.imagePreview}><summary>Preview {chosen[0].title}</summary><img src={chosen[0].url} alt={chosen[0].title} width={600} height={600} /></details> : null}
    {mode === "manage" && chosen.length ? <div className={styles.selection}><span>{chosen.length} selected</span>
      {!archived ? <><select aria-label="Destination collection" value={destination} onChange={event => setDestination(event.target.value)} disabled={locked}><option value="">Choose collection…</option>{groups.data?.groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button type="button" size="sm" variant="outline" disabled={locked || !destination} onClick={() => void changeMembership(false)}>Add to collection</Button>
        {collectionId ? <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => void changeMembership(true)}>Remove from collection</Button> : null}
        {chosen.length === 1 ? <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => { setName(chosen[0].title); setEdit("image"); }}>Rename image</Button> : null}</> : null}
      <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => void archiveImages()}><Archive aria-hidden="true" />{archived ? "Restore images" : "Archive images"}</Button>
    </div> : null}
    {mode === "pick" ? <div className={styles.selection}><span aria-live="polite">{chosen.length} selected{multiple ? ` · up to ${limit}` : ""}</span><div className={styles.actions}>
      {onCollection && group ? <div><Button type="button" variant="outline" disabled={locked || active.isError || active.isPending || active.isFetching || !assets.length} onClick={() => onCollection(assets, group.name)}>Preview collection backgrounds</Button><p className="mt-1 text-xs text-muted">Uses all {assets.length} images in this collection, including images hidden by search.</p></div> : null}
      <Button type="button" disabled={locked || active.isError || active.isPending || !chosen.length} onClick={() => onChoose?.(chosen)}>{multiple ? "Use selected images" : "Use selected image"}</Button>
    </div></div> : null}
    {message ? <p role="status" className={styles.notice}>{message}</p> : null}{error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {progress.length ? <details><summary>Upload results ({progress.length})</summary><ul className={styles.uploadResults}>{progress.map((line, index) => <li key={index}>{line}</li>)}</ul></details> : null}
    {edit ? <Dialog open onOpenChange={open => { if (!open && !busy) setEdit(null); }}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>{edit === "create" ? "New image collection" : edit === "rename" ? "Rename collection" : edit === "image" ? "Rename image" : "Remove collection?"}</DialogTitle><DialogDescription>{edit === "delete" ? "Only the collection is removed. Its images, slideshow drafts and saved posts are kept." : "Use a name that makes these images easy to find."}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void saveName(); }}>{edit !== "delete" ? <input aria-label="Library name" className={styles.nameInput} value={name} maxLength={edit === "image" ? 140 : 80} onChange={event => setName(event.target.value)} autoFocus /> : null}{error ? <p role="alert">{error}</p> : null}<Button type="submit" disabled={busy || (edit !== "delete" && !name.trim())}>{busy ? "Saving…" : edit === "delete" ? "Remove collection" : "Save name"}</Button></form>
    </DialogContent></Dialog> : null}
  </section>;
}
