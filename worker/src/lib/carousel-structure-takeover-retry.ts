type RpcFailure = { code?: string; message?: string };
const RETRYABLE_SQL_CODES = new Set(["55P03", "57014", "40001", "40P01"]);

export async function retryCarouselStructureTakeover<T extends { error: RpcFailure | null }>(
  invoke: () => PromiseLike<T>,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const result = await invoke();
    if (!result.error || !RETRYABLE_SQL_CODES.has(result.error.code ?? "") || attempt >= 2) return result;
    await wait(attempt === 0 ? 500 : 1500);
  }
}
