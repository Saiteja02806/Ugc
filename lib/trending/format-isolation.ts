/** A failed format must not hide independently ready content. */
export async function loadTrendingFormat<T>(params: {
  load: () => Promise<T>;
  onError: (error: unknown) => void;
  fallback: T;
}): Promise<T> {
  try {
    return await params.load();
  } catch (error) {
    params.onError(error);
    return params.fallback;
  }
}
