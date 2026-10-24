export function validateReferenceImageFiles(files: readonly File[], remaining: number, maxBytes: number) {
  if (files.length > remaining) throw new Error(`You can add ${Math.max(0, remaining)} more image${remaining === 1 ? "" : "s"}. Choose fewer files or remove a selected image.`);
  for (const file of files) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > maxBytes) {
      throw new Error(`${file.name}: use a PNG, JPEG or WebP image up to ${maxBytes / 1024 ** 2} MB.`);
    }
  }
}

/** Two uploads at a time; outcomes stay in file-picker order even when requests finish out of order. */
export async function prepareReferenceImageBatch<T>(files: readonly File[], prepare: (file: File) => Promise<T>,
  isCurrent: () => boolean, onProgress: (completed: number, total: number) => void) {
  const results: ({ value: T; error?: never } | { error: string; value?: never } | undefined)[] = new Array(files.length);
  let next = 0, completed = 0;
  async function work() {
    while (isCurrent()) {
      const index = next++;
      if (index >= files.length) return;
      try { results[index] = { value: await prepare(files[index]) }; }
      catch (cause) { results[index] = { error: `${files[index].name}: ${cause instanceof Error ? cause.message : "Could not upload this image."}` }; }
      completed++;
      if (isCurrent()) onProgress(completed, files.length);
    }
  }
  await Promise.all([work(), work()]);
  return results;
}
