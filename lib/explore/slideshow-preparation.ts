/** Prepare two independent slides at a time without changing their output order. */
export async function prepareSlideshowSequence<T, R>(
  slides: readonly T[],
  prepare: (slide: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(slides.length);
  let next = 0, completed = 0, failed = false;
  let failure: unknown;
  onProgress?.(0, slides.length);
  async function worker() {
    while (!failed && next < slides.length) {
      const index = next++;
      try {
        results[index] = await prepare(slides[index], index);
        onProgress?.(++completed, slides.length);
      } catch (error) {
        if (!failed) failure = error;
        failed = true;
      }
    }
  }
  // Wait for in-flight preparations before releasing the save lock on failure.
  await Promise.all(Array.from({length: Math.min(2, slides.length)}, worker));
  if (failed) throw failure;
  return results;
}
